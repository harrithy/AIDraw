import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ChevronDown, ImagePlus, ImageUp, Loader2, MousePointer2, PenLine, Play, X } from "lucide-react";
import { type ChangeEvent, type ClipboardEvent, type DragEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Message } from "@/components/ui/message";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import {
  GPT_IMAGE_MODEL,
  MAX_NANO_BANANA_REFERENCE_IMAGES,
  imageModelGroups,
  isNanoBananaModel,
  supportsNanoBananaImageSize,
  type SupportedImageModel
} from "../../lib/imageModels";
import { prefersReducedMotion } from "../../lib/motion";
import type { CreateJobPayload, DrawMode, DrawSize, NanoImageSize, PresetDrawSize } from "../../types";
import type { ThinkingValue } from "../../types/ui";

type UploadResult = {
  url: string;
  originalName: string;
};

type CreateJobPanelProps = {
  isSubmitting: boolean;
  notice?: string;
  variant?: "panel" | "composer";
  usedImage?: string | null;
  onSubmit: (payload: CreateJobPayload) => Promise<void>;
  onUploadImage: (file: File) => Promise<UploadResult>;
  onImageUsed?: () => void;
};

type SizeMode = PresetDrawSize | "custom";

const gptSizeOptions: Array<{ label: string; value: SizeMode }> = [
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

const nanoAspectRatioOptions: Array<{ label: string; value: SizeMode }> = [
  { label: "auto", value: "auto" },
  { label: "1:1", value: "1:1" },
  { label: "2:3", value: "2:3" },
  { label: "3:2", value: "3:2" },
  { label: "3:4", value: "3:4" },
  { label: "4:3", value: "4:3" },
  { label: "4:5", value: "4:5" },
  { label: "5:4", value: "5:4" },
  { label: "9:16", value: "9:16" },
  { label: "16:9", value: "16:9" },
  { label: "21:9", value: "21:9" }
];

const qualityOptions: ThinkingValue[] = ["high", "medium", "low"];
const nanoImageSizeOptions: NanoImageSize[] = ["1K", "2K", "4K"];

const parseCustomDimension = (value: string) => Number.parseInt(value.trim(), 10);

const getImageFiles = (files: FileList | File[]) => Array.from(files).filter((file) => file.type.startsWith("image/"));

const hasDraggedImage = (event: DragEvent<HTMLElement>) => {
  const items = Array.from(event.dataTransfer.items ?? []);
  if (items.length > 0) {
    return items.some((item) => item.kind === "file" && item.type.startsWith("image/"));
  }

  return getImageFiles(event.dataTransfer.files).length > 0;
};

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

function ReferenceImagePreview({
  image,
  onClose
}: {
  image: UploadResult | null;
  onClose: () => void;
}) {
  return (
    <AnimatedModal open={Boolean(image)} onClose={onClose} ariaLabel="参考图片预览">
      {image ? (
        <>
          <div className="image-preview-actions">
            <button type="button" className="image-preview-action image-preview-close" onClick={onClose} title="关闭预览">
              <X size={18} />
            </button>
          </div>
          <img src={image.url} alt={image.originalName} />
          <div className="image-preview-caption">
            <strong>{image.originalName}</strong>
            <span>参考图片</span>
          </div>
        </>
      ) : null}
    </AnimatedModal>
  );
}

export function CreateJobPanel({
  isSubmitting,
  notice,
  variant = "panel",
  usedImage,
  onSubmit,
  onUploadImage,
  onImageUsed
}: CreateJobPanelProps) {
  const panelRef = useRef<HTMLFormElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [sizeMode, setSizeMode] = useState<SizeMode>("auto");
  const [customWidth, setCustomWidth] = useState("1024");
  const [customHeight, setCustomHeight] = useState("1024");
  const [thinking, setThinking] = useState<ThinkingValue>("high");
  const [model, setModel] = useState<SupportedImageModel>(GPT_IMAGE_MODEL);
  const [nanoImageSize, setNanoImageSize] = useState<NanoImageSize>("4K");
  const [inputImages, setInputImages] = useState<UploadResult[]>([]);
  const [previewImage, setPreviewImage] = useState<UploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragDepthRef = useRef(0);
  const currentMode: DrawMode = inputImages.length > 0 ? "image-to-image" : "text-to-image";
  const isNanoBanana = isNanoBananaModel(model);
  const supportsNanoImageSize = supportsNanoBananaImageSize(model);
  const currentSizeOptions = isNanoBanana ? nanoAspectRatioOptions : gptSizeOptions;

  useEffect(() => {
    if (!currentSizeOptions.some((option) => option.value === sizeMode)) {
      setSizeMode("auto");
    }
  }, [currentSizeOptions, sizeMode]);

  useEffect(() => {
    if (usedImage) {
      setInputImages((current) => {
        if (current.some((img) => img.url === usedImage)) return current;
        return [
          ...current,
          { url: usedImage, originalName: "参考图片" }
        ];
      });
      onImageUsed?.();
    }
  }, [usedImage, onImageUsed]);

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
    const imageFiles = getImageFiles(files);
    if (imageFiles.length === 0) return;

    let filesToUpload = imageFiles;
    if (isNanoBanana) {
      const remaining = MAX_NANO_BANANA_REFERENCE_IMAGES - inputImages.length;
      if (remaining <= 0) {
        Message.error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
        return;
      }
      if (imageFiles.length > remaining) {
        Message.error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图，已保留前 ${remaining} 张`);
        filesToUpload = imageFiles.slice(0, remaining);
      }
    }

    try {
      setIsUploading(true);
      const uploadedImages = await Promise.all(filesToUpload.map((file) => onUploadImage(file)));
      setInputImages((current) => [...current, ...uploadedImages]);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "图片添加失败");
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
    const imageFiles = getImageFiles(files);
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

  const dragImages = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const holdDraggedImages = (event: DragEvent<HTMLElement>) => {
    if (!isDragActive && !hasDraggedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };

  const leaveDraggedImages = (event: DragEvent<HTMLElement>) => {
    if (!isDragActive && !hasDraggedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragActive(false);
  };

  const dropImages = (event: DragEvent<HTMLElement>) => {
    const hasFiles = event.dataTransfer.files.length > 0;
    if (!hasFiles && !hasDraggedImage(event)) return;

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);

    const imageFiles = getImageFiles(event.dataTransfer.files);
    if (imageFiles.length === 0) {
      Message.error("只支持拖拽图片文件");
      return;
    }

    void uploadFiles(imageFiles);
  };

  const removeImage = (url: string) => {
    setInputImages((current) => current.filter((image) => image.url !== url));
  };

  const addReferenceImageUrl = (rawValue: string) => {
    const url = rawValue.trim();
    if (!url) {
      return;
    }
    if (!isRemoteImageUrl(url)) {
      Message.error("参考图片 URL 需要以 http:// 或 https:// 开头");
      return;
    }
    if (isNanoBanana && inputImages.length >= MAX_NANO_BANANA_REFERENCE_IMAGES) {
      Message.error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
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
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      Message.error("请先填写提示词");
      return;
    }

    if (isUploading) {
      Message.error("正在上传图片，请稍后再试");
      return;
    }
    if (isNanoBanana && inputImages.length > MAX_NANO_BANANA_REFERENCE_IMAGES) {
      Message.error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
      return;
    }

    const inputImageUrls = inputImages.map((image) => image.url);
    const resolvedSizeMode = currentSizeOptions.some((option) => option.value === sizeMode) ? sizeMode : "auto";
    const width = parseCustomDimension(customWidth);
    const height = parseCustomDimension(customHeight);
    const customSizeError = resolvedSizeMode === "custom" ? getCustomSizeError(width, height) : "";
    if (customSizeError) {
      Message.error(customSizeError);
      return;
    }

    const requestSize: DrawSize = resolvedSizeMode === "custom" ? `${width}x${height}` : resolvedSizeMode;
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
      model,
      imageSize: supportsNanoImageSize ? nanoImageSize : undefined
    });
  };

  const imageAttachments = inputImages.length ? (
    <div className="composer-attachments mode-sensitive" aria-label="参考图片">
      {inputImages.map((image) => (
        <div className="composer-attachment" key={image.url}>
          <button type="button" className="composer-attachment-preview" onClick={() => setPreviewImage(image)} title="放大预览" aria-label={`预览 ${image.originalName}`}>
            <img src={image.url} alt={image.originalName} />
          </button>
          <Button type="button" variant="secondary" size="icon-xs" onClick={() => removeImage(image.url)} aria-label={`移除 ${image.originalName}`}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  ) : null;

  const renderQualitySelect = (id?: string, side: "top" | "bottom" = "bottom") => (
    <Select value={thinking} onValueChange={(value) => setThinking(value as ThinkingValue)}>
      <SelectTrigger id={id} aria-label="Quality" className="composer-select-trigger">
        <SelectValue>{thinking}</SelectValue>
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
      <SelectTrigger id={id} aria-label={isNanoBanana ? "比例" : "Size"} className="composer-select-trigger">
        <SelectValue>{currentSizeOptions.find((option) => option.value === sizeMode)?.label ?? "auto"}</SelectValue>
      </SelectTrigger>
      <SelectContent side={side} sideOffset={6} position="popper" align="start" className="composer-select-content size-select-content">
        <SelectGroup>
          {currentSizeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="composer-select-item">
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const renderNanoImageSizeSelect = (id?: string, side: "top" | "bottom" = "bottom") => (
    <Select key={model} value={nanoImageSize} onValueChange={(value) => setNanoImageSize(value as NanoImageSize)}>
      <SelectTrigger id={id} aria-label="分辨率" className="composer-select-trigger">
        <span data-slot="select-value">{nanoImageSize}</span>
      </SelectTrigger>
      <SelectContent side={side} sideOffset={6} position="popper" align="start" className="composer-select-content">
        <SelectGroup>
          {nanoImageSizeOptions.map((option) => (
            <SelectItem key={option} value={option} className="composer-select-item">
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const renderModelSelect = (id?: string, side: "top" | "bottom" = "bottom") => (
    <Select value={model} onValueChange={(value) => setModel(value as SupportedImageModel)}>
      <SelectTrigger id={id} aria-label="模型" className="composer-select-trigger">
        <SelectValue>{model}</SelectValue>
      </SelectTrigger>
      <SelectContent side={side} sideOffset={6} position="popper" align="start" className="composer-select-content model-select-content">
        {imageModelGroups.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="model-select-label">{group.label}</SelectLabel>
            {group.options.map((option) => (
              <SelectItem key={option.value} value={option.value} className="composer-select-item">
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  if (variant === "composer") {
    if (isCollapsed) {
      return (
        <div 
          className="create-panel composer-panel composer-collapsed cursor-pointer flex items-center justify-between" 
          onClick={() => setIsCollapsed(false)}
          title="展开创作面板"
        >
          <div className="flex items-center gap-2 font-bold text-muted-foreground hover:text-foreground transition-colors">
            <PenLine size={16} />
            <span>展开创作面板...</span>
          </div>
        </div>
      );
    }

    return (
      <>
        <form
          ref={panelRef}
          className="create-panel composer-panel"
          onSubmit={submit}
          onDragEnter={dragImages}
          onDragOver={holdDraggedImages}
          onDragLeave={leaveDraggedImages}
          onDrop={dropImages}
          noValidate
        >
          <div className="composer-floating-controls">
            <div className={`composer-fields ${!isNanoBanana && sizeMode === "custom" ? "has-custom-size" : ""}`} data-tour="composer-options">
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
                <FieldLabel htmlFor="composer-quality">{isNanoBanana ? "分辨率" : "Quality"}</FieldLabel>
                {isNanoBanana && supportsNanoImageSize
                  ? renderNanoImageSizeSelect("composer-quality", "top")
                  : isNanoBanana
                    ? <Input id="composer-quality" value="自动" readOnly aria-label="分辨率" />
                    : renderQualitySelect("composer-quality", "top")}
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="composer-size">{isNanoBanana ? "比例" : "Size"}</FieldLabel>
                {renderSizeSelect("composer-size", "top")}
              </Field>
              {!isNanoBanana && sizeMode === "custom" ? (
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
                {renderModelSelect("composer-model", "top")}
              </Field>
            </div>

            {notice ? (
              <div className="notice-line composer-notice">
                <MousePointer2 size={15} />
                <span>{inputImages.length > 0 ? "检测到图片，将自动使用图生图" : notice}</span>
              </div>
            ) : null}

            <Button 
              type="button" 
              variant="ghost" 
              size="icon-sm" 
              className="ml-auto flex-shrink-0" 
              onClick={() => setIsCollapsed(true)} 
              title="收起面板"
            >
              <ChevronDown size={18} />
            </Button>
          </div>

          <Field className="composer-input-field">
            <FieldLabel htmlFor="composer-prompt" className="sr-only">提示词</FieldLabel>
            <InputGroup className={`composer-input-shell ${inputImages.length > 0 ? "has-attachments" : ""}${isDragActive ? " is-dragging" : ""}`} onPaste={pasteImages} data-tour="composer">
              {imageAttachments}
              <InputGroupTextarea
                id="composer-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onPaste={pasteImages}
                placeholder="描述你想生成的画面"
              />
              <InputGroupAddon className="composer-actions absolute bottom-2 right-2 flex items-center gap-2">
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
          </Field>
        </form>
        <ReferenceImagePreview image={previewImage} onClose={() => setPreviewImage(null)} />
      </>
    );
  }

  return (
    <>
    <form
      ref={panelRef}
      className="create-panel"
      onSubmit={submit}
      onDragEnter={dragImages}
      onDragOver={holdDraggedImages}
      onDragLeave={leaveDraggedImages}
      onDrop={dropImages}
      noValidate
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">绘图任务</p>
          <h2>创建绘制</h2>
        </div>
        <Play size={24} />
      </div>

      <div className="reference-upload-group">
        <label className={`upload-box${isDragActive ? " is-dragging" : ""}${inputImages.length > 0 ? " has-attachments" : ""}`}>
          <input type="file" accept="image/*" multiple onChange={uploadImage} />
          {isUploading ? <Loader2 className="spin" size={22} /> : <ImagePlus size={22} />}
          {inputImages.length === 0 && <span>上传参考图片</span>}
        </label>

        {imageAttachments}
      </div>

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
          <FieldLabel>{isNanoBanana ? "比例" : "Size"}</FieldLabel>
          {renderSizeSelect()}
        </Field>
      </div>

      {!isNanoBanana && sizeMode === "custom" ? (
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
          <FieldLabel>{isNanoBanana ? "分辨率" : "Quality"}</FieldLabel>
          {isNanoBanana && supportsNanoImageSize
            ? renderNanoImageSizeSelect()
            : isNanoBanana
              ? <Input value="自动" readOnly aria-label="分辨率" />
              : renderQualitySelect()}
        </Field>
        <Field>
          <FieldLabel>模型</FieldLabel>
          {renderModelSelect()}
        </Field>
      </div>



      <Button type="submit" disabled={isSubmitting || isUploading}>
        {isSubmitting ? <Loader2 className="spin" data-icon="inline-start" /> : <ImageUp data-icon="inline-start" />}
        {isSubmitting ? "加入中" : "加入绘制队列"}
      </Button>
    </form>
    <ReferenceImagePreview image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );
}
