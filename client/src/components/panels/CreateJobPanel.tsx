import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ImagePlus, ImageUp, Link2, Loader2, MousePointer2, Play, X } from "lucide-react";
import { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prefersReducedMotion } from "../../lib/motion";
import type { CreateJobPayload, DrawMode, DrawSize, PresetDrawSize } from "../../types";
import type { ThinkingValue } from "../../types/ui";

type UploadResult = {
  url: string;
  originalName: string;
};

type CreateJobPanelProps = {
  isSubmitting: boolean;
  notice?: string;
  variant?: "panel" | "composer";
  onSubmit: (payload: CreateJobPayload) => Promise<void>;
  onUploadImage: (file: File) => Promise<UploadResult>;
};

type SizeMode = PresetDrawSize | "custom";

const imageSizeOptions: Array<{ label: string; value: SizeMode }> = [
  { label: "auto", value: "auto" },
  { label: "1024x1024", value: "1024x1024" },
  { label: "1792x1024", value: "1792x1024" },
  { label: "1024x1792", value: "1024x1792" },
  { label: "自定义宽x高", value: "custom" },
  { label: "1:1", value: "1:1" },
  { label: "3:2", value: "3:2" },
  { label: "2:3", value: "2:3" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:2", value: "1:2" },
  { label: "2:1", value: "2:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "5:4", value: "5:4" },
  { label: "4:5", value: "4:5" }
];

const qualityOptions: ThinkingValue[] = ["high", "medium", "low"];

const parseCustomDimension = (value: string) => Number.parseInt(value.trim(), 10);

const isRemoteImageUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getCustomSizeError = (width: number, height: number) => {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return "自定义尺寸需要填写整数宽高";
  if (width < 16 || height < 16 || width > 3840 || height > 3840) return "自定义尺寸每条边需在 16 到 3840 之间";
  if (width % 16 !== 0 || height % 16 !== 0) return "自定义尺寸的宽和高都必须能被 16 整除";
  const pixels = width * height;
  if (pixels < 655360 || pixels > 8294400) return "自定义尺寸像素预算需在 655,360 到 8,294,400 之间";
  return "";
};

export function CreateJobPanel({
  isSubmitting,
  notice,
  variant = "panel",
  onSubmit,
  onUploadImage
}: CreateJobPanelProps) {
  const panelRef = useRef<HTMLFormElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [sizeMode, setSizeMode] = useState<SizeMode>("auto");
  const [customWidth, setCustomWidth] = useState("1024");
  const [customHeight, setCustomHeight] = useState("1024");
  const [thinking, setThinking] = useState<ThinkingValue>("high");
  const [inputImages, setInputImages] = useState<UploadResult[]>([]);
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const currentMode: DrawMode = inputImages.length > 0 ? "image-to-image" : "text-to-image";

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const modeSensitiveFields = panelRef.current
        ? Array.from(panelRef.current.querySelectorAll<HTMLElement>(".mode-sensitive"))
        : [];

      if (modeSensitiveFields.length > 0) {
        gsap.fromTo(
          modeSensitiveFields,
          { y: -6, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.28, ease: "power2.out", clearProps: "transform,visibility" }
        );
      }
    },
    { dependencies: [currentMode, inputImages.length], scope: panelRef }
  );

  const uploadFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    try {
      setIsUploading(true);
      setUploadError("");
      const uploadedImages = await Promise.all(imageFiles.map((file) => onUploadImage(file)));
      setInputImages((current) => [...current, ...uploadedImages]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "图片添加失败");
    } finally {
      setIsUploading(false);
    }
  };

  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      void uploadFiles(files);
      event.target.value = "";
    }
  };

  const pasteImages = (event: ClipboardEvent<HTMLElement>) => {
    const pastedText = event.clipboardData.getData("text").trim();
    const filesFromItems = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const files = filesFromItems.length > 0 ? filesFromItems : Array.from(event.clipboardData.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      if (pastedText && isRemoteImageUrl(pastedText)) {
        event.preventDefault();
        event.stopPropagation();
        addReferenceImageUrl(pastedText);
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void uploadFiles(imageFiles);
  };

  const removeImage = (url: string) => {
    setInputImages((current) => current.filter((image) => image.url !== url));
  };

  const addReferenceImageUrl = (rawValue = referenceImageUrl) => {
    const url = rawValue.trim();
    if (!url) {
      setUploadError("请先填写参考图片 URL");
      return;
    }
    if (!isRemoteImageUrl(url)) {
      setUploadError("参考图片 URL 需要以 http:// 或 https:// 开头");
      return;
    }

    const hostname = new URL(url).hostname;
    setInputImages((current) =>
      current.some((image) => image.url === url)
        ? current
        : [
            ...current,
            {
              url,
              originalName: hostname || "参考图片 URL"
            }
          ]
    );
    setReferenceImageUrl("");
    setUploadError("");
  };

  const addReferenceImageUrlOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addReferenceImageUrl();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      setUploadError("请先填写提示词");
      return;
    }

    const inputImageUrls = inputImages.map((image) => image.url);
    const width = parseCustomDimension(customWidth);
    const height = parseCustomDimension(customHeight);
    const customSizeError = sizeMode === "custom" ? getCustomSizeError(width, height) : "";
    if (customSizeError) {
      setUploadError(customSizeError);
      return;
    }

    const requestSize: DrawSize = sizeMode === "custom" ? `${width}x${height}` : sizeMode;
    setUploadError("");
    await onSubmit({
      mode: currentMode,
      prompt: nextPrompt,
      inputImageUrl: inputImageUrls[0],
      inputImageUrls,
      width: 1024,
      height: 1024,
      size: requestSize,
      count,
      strength: currentMode === "image-to-image" ? 0.55 : undefined,
      thinking,
      model: "gpt-image-2"
    });
  };

  const imageAttachments = inputImages.length ? (
    <div className="composer-attachments mode-sensitive" aria-label="参考图片">
      {inputImages.map((image) => (
        <div className="composer-attachment" key={image.url}>
          <img src={image.url} alt={image.originalName} />
          <Button type="button" variant="secondary" size="icon-xs" onClick={() => removeImage(image.url)} aria-label={`移除 ${image.originalName}`}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  ) : null;

  const referenceUrlEntry = (
    <div className="reference-url-row">
      <Input
        value={referenceImageUrl}
        onChange={(event) => setReferenceImageUrl(event.target.value)}
        onKeyDown={addReferenceImageUrlOnEnter}
        placeholder="https://example.com/image.png"
        aria-label="参考图片 URL"
      />
      <Button type="button" variant="outline" size="sm" className="reference-url-button" onClick={() => addReferenceImageUrl()}>
        <Link2 data-icon="inline-start" />
        添加 URL
      </Button>
    </div>
  );

  const renderQualitySelect = (id?: string, side: "top" | "bottom" = "bottom") => (
    <Select value={thinking} onValueChange={(value) => setThinking(value as ThinkingValue)}>
      <SelectTrigger id={id} aria-label="Quality" className="composer-select-trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectContent side={side} sideOffset={6} position="popper" align="start" className="composer-select-content">
        <SelectGroup>
          {qualityOptions.map((option) => (
            <SelectItem key={option} value={option} className="composer-select-item">
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const renderSizeSelect = (id?: string, side: "top" | "bottom" = "bottom") => (
    <Select value={sizeMode} onValueChange={(value) => setSizeMode(value as SizeMode)}>
      <SelectTrigger id={id} aria-label="Size" className="composer-select-trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectContent side={side} sideOffset={6} position="popper" align="start" className="composer-select-content size-select-content">
        <SelectGroup>
          {imageSizeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="composer-select-item">
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  if (variant === "composer") {
    return (
      <form ref={panelRef} className="create-panel composer-panel" onSubmit={submit} noValidate>
        <div className="composer-floating-controls">
          <div className={`composer-fields ${sizeMode === "custom" ? "has-custom-size" : ""}`}>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="composer-count">数量</FieldLabel>
              <Input
                id="composer-count"
                type="number"
                min={1}
                max={8}
                value={count}
                onChange={(event) => setCount(Math.min(8, Math.max(1, Number(event.target.value) || 1)))}
              />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="composer-quality">Quality</FieldLabel>
              {renderQualitySelect("composer-quality", "top")}
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="composer-size">Size</FieldLabel>
              {renderSizeSelect("composer-size", "top")}
            </Field>
            {sizeMode === "custom" ? (
              <>
                <Field orientation="horizontal" className="custom-size-field">
                  <FieldLabel htmlFor="composer-custom-width">宽</FieldLabel>
                  <Input
                    id="composer-custom-width"
                    inputMode="numeric"
                    min={16}
                    max={3840}
                    step={16}
                    type="number"
                    value={customWidth}
                    onChange={(event) => setCustomWidth(event.target.value)}
                  />
                </Field>
                <Field orientation="horizontal" className="custom-size-field">
                  <FieldLabel htmlFor="composer-custom-height">高</FieldLabel>
                  <Input
                    id="composer-custom-height"
                    inputMode="numeric"
                    min={16}
                    max={3840}
                    step={16}
                    type="number"
                    value={customHeight}
                    onChange={(event) => setCustomHeight(event.target.value)}
                  />
                </Field>
              </>
            ) : null}
            <Field orientation="horizontal">
              <FieldLabel htmlFor="composer-model">模型</FieldLabel>
              <Input id="composer-model" value="gpt-image-2" readOnly />
            </Field>
          </div>

          {notice ? (
            <div className="notice-line composer-notice">
              <MousePointer2 size={15} />
              <span>{inputImages.length > 0 ? "检测到图片，将自动使用图生图" : notice}</span>
            </div>
          ) : null}
        </div>

        <Field className="composer-input-field" data-invalid={Boolean(uploadError)}>
          <FieldLabel htmlFor="composer-prompt" className="sr-only">提示词</FieldLabel>
          <InputGroup className={`composer-input-shell ${inputImages.length > 0 ? "has-attachments" : ""}`} onPaste={pasteImages}>
            {imageAttachments}
            <InputGroupTextarea
              id="composer-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={pasteImages}
              placeholder="描述你想生成的画面"
              aria-invalid={Boolean(uploadError)}
            />
            <InputGroupAddon align="inline-end" className="composer-actions">
              <Button type="button" variant="outline" size="icon" asChild title="上传参考图片">
                <label>
                  <input className="sr-only" type="file" accept="image/*" multiple onChange={uploadImage} />
                  {isUploading ? <Loader2 className="spin" /> : <ImagePlus />}
                </label>
              </Button>
              <Button className="composer-submit" type="submit" disabled={isSubmitting || isUploading}>
                {isSubmitting ? <Loader2 className="spin" data-icon="inline-start" /> : <ImageUp data-icon="inline-start" />}
                <span>{isSubmitting ? "加入中" : "加入队列"}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
          {referenceUrlEntry}
          {uploadError ? <FieldError className="composer-error">{uploadError}</FieldError> : null}
        </Field>
      </form>
    );
  }

  return (
    <form ref={panelRef} className="create-panel" onSubmit={submit} noValidate>
      <div className="panel-title">
        <div>
          <p className="eyebrow">绘图任务</p>
          <h2>创建绘制</h2>
        </div>
        <Play size={24} />
      </div>

      <label className="upload-box">
        <input type="file" accept="image/*" multiple onChange={uploadImage} />
        {isUploading ? <Loader2 className="spin" size={22} /> : <ImagePlus size={22} />}
        <span>{inputImages.length > 0 ? `${inputImages.length} 张参考图` : "上传参考图片"}</span>
      </label>

      {referenceUrlEntry}

      {imageAttachments}

      <Field>
        <FieldLabel>提示词</FieldLabel>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onPaste={pasteImages}
          placeholder="描述你想生成的画面"
        />
      </Field>

      <div className="form-grid">
        <Field>
          <FieldLabel>数量</FieldLabel>
          <Input
            type="number"
            min={1}
            max={8}
            value={count}
            onChange={(event) => setCount(Math.min(8, Math.max(1, Number(event.target.value) || 1)))}
          />
        </Field>
        <Field>
          <FieldLabel>Size</FieldLabel>
          {renderSizeSelect()}
        </Field>
      </div>

      {sizeMode === "custom" ? (
        <div className="form-grid">
          <Field>
            <FieldLabel>自定义宽</FieldLabel>
            <Input
              inputMode="numeric"
              min={16}
              max={3840}
              step={16}
              type="number"
              value={customWidth}
              onChange={(event) => setCustomWidth(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>自定义高</FieldLabel>
            <Input
              inputMode="numeric"
              min={16}
              max={3840}
              step={16}
              type="number"
              value={customHeight}
              onChange={(event) => setCustomHeight(event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      <div className="form-grid">
        <Field>
          <FieldLabel>Quality</FieldLabel>
          {renderQualitySelect()}
        </Field>
        <Field>
          <FieldLabel>模型</FieldLabel>
          <Input value="gpt-image-2" readOnly />
        </Field>
      </div>

      {uploadError ? <small className="error-text">{uploadError}</small> : null}

      <Button type="submit" disabled={isSubmitting || isUploading}>
        {isSubmitting ? <Loader2 className="spin" data-icon="inline-start" /> : <ImageUp data-icon="inline-start" />}
        {isSubmitting ? "加入中" : "加入绘制队列"}
      </Button>
    </form>
  );
}
