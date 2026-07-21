import { ImagePlus, Loader2, X } from "lucide-react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Message } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  GPT_IMAGE_MODEL,
  MAX_NANO_BANANA_REFERENCE_IMAGES,
  getImageModelGroups,
  isGptImageVipModel,
  isImageModelAvailableForProvider,
  isNanoBananaModel,
  isSupportedImageModel,
  supportsExtendedNanoAspectRatios,
  supportsNanoBananaImageSize,
  type SupportedImageModel
} from "../../lib/imageModels";
import { getCustomSizeError, getCustomSizeSuggestion } from "../../lib/customImageSize";
import type { ApiProviderId, DrawJob, DrawSize, NanoImageSize, PresetDrawSize } from "../../types";
import type { ThinkingValue } from "../../types/ui";

type UploadResult = {
  url: string;
  originalName: string;
};

export type RegenerateEdits = {
  prompt: string;
  model: string;
  size: DrawSize;
  thinking: ThinkingValue;
  imageSize?: NanoImageSize;
  inputImageUrls: string[];
};

type RegenerateEditDialogProps = {
  apiProviderId: ApiProviderId;
  open: boolean;
  job: DrawJob | null;
  isSubmitting: boolean;
  onClose: () => void;
  onUploadImage: (file: File) => Promise<UploadResult>;
  onConfirm: (jobId: string, edits: RegenerateEdits) => Promise<void>;
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

const extendedNanoAspectRatioOptions: Array<{ label: string; value: SizeMode }> = [
  ...nanoAspectRatioOptions,
  { label: "1:4", value: "1:4" },
  { label: "4:1", value: "4:1" },
  { label: "1:8", value: "1:8" },
  { label: "8:1", value: "8:1" }
];

const grsaiGptSizeOptions: Array<{ label: string; value: SizeMode }> = [
  { label: "auto", value: "auto" },
  { label: "1024x1024", value: "1024x1024" },
  ...gptSizeOptions.filter((option) => option.value.includes(":")),
  { label: "21:9", value: "21:9" },
  { label: "9:21", value: "9:21" }
];
const grsaiGptVipSizeOptions = gptSizeOptions.filter(
  (option) => option.value === "auto" || option.value === "custom" || /^\d+x\d+$/.test(option.value)
);

const qualityOptions: ThinkingValue[] = ["high", "medium", "low"];
const nanoImageSizeOptions: NanoImageSize[] = ["1K", "2K", "4K"];

const parseCustomDimension = (value: string) => Number.parseInt(value.trim(), 10);

const getImageFiles = (files: FileList | File[]) =>
  Array.from(files).filter((file) => file.type.startsWith("image/"));

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

/**
 * 把已保存的 job.size 反推成编辑器里的尺寸模式 + 自定义宽高
 * 自定义尺寸（`宽x高`）拆出宽高供输入框预填，预设值直接用作 sizeMode
 */
const deriveSizeState = (size: DrawSize | undefined) => {
  const value = (size ?? "auto") as string;
  const custom = /^(\d+)x(\d+)$/.exec(value);
  if (custom) {
    return { sizeMode: "custom" as SizeMode, customWidth: custom[1], customHeight: custom[2] };
  }
  return { sizeMode: (value || "auto") as SizeMode, customWidth: "1024", customHeight: "1024" };
};

const normalizeThinking = (value: DrawJob["thinking"]): ThinkingValue =>
  value === "high" || value === "medium" || value === "low" ? value : "high";

export function RegenerateEditDialog({
  apiProviderId,
  open,
  job,
  isSubmitting,
  onClose,
  onUploadImage,
  onConfirm
}: RegenerateEditDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [sizeMode, setSizeMode] = useState<SizeMode>("auto");
  const [customWidth, setCustomWidth] = useState("1024");
  const [customHeight, setCustomHeight] = useState("1024");
  const [thinking, setThinking] = useState<ThinkingValue>("high");
  const [model, setModel] = useState<SupportedImageModel>(GPT_IMAGE_MODEL);
  const [nanoImageSize, setNanoImageSize] = useState<NanoImageSize>("4K");
  const [inputImages, setInputImages] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);

  const isNanoBanana = isNanoBananaModel(model);
  const isDuomiNanoBanana = apiProviderId === "duomi" && isNanoBanana;
  const supportsNanoImageSize = supportsNanoBananaImageSize(model);
  const imageModelGroups = getImageModelGroups(apiProviderId);
  const currentSizeOptions = isNanoBanana
    ? apiProviderId === "grsai" && supportsExtendedNanoAspectRatios(model)
      ? extendedNanoAspectRatioOptions
      : nanoAspectRatioOptions
    : apiProviderId === "grsai" && isGptImageVipModel(model)
      ? grsaiGptVipSizeOptions
      : apiProviderId === "grsai"
        ? grsaiGptSizeOptions
        : gptSizeOptions;

  // 打开或切换到另一个任务时，用该任务的当前参数预填表单
  useEffect(() => {
    if (!job) return;
    setPrompt(job.prompt);
    setThinking(normalizeThinking(job.thinking));
    setModel(isSupportedImageModel(job.model) ? job.model : GPT_IMAGE_MODEL);
    setNanoImageSize(job.imageSize ?? "4K");
    const derived = deriveSizeState(job.size);
    setSizeMode(derived.sizeMode);
    setCustomWidth(derived.customWidth);
    setCustomHeight(derived.customHeight);
    const urls = job.inputImageUrls?.length
      ? job.inputImageUrls
      : job.inputImageUrl
        ? [job.inputImageUrl]
        : [];
    setInputImages(urls.map((url) => ({ url, originalName: "参考图片" })));
    dragDepthRef.current = 0;
    setIsDragActive(false);
  }, [job]);

  // 模型切换后，若当前 sizeMode 不在新模型的可选项里，回退到 auto
  useEffect(() => {
    if (!currentSizeOptions.some((option) => option.value === sizeMode)) {
      setSizeMode("auto");
    }
  }, [currentSizeOptions, sizeMode]);

  useEffect(() => {
    if (!isImageModelAvailableForProvider(model, apiProviderId)) {
      setModel(GPT_IMAGE_MODEL);
    }
  }, [apiProviderId, model]);

  const uploadFiles = async (files: File[]) => {
    const imageFiles = getImageFiles(files);
    if (imageFiles.length === 0) return;

    let filesToUpload = imageFiles;
    if (isDuomiNanoBanana) {
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
      const uploaded = await Promise.all(filesToUpload.map((file) => onUploadImage(file)));
      setInputImages((current) => [...current, ...uploaded]);
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

  const addReferenceImageUrl = (rawValue: string) => {
    const url = rawValue.trim();
    if (!url) return;
    if (!isRemoteImageUrl(url)) {
      Message.error("参考图片 URL 需要以 http:// 或 https:// 开头");
      return;
    }
    if (isDuomiNanoBanana && inputImages.length >= MAX_NANO_BANANA_REFERENCE_IMAGES) {
      Message.error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
      return;
    }
    const hostname = new URL(url).hostname;
    setInputImages((current) =>
      current.some((image) => image.url === url)
        ? current
        : [...current, { url, originalName: hostname || "参考图片 URL" }]
    );
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!job) return;

    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      Message.error("请先填写提示词");
      return;
    }
    if (isUploading) {
      Message.error("正在上传图片，请稍后再试");
      return;
    }
    if (isDuomiNanoBanana && inputImages.length > MAX_NANO_BANANA_REFERENCE_IMAGES) {
      Message.error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
      return;
    }

    const resolvedSizeMode = currentSizeOptions.some((option) => option.value === sizeMode) ? sizeMode : "auto";
    const width = parseCustomDimension(customWidth);
    const height = parseCustomDimension(customHeight);
    const maxAspectRatio = apiProviderId === "grsai" && isGptImageVipModel(model) ? 3 : undefined;
    const customSizeError = resolvedSizeMode === "custom" ? getCustomSizeError(width, height, maxAspectRatio) : "";
    if (customSizeError) {
      const suggestion = getCustomSizeSuggestion(width, height);
      Message.error(
        customSizeError,
        suggestion
          ? {
              action: {
                label: "填充",
                onClick: () => {
                  if (suggestion.width !== undefined) setCustomWidth(String(suggestion.width));
                  if (suggestion.height !== undefined) setCustomHeight(String(suggestion.height));
                }
              }
            }
          : undefined
      );
      return;
    }

    const requestSize: DrawSize = resolvedSizeMode === "custom" ? `${width}x${height}` : resolvedSizeMode;
    await onConfirm(job.id, {
      prompt: nextPrompt,
      model,
      size: requestSize,
      thinking,
      imageSize: supportsNanoImageSize ? nanoImageSize : undefined,
      inputImageUrls: inputImages.map((image) => image.url)
    });
  };

  const renderQualitySelect = () => (
    <Select value={thinking} onValueChange={(value) => setThinking(value as ThinkingValue)}>
      <SelectTrigger aria-label="Quality" className="composer-select-trigger">
        <SelectValue>{thinking}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="composer-select-content">
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

  const renderSizeSelect = () => (
    <Select value={sizeMode} onValueChange={(value) => setSizeMode(value as SizeMode)}>
      <SelectTrigger aria-label={isNanoBanana ? "比例" : "Size"} className="composer-select-trigger">
        <SelectValue>{currentSizeOptions.find((option) => option.value === sizeMode)?.label ?? "auto"}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="composer-select-content size-select-content">
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

  const renderNanoImageSizeSelect = () => (
    <Select key={model} value={nanoImageSize} onValueChange={(value) => setNanoImageSize(value as NanoImageSize)}>
      <SelectTrigger aria-label="分辨率" className="composer-select-trigger">
        <span data-slot="select-value">{nanoImageSize}</span>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="composer-select-content">
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

  const renderModelSelect = () => (
    <Select value={model} onValueChange={(value) => setModel(value as SupportedImageModel)}>
      <SelectTrigger aria-label="模型" className="composer-select-trigger">
        <SelectValue>{model}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="composer-select-content model-select-content">
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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isSubmitting) onClose(); }}>
      <DialogContent showCloseButton={!isSubmitting} className="regenerate-edit-dialog sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>重新编辑并绘制</DialogTitle>
          <DialogDescription>修改参数后重新绘制，结果会作为新版本更新到当前任务卡片。</DialogDescription>
        </DialogHeader>

        <form
          className="regenerate-edit-form"
          onSubmit={submit}
          onDragEnter={dragImages}
          onDragOver={holdDraggedImages}
          onDragLeave={leaveDraggedImages}
          onDrop={dropImages}
          noValidate
        >
          <Field>
            <FieldLabel>提示词</FieldLabel>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={pasteImages}
              placeholder="描述你想生成的画面"
            />
          </Field>

          <div className="reference-upload-group">
            <label className={`upload-box${isDragActive ? " is-dragging" : ""}${inputImages.length > 0 ? " has-attachments" : ""}`}>
              <input type="file" accept="image/*" multiple onChange={uploadImage} />
              {isUploading ? <Loader2 className="spin" size={20} /> : <ImagePlus size={20} />}
              {inputImages.length === 0 && <span>上传参考图片</span>}
            </label>

            {inputImages.length > 0 ? (
              <div className="composer-attachments" aria-label="参考图片">
                {inputImages.map((image) => (
                  <div className="composer-attachment" key={image.url}>
                    <img src={image.url} alt={image.originalName} />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-xs"
                      onClick={() => removeImage(image.url)}
                      aria-label={`移除 ${image.originalName}`}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="form-grid">
            <Field>
              <FieldLabel>{isNanoBanana ? "分辨率" : "Quality"}</FieldLabel>
              {isNanoBanana && supportsNanoImageSize
                ? renderNanoImageSizeSelect()
                : isNanoBanana
                  ? <Input value="自动" readOnly aria-label="分辨率" />
                  : apiProviderId === "grsai"
                    ? <Input value="自动" readOnly aria-label="Quality" />
                    : renderQualitySelect()}
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

          <Field>
            <FieldLabel>模型</FieldLabel>
            {renderModelSelect()}
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting ? <Loader2 className="spin" data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
              {isSubmitting ? "绘制中" : "重新绘制"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
