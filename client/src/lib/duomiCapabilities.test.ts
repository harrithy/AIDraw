import { describe, expect, it } from "vitest";
import {
  DUOMI_CAPABILITIES,
  getDuomiCapabilitiesByCategory,
  getDuomiCapability,
  isDuomiCapabilitySubmittable
} from "./duomiCapabilities";

describe("多米能力注册表", () => {
  it("能力 ID 唯一且覆盖全部一级分类", () => {
    expect(DUOMI_CAPABILITIES).toHaveLength(57);
    expect(new Set(DUOMI_CAPABILITIES.map((item) => item.id)).size).toBe(DUOMI_CAPABILITIES.length);
    expect(["image", "video", "music", "tool"].every((category) =>
      getDuomiCapabilitiesByCategory(category as never).length > 0
    )).toBe(true);
  });

  it("异步与同步协议数量匹配文档索引", () => {
    expect(DUOMI_CAPABILITIES.filter((item) => item.query.strategy === "none")).toHaveLength(5);
    expect(DUOMI_CAPABILITIES.filter((item) => item.query.strategy !== "none")).toHaveLength(52);
  });

  it("保留停用和开发中能力的风险状态", () => {
    expect(getDuomiCapability("image.kling.try-on")?.status).toBe("disabled");
    expect(isDuomiCapabilitySubmittable(getDuomiCapability("image.kling.try-on")!)).toBe(false);
    expect(getDuomiCapability("video.seedance.generate")?.status).toBe("developing");
  });

  it("每项能力均有来源、价格、创建协议和认证配置", () => {
    for (const item of DUOMI_CAPABILITIES) {
      expect(item.sourceDocId).toMatch(/^(api|doc)-/);
      expect(item.priceLabel.length).toBeGreaterThan(0);
      expect(item.create.path.startsWith("/")).toBe(true);
      expect(item.auth.style.length).toBeGreaterThan(0);
    }
  });

  it("保留文档中的特殊鉴权和异步创建路径", () => {
    expect(getDuomiCapability("image.midjourney.blend")?.auth).toEqual({
      style: "key-header",
      name: "key"
    });
    expect(getDuomiCapability("image.midjourney.blend")?.fields[0]).toMatchObject({
      key: "base64Array",
      type: "url-list",
      required: true
    });
    expect(getDuomiCapability("music.suno.upload")?.auth).toEqual({
      style: "key-header",
      name: "key"
    });
    expect(getDuomiCapability("video.seedance.generate")?.auth).toEqual({ style: "authorization" });
    expect(getDuomiCapability("image.gpt-image-2")?.create.path).toBe(
      "/v1/images/generations?async=true"
    );
  });

  it("使用文档声明的 wire 类型，而不是 UI 布尔值", () => {
    const pixAudio = getDuomiCapability("video.pix.generate")?.fields.find(
      (field) => field.key === "audio"
    );
    const customMode = getDuomiCapability("music.suno.generate")?.fields.find(
      (field) => field.key === "custom_mode"
    );
    const klingSound = getDuomiCapability("video.kling.text")?.fields.find(
      (field) => field.key === "sound"
    );

    expect(pixAudio).toMatchObject({ type: "select", defaultValue: 1 });
    expect(pixAudio?.options?.map((option) => option.value)).toEqual([0, 1]);
    expect(customMode).toMatchObject({ type: "select", required: true, defaultValue: 0 });
    expect(customMode?.options?.map((option) => option.value)).toEqual([0, 1]);
    expect(klingSound?.options?.map((option) => option.value)).toEqual(["on", "off"]);
    expect(
      getDuomiCapability("video.pika.text")?.fields.find((field) => field.key === "model")?.type
    ).toBe("number");
    expect(
      getDuomiCapability("video.kling.dm-text")?.fields.find((field) => field.key === "cfg")?.type
    ).toBe("text");
    expect(
      getDuomiCapability("video.kling.multi-image")?.fields.find(
        (field) => field.key === "duration"
      )
    ).toMatchObject({ type: "text", defaultValue: "5" });
  });

  it("覆盖关键必填字段、回调和 SUNO 后处理参数", () => {
    const requiredFields = (capabilityId: string) =>
      getDuomiCapability(capabilityId)?.fields.filter((field) => field.required).map((field) => field.key);

    expect(requiredFields("image.kling.generate")).toEqual(["model_name", "prompt"]);
    expect(requiredFields("video.runway.image")).toContain("options");
    expect(requiredFields("video.luma.generate")).toContain("image_url");
    expect(requiredFields("video.pika.reference")).toContain("sfx");
    expect(requiredFields("music.suno.concat")).toContain("callback_url");

    for (const capabilityId of [
      "video.runway.video",
      "video.luma.extend",
      "video.pika.text",
      "video.pika.image",
      "video.pika.reference",
      "video.kling.dm-image",
      "video.kling.dm-extend",
      "video.kling.effects",
      "audio.kling.text-effect",
      "audio.kling.video-effect"
    ]) {
      expect(requiredFields(capabilityId)).toContain("callback_url");
    }

    expect(getDuomiCapability("music.suno.speed")?.fields.map((field) => field.key)).toEqual([
      "task_id",
      "speed_multiplier",
      "keep_pitch",
      "title"
    ]);
    expect(getDuomiCapability("music.suno.crop")?.fields.map((field) => field.key)).toEqual([
      "task_id",
      "crop_start_s",
      "crop_end_s",
      "is_crop_remove"
    ]);
    expect(getDuomiCapability("music.suno.timing")?.fields.map((field) => field.key)).toEqual([
      "task_id",
      "clip_id"
    ]);
    expect(getDuomiCapability("music.suno.midi")?.fields.map((field) => field.key)).toEqual([
      "task_id",
      "clip_id"
    ]);
  });

  it("覆盖官方主体分页查询与 SUNO 配乐/人声扩展", () => {
    const presets = getDuomiCapability("tool.kling.presets-elements");
    expect(presets?.create).toMatchObject({
      method: "GET",
      path: "/api/video/kling/v1/general/presets-elements"
    });
    expect(presets?.query.strategy).toBe("none");
    expect(presets?.fields.map((field) => field.key)).toEqual(["pageNum", "pageSize"]);
    expect(presets?.fields.find((field) => field.key === "pageSize")?.defaultValue).toBe(30);

    const underpainting = getDuomiCapability("music.suno.underpainting");
    expect(underpainting?.fixedParams).toEqual({
      mv: "chirp-bluejay",
      task: "underpainting",
      prompt: "",
      override_fields: ["prompt", "tags"]
    });
    expect(underpainting?.create.contentType).toBe("multipart/form-data");
    expect(underpainting?.query.strategy).toBe("shared");
    expect(underpainting?.fields.map((field) => field.key)).toEqual([
      "underpainting_clip_id",
      "tags",
      "underpainting_start_s",
      "underpainting_end_s",
      "title",
      "callback_url"
    ]);

    const overpainting = getDuomiCapability("music.suno.overpainting");
    expect(overpainting?.fixedParams).toEqual({
      mv: "chirp-bluejay",
      task: "overpainting",
      override_fields: ["prompt", "tags"]
    });
    expect(overpainting?.fields.map((field) => field.key)).toEqual([
      "overpainting_clip_id",
      "prompt",
      "tags",
      "overpainting_start_s",
      "overpainting_end_s",
      "title",
      "callback_url"
    ]);
  });

  it("修正 SORA 时长与 GPT 尺寸枚举、PIX 音色列表", () => {
    const soraDuration = getDuomiCapability("video.sora.generate")?.fields.find(
      (field) => field.key === "duration"
    );
    expect(soraDuration?.type).toBe("select");
    expect(soraDuration?.options?.map((option) => option.value)).toEqual([4, 8, 12]);
    expect(soraDuration?.defaultValue).toBe(4);

    const gptSize = getDuomiCapability("image.gpt-image-2")?.fields.find((field) => field.key === "size");
    expect(gptSize?.type).toBe("select");
    expect(gptSize?.defaultValue).toBe("auto");
    expect(gptSize?.options?.map((option) => option.value)).toContain("1024x1024");

    const pixSpeaker = getDuomiCapability("video.pix.generate")?.fields.find(
      (field) => field.key === "lip_sync_tts_speaker_id"
    );
    expect(pixSpeaker?.type).toBe("select");
    expect(pixSpeaker?.options?.map((option) => option.value)).toEqual([
      "Auto",
      "14",
      "6",
      "13",
      "2",
      "4",
      "12",
      "11",
      "10",
      "5",
      "1",
      "9",
      "3",
      "8",
      "7"
    ]);
  });
});
