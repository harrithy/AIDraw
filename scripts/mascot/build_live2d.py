"""从原画和闭眼补图生成原创角色的 Cubism 运行时模型（非编辑器工程）。"""
from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent / "vendor"))
from autorig.build import ArtMeshSpec, RigBuilder  # noqa: E402
from autorig.mesh import Mesh  # noqa: E402

OUTPUT = ROOT / "client/public/mascot/live2d"
NAME = "aidraw-girl"
SIZE = 1254
PPU = 1000.0
ATLAS = 2048


def grid(bounds, step, atlas_offset=(0, 0)):
    """规则网格自动三角化；UV 沿用像素位置，不重绘角色。"""
    x0, y0, x1, y1 = bounds
    xs = np.linspace(x0, x1, int(np.ceil((x1 - x0) / step)) + 1)
    ys = np.linspace(y0, y1, int(np.ceil((y1 - y0) / step)) + 1)
    xx, yy = np.meshgrid(xs, ys)
    pixels = np.stack((xx.ravel(), yy.ravel()), axis=1)
    vertices = (pixels - SIZE / 2) / PPU
    vertices[:, 1] *= -1
    ax, ay = atlas_offset
    uvs = np.stack(((pixels[:, 0] - x0 + ax) / ATLAS,
                    1 - (pixels[:, 1] - y0 + ay) / ATLAS), axis=1)
    indices = []
    for row in range(len(ys) - 1):
        for col in range(len(xs) - 1):
            a = row * len(xs) + col
            # 模型坐标 Y 向上，三角形保持逆时针。
            indices.extend((a, a + len(xs), a + 1, a + 1, a + len(xs), a + len(xs) + 1))
    return Mesh(vertices.astype(np.float32), uvs.astype(np.float32), np.array(indices, dtype=np.uint16)), pixels


def smoothstep(value):
    """连续权重让颈部、发梢与衣领之间自然过渡。"""
    t = np.clip(value, 0, 1)
    return t * t * (3 - 2 * t)


def transform(pixels, values, gaze_center=None):
    """按参数生成绝对顶点，保守限制动作幅度，保持原画五官比例。"""
    p = pixels.astype(np.float64).copy()
    x, y = pixels.T
    head = 1 - smoothstep((y - 610) / 210)
    fx = values.get("ParamAngleX", 0) / 30
    fy = values.get("ParamAngleY", 0) / 30
    angle = np.deg2rad(values.get("ParamAngleZ", 0) * 0.11)
    pivot = np.array([700, 690])
    rotation = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
    rotated = (p - pivot) @ rotation.T + pivot
    p += (rotated - p) * head[:, None]
    p[:, 0] += fx * 12 * head
    p[:, 1] -= fy * 7 * head
    breathing = values.get("ParamBreath", 0)
    height = np.clip((SIZE - y) / 700, 0, 1)
    p[:, 1] -= breathing * 3.5 * height
    p[:, 0] += (x - 650) * breathing * 0.002 * (1 - head)
    # 发梢仅在脸两侧小幅摆动，眼睛与下巴不随之扭曲。
    hair = np.maximum(np.exp(-((x - 400) / 105) ** 2), np.exp(-((x - 925) / 78) ** 2))
    hair *= np.exp(-((y - 520) / 165) ** 2)
    p[:, 0] += values.get("ParamHairSway", 0) * 4 * hair
    if gaze_center is not None:
        cx, cy = gaze_center
        influence = np.exp(-((x - cx) / 25) ** 4 - ((y - cy) / 24) ** 4)
        p[:, 0] += values.get("ParamEyeBallX", 0) * 2.2 * influence
        p[:, 1] -= values.get("ParamEyeBallY", 0) * 1.8 * influence
    p = (p - SIZE / 2) / PPU
    p[:, 1] *= -1
    return p.astype(np.float32)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    original = Image.open(ROOT / "client/public/mascot/aidraw-girl-2d-v1.png").convert("RGBA")
    closed = Image.open(ROOT / "docs/assets/aidraw-girl-eyes-closed-v1.png").convert("RGBA")
    if original.size != (SIZE, SIZE) or closed.size != original.size:
        raise ValueError("补图必须与原画画布大小一致，避免眼睛错位")
    atlas = Image.new("RGBA", (ATLAS, ATLAS))
    atlas.paste(original, (0, 0))
    builder = RigBuilder(SIZE, SIZE, PPU)
    # Core 的画布尺寸与原点使用像素，顶点才使用除以 PPU 后的模型坐标。
    builder.canvas.canvas_width = SIZE
    builder.canvas.canvas_height = SIZE
    builder.canvas.origin_x = SIZE / 2
    builder.canvas.origin_y = SIZE / 2
    part = builder.add_part("OriginalGirl")
    params = {}
    definitions = [
        ("ParamAngleX", -30, 30, 0, [-30, 0, 30]),
        ("ParamAngleY", -30, 30, 0, [-30, 0, 30]),
        ("ParamAngleZ", -30, 30, 0, [-30, 0, 30]),
        ("ParamBreath", 0, 1, 0, [0, 1]),
        ("ParamHairSway", -1, 1, 0, [-1, 0, 1]),
        ("ParamEyeBallX", -1, 1, 0, [-1, 0, 1]),
        ("ParamEyeBallY", -1, 1, 0, [-1, 0, 1]),
        ("ParamEyeLOpen", 0, 1, 1, [0, 1]),
        ("ParamEyeROpen", 0, 1, 1, [0, 1]),
    ]
    for definition in definitions:
        params[definition[0]] = builder.add_param(*definition)
    opacities = {}

    def add(name, bounds, step, offset, bindings, center=None, blink=None):
        mesh, pixels = grid(bounds, step, offset)
        indices = [params[pid] for pid in bindings]

        def deform(cell):
            values = {pid: builder.params[index].keys[key] for pid, index, key in zip(bindings, indices, cell)}
            return transform(pixels, values, center)

        builder.add_mesh(ArtMeshSpec(name, mesh, part, draw_order=len(builder.meshes), bound_params=indices, deform=deform))
        if blink:
            # 原画保留在底层；闭眼补图通过原生参数控制不透明度。
            cells = itertools.product(*[range(builder.params[index].n_keys) for index in reversed(indices)])
            opacities[name] = [1 - builder.params[params[blink]].keys[tuple(reversed(cell))[bindings.index(blink)]] for cell in cells]

    common = ["ParamAngleX", "ParamAngleY", "ParamAngleZ", "ParamBreath"]
    add("Illustration", (0, 0, SIZE, SIZE), 32, (0, 0), common + ["ParamHairSway"])
    eyes = [
        ("L", (538, 388, 687, 507), (610, 448)),
        ("R", (715, 329, 848, 449), (771, 402)),
    ]
    for side, bounds, center in eyes:
        x0, y0, x1, y1 = bounds
        w, h = x1 - x0, y1 - y0
        for row, source in enumerate((original, closed)):
            # 只做模型纹理切片与图集打包；绘画修改由闭眼补图提供。
            patch = source.crop(bounds)
            mask = np.asarray(patch).copy()
            yy, xx = np.mgrid[:h, :w]
            fade = smoothstep(np.minimum.reduce((xx, yy, w - 1 - xx, h - 1 - yy)) / 9)
            mask[:, :, 3] = np.round(mask[:, :, 3] * fade).astype(np.uint8)
            offset = (1300 + (0 if side == "L" else 200), 40 + row * 180)
            atlas.paste(Image.fromarray(mask), offset)
            if row == 0:
                add(f"Eye{side}Gaze", bounds, 9, offset, common + ["ParamEyeBallX", "ParamEyeBallY"], center)
            else:
                add(f"Eye{side}Closed", bounds, 9, offset, common + [f"ParamEye{side}Open"], blink=f"ParamEye{side}Open")

    model = builder.build()
    for i, spec in enumerate(builder.meshes):
        if spec.name in opacities:
            start = model.sections["art_mesh_src.keyform_off"][i]
            values = opacities[spec.name]
            model.sections["art_mesh_key_src.opacity"][start:start + len(values)] = values
    model.to_file(OUTPUT / f"{NAME}.moc3")
    atlas.save(OUTPUT / "texture_00.png")
    write_json(OUTPUT / f"{NAME}.model3.json", {
        "Version": 3,
        "FileReferences": {"Moc": f"{NAME}.moc3", "Textures": ["texture_00.png"], "DisplayInfo": f"{NAME}.cdi3.json"},
        "Groups": [{"Target": "Parameter", "Name": "EyeBlink", "Ids": ["ParamEyeLOpen", "ParamEyeROpen"]}],
        "HitAreas": [],
    })
    labels = ["头部左右", "轻轻点头", "侧头", "呼吸", "发梢轻摆", "目光左右", "目光上下", "左眼开合", "右眼开合"]
    write_json(OUTPUT / f"{NAME}.cdi3.json", {
        "Version": 3,
        "Parameters": [{"Id": definition[0], "GroupId": "", "Name": label} for definition, label in zip(definitions, labels)],
        "ParameterGroups": [], "Parts": [{"Id": "OriginalGirl", "Name": "原创绘画少女"}],
    })
    print(json.dumps({"meshes": len(builder.meshes), "parameters": len(builder.params), "mocBytes": (OUTPUT / f"{NAME}.moc3").stat().st_size}))


if __name__ == "__main__":
    main()
