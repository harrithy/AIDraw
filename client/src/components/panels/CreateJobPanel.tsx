import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BookOpen, ChevronDown, Image as ImageIcon, ImagePlus, ImageUp, Loader2, MousePointer2, Music, PenLine, Play, Shapes, Sparkles, Video, Wrench, X } from "lucide-react";
import { type ChangeEvent, type ClipboardEvent, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DuomiApiDocDialog } from "../modals/DuomiApiDocDialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Message } from "@/components/ui/message";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { DuomiCapabilityFields } from "./DuomiCapabilityFields";
import {
  DUOMI_CATEGORY_LABELS,
  getDuomiCapabilitiesByCategory,
  getDuomiCapability,
  getDuomiCapabilityDefaultValues,
  isDuomiCapabilitySubmittable,
  type DuomiCapability,
  type DuomiCapabilityOutputKind
} from "../../lib/duomiCapabilities";
import {
  GPT_IMAGE_MODEL,
  GROK_VIDEO_MODEL_1_5,
  MAX_NANO_BANANA_REFERENCE_IMAGES,
  getImageModelGroups,
  isGptImageVipModel,
  isGrokVideoModel,
  isImageModelAvailableForProvider,
  isKlingVideoModel,
  isNanoBananaModel,
  isSupportedImageModel,
  supportsExtendedNanoAspectRatios,
  supportsNanoBananaImageSize,
  isVideoModel,
  type SupportedImageModel
} from "../../lib/imageModels";

const grokVideoSizeOptions: Array<{ label: string; value: SizeMode }> = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
  { label: "3:2", value: "3:2" },
  { label: "2:3", value: "2:3" }
];

const klingVideoSizeOptions: Array<{ label: string; value: SizeMode }> = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" }
];

const klingVideoDurationOptions: Array<{ label: string; value: number }> = [
  { label: "5 秒", value: 5 },
  { label: "10 秒", value: 10 }
];

const grokVideo15DurationOptions: Array<{ label: string; value: number }> = [
  { label: "6 秒 (¥0.30)", value: 6 },
  { label: "10 秒 (¥0.50 - 默认)", value: 10 },
  { label: "15 秒 (¥0.75)", value: 15 }
];

const grokVideoBaseDurationOptions: Array<{ label: string; value: number }> = [
  { label: "6 秒 (¥0.24)", value: 6 },
  { label: "10 秒 (¥0.40 - 默认)", value: 10 },
  { label: "15 秒 (¥0.60)", value: 15 },
  { label: "20 秒 (¥0.80)", value: 20 },
  { label: "25 秒 (¥1.00)", value: 25 },
  { label: "30 秒 (¥1.20)", value: 30 }
];
import { getCustomSizeError, getCustomSizeSuggestion } from "../../lib/customImageSize";
import { type KlingSound } from "../../lib/klingPricing";
import { formatModelPrice, getModelPrice } from "../../lib/modelPricing";
import { prefersReducedMotion } from "../../lib/motion";
import type {
  ApiProviderId,
  CapabilityCategory,
  CreateJobPayload,
  DrawMode,
  DrawSize,
  NanoImageSize,
  PresetDrawSize
} from "../../types";
import type { ThinkingValue } from "../../types/ui";

/** 文件上传结果 */
type UploadResult = {
  url: string;
  originalName: string;
};

type CreateJobPanelProps = {
  activeFolderId?: string | null;
  apiProviderId: ApiProviderId;
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

const getDraftKey = (folderId: string) => `aidraw-draft-${folderId}`;

interface FolderDraft {
  prompt: string;
  count: number;
  sizeMode: SizeMode;
  customWidth: string;
  customHeight: string;
  thinking: ThinkingValue;
  model: SupportedImageModel;
  nanoImageSize: NanoImageSize;
  videoDuration?: number;
  sound?: KlingSound;
  inputImages: UploadResult[];
  creationMode?: "model" | "capability";
  capabilityCategory?: CapabilityCategory;
  capabilityId?: string;
  capabilityValues?: Record<string, unknown>;
}

const capabilityCategories = Object.keys(DUOMI_CATEGORY_LABELS) as CapabilityCategory[];

const capabilityStatusLabel: Record<DuomiCapability["status"], string> = {
  released: "可用",
  developing: "开发中",
  obsolete: "已废弃",
  disabled: "已停用"
};

const capabilityOutputKind = (
  outputKind: DuomiCapabilityOutputKind
): NonNullable<CreateJobPayload["outputKind"]> => {
  if (outputKind === "music") return "audio";
  if (outputKind === "lyrics") return "text";
  return outputKind;
};

const hasCapabilityValue = (value: unknown) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const getCapabilityPrompt = (item: DuomiCapability, values: Record<string, unknown>, fallback: string) => {
  const primaryKeys = ["prompt", "user_prompt", "text", "title", "effect_scene"];
  const primaryValue = primaryKeys
    .map((key) => values[key])
    .find((value) => typeof value === "string" && value.trim());
  return (typeof primaryValue === "string" ? primaryValue.trim() : "") || fallback.trim() || item.name;
};

const loadDraft = (folderId: string): FolderDraft | null => {
  try {
    const data = localStorage.getItem(getDraftKey(folderId));
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error("Error loading draft", e);
  }
  return null;
};

const saveDraft = (folderId: string, draft: FolderDraft) => {
  try {
    localStorage.setItem(getDraftKey(folderId), JSON.stringify(draft));
  } catch (e) {
    console.error("Error saving draft", e);
  }
};

export function CreateJobPanel({
  activeFolderId,
  apiProviderId,
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
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [sound, setSound] = useState<KlingSound>("on");
  const [inputImages, setInputImages] = useState<UploadResult[]>([]);
  const [creationMode, setCreationMode] = useState<"model" | "capability">("model");
  const [capabilityCategory, setCapabilityCategory] = useState<CapabilityCategory>("image");
  const [capabilityId, setCapabilityId] = useState("image.gpt-image-2");
  const [capabilityValues, setCapabilityValues] = useState<Record<string, unknown>>({});
  const [previewImage, setPreviewImage] = useState<UploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDocOpen, setIsDocOpen] = useState(false);
  const dragDepthRef = useRef(0);
  const currentMode: DrawMode = inputImages.length > 0 ? "image-to-image" : "text-to-image";
  const isNanoBanana = isNanoBananaModel(model);
  const isGrokVideo = isGrokVideoModel(model);
  const isKlingVideo = isKlingVideoModel(model);
  const isVideo = isVideoModel(model);
  const usesCapability = apiProviderId === "duomi" && creationMode === "capability";
  const categoryCapabilities = useMemo(() => getDuomiCapabilitiesByCategory(capabilityCategory), [capabilityCategory]);
  const selectedCapability = getDuomiCapability(capabilityId) ?? categoryCapabilities[0];
  const isDuomiNanoBanana = apiProviderId === "duomi" && isNanoBanana;
  const supportsNanoImageSize = supportsNanoBananaImageSize(model);
  const imageModelGroups = getImageModelGroups(apiProviderId);
  const currentSizeOptions = isKlingVideo
    ? klingVideoSizeOptions
    : isGrokVideo
      ? grokVideoSizeOptions
      : isNanoBanana
        ? apiProviderId === "grsai" && supportsExtendedNanoAspectRatios(model)
          ? extendedNanoAspectRatioOptions
          : nanoAspectRatioOptions
        : apiProviderId === "grsai" && isGptImageVipModel(model)
          ? grsaiGptVipSizeOptions
          : apiProviderId === "grsai"
            ? grsaiGptSizeOptions
            : gptSizeOptions;

  const currentVideoDurationOptions = isKlingVideo
    ? klingVideoDurationOptions
    : model === GROK_VIDEO_MODEL_1_5
      ? grokVideo15DurationOptions
      : grokVideoBaseDurationOptions;

  /** 模型预计价格：Kling/GROK 视频按查表或按秒，图片模型按固定单价；无价格时返回 null */
  const modelPrice = getModelPrice(model, thinking === "high" ? "pro" : "std", videoDuration, sound);

  const isUpdatingDraftRef = useRef(false);

  // Load draft when activeFolderId changes
  useEffect(() => {
    if (!activeFolderId) return;

    isUpdatingDraftRef.current = true;
    const draft = loadDraft(activeFolderId);
    if (draft) {
      setPrompt(draft.prompt ?? "");
      setCount(draft.count ?? 1);
      setSizeMode(draft.sizeMode ?? "auto");
      setCustomWidth(draft.customWidth ?? "1024");
      setCustomHeight(draft.customHeight ?? "1024");
      setThinking(qualityOptions.includes(draft.thinking) ? draft.thinking : "high");
      setModel(isSupportedImageModel(draft.model) ? draft.model : GPT_IMAGE_MODEL);
      setNanoImageSize(draft.nanoImageSize ?? "4K");
      setVideoDuration(draft.videoDuration ?? 10);
      setSound(draft.sound ?? "on");
      setInputImages(draft.inputImages ?? []);
      setCreationMode(draft.creationMode === "capability" && apiProviderId === "duomi" ? "capability" : "model");
      setCapabilityCategory(draft.capabilityCategory ?? "image");
      setCapabilityId(draft.capabilityId ?? "image.gpt-image-2");
      setCapabilityValues(draft.capabilityValues ?? {});
    } else {
      setPrompt("");
      setCount(1);
      setSizeMode("auto");
      setCustomWidth("1024");
      setCustomHeight("1024");
      setThinking("high");
      setModel(GPT_IMAGE_MODEL);
      setNanoImageSize("4K");
      setVideoDuration(10);
      setSound("on");
      setInputImages([]);
      setCreationMode("model");
      setCapabilityCategory("image");
      setCapabilityId("image.gpt-image-2");
      setCapabilityValues({});
    }

    const timer = setTimeout(() => {
      isUpdatingDraftRef.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [activeFolderId]);

  // Save draft when form fields change
  useEffect(() => {
    if (!activeFolderId || isUpdatingDraftRef.current) return;

    saveDraft(activeFolderId, {
      prompt,
      count,
      sizeMode,
      customWidth,
      customHeight,
      thinking,
      model,
      nanoImageSize,
      videoDuration,
      sound,
      inputImages,
      creationMode,
      capabilityCategory,
      capabilityId,
      capabilityValues
    });
  }, [
    activeFolderId,
    prompt,
    count,
    sizeMode,
    customWidth,
    customHeight,
    thinking,
    model,
    nanoImageSize,
    videoDuration,
    sound,
    inputImages,
    creationMode,
    capabilityCategory,
    capabilityId,
    capabilityValues
  ]);

  useEffect(() => {
    if (apiProviderId !== "duomi" && creationMode === "capability") setCreationMode("model");
  }, [apiProviderId, creationMode]);

  useEffect(() => {
    if (selectedCapability?.category === capabilityCategory) return;
    const nextCapability = categoryCapabilities[0];
    if (!nextCapability) return;
    setCapabilityId(nextCapability.id);
    setCapabilityValues(getDuomiCapabilityDefaultValues(nextCapability));
  }, [capabilityCategory, categoryCapabilities, selectedCapability]);

  useEffect(() => {
    if (!currentSizeOptions.some((option) => option.value === sizeMode)) {
      setSizeMode(isVideo ? "16:9" : "auto");
    }
  }, [currentSizeOptions, sizeMode, isVideo]);

  useEffect(() => {
    if (isVideo && !currentVideoDurationOptions.some((opt) => opt.value === videoDuration)) {
      setVideoDuration(isKlingVideo ? 5 : 10);
    }
  }, [isVideo, isKlingVideo, currentVideoDurationOptions, videoDuration]);

  useEffect(() => {
    if (!isImageModelAvailableForProvider(model, apiProviderId)) {
      setModel(GPT_IMAGE_MODEL);
    }
  }, [apiProviderId, model]);

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
    if (isDuomiNanoBanana && inputImages.length >= MAX_NANO_BANANA_REFERENCE_IMAGES) {
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
    if (!usesCapability && !nextPrompt) {
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

    if (usesCapability) {
      if (!selectedCapability) {
        Message.error("请选择多米能力");
        return;
      }
      if (!isDuomiCapabilitySubmittable(selectedCapability)) {
        Message.error(`${selectedCapability.name}当前${capabilityStatusLabel[selectedCapability.status]}，不能提交`);
        return;
      }
      const missingField = selectedCapability.fields.find(
        (field) => field.required && !hasCapabilityValue(capabilityValues[field.key] ?? field.defaultValue)
      );
      if (missingField) {
        Message.error(`请填写${missingField.label}`);
        return;
      }

      const normalizedParams = Object.fromEntries(
        selectedCapability.fields
          .map((field) => [field.key, capabilityValues[field.key] ?? field.defaultValue] as const)
          .filter(([, value]) => value !== undefined && value !== "")
      );
      await onSubmit({
        mode: "text-to-image",
        prompt: getCapabilityPrompt(selectedCapability, normalizedParams, nextPrompt),
        width: 1024,
        height: 1024,
        size: "auto",
        count: 1,
        thinking: "high",
        model: selectedCapability.name,
        capabilityId: selectedCapability.id,
        category: selectedCapability.category,
        outputKind: capabilityOutputKind(selectedCapability.outputKind),
        capabilityParams: normalizedParams,
        estimatedPriceLabel: selectedCapability.priceLabel
      });
      return;
    }

    const inputImageUrls = inputImages.map((image) => image.url);
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

    const requestSize: DrawSize = isVideo
      ? (resolvedSizeMode === "custom" || resolvedSizeMode === "auto" ? "16:9" : resolvedSizeMode)
      : resolvedSizeMode === "custom"
        ? `${width}x${height}`
        : resolvedSizeMode;

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
      imageSize: supportsNanoImageSize ? nanoImageSize : undefined,
      duration: isVideo ? videoDuration : undefined,
      sound: isKlingVideo ? sound : undefined
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
      <SelectTrigger id={id} aria-label={isVideo || isNanoBanana ? "比例" : "Size"} className="composer-select-trigger">
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

  const renderVideoDurationSelect = (id?: string, side: "top" | "bottom" = "bottom") => (
    <Select value={String(videoDuration)} onValueChange={(val) => setVideoDuration(Number(val))}>
      <SelectTrigger id={id} aria-label="时长" className="composer-select-trigger">
        <SelectValue>{currentVideoDurationOptions.find((opt) => opt.value === videoDuration)?.label ?? `${videoDuration}秒`}</SelectValue>
      </SelectTrigger>
      <SelectContent side={side} sideOffset={6} position="popper" align="start" className="composer-select-content">
        <SelectGroup>
          {currentVideoDurationOptions.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)} className="composer-select-item">
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const renderSoundSwitch = (id?: string) => (
    <Switch
      id={id}
      checked={sound === "on"}
      onCheckedChange={(checked) => setSound(checked ? "on" : "off")}
      aria-label="音画同步"
      title={sound === "on" ? "关闭音画同步" : "开启音画同步"}
    />
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

  const renderCreationMode = () =>
    apiProviderId === "duomi" ? (
      <div className="capability-mode-switch" aria-label="创作方式">
        <Button
          type="button"
          variant={creationMode === "model" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCreationMode("model")}
        >
          <Sparkles data-icon="inline-start" />
          模型
        </Button>
        <Button
          type="button"
          variant={creationMode === "capability" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCreationMode("capability")}
        >
          <Shapes data-icon="inline-start" />
          多米能力
        </Button>
      </div>
    ) : null;

  const renderCapabilityPanel = (side: "top" | "bottom" = "bottom") => {
    if (!usesCapability || !selectedCapability) return null;
    const providers = Array.from(new Set(categoryCapabilities.map((item) => item.provider)));

    return (
      <section className="duomi-capability-panel" aria-label="多米能力配置">
        <div className="duomi-capability-header">
          <div className="duomi-category-tabs" role="tablist" aria-label="能力分类">
            {capabilityCategories.map((category) => {
              const Icon = category === "image" ? ImageIcon : category === "video" ? Video : category === "music" ? Music : Wrench;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={capabilityCategory === category}
                  className={capabilityCategory === category ? "selected" : ""}
                  onClick={() => setCapabilityCategory(category)}
                >
                  <Icon size={14} />
                  <span>{DUOMI_CATEGORY_LABELS[category]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <Select
              value={selectedCapability.id}
              onValueChange={(value) => {
                const nextCapability = getDuomiCapability(value);
                if (!nextCapability) return;
                setCapabilityId(value);
                setCapabilityValues(getDuomiCapabilityDefaultValues(nextCapability));
              }}
            >
              <SelectTrigger aria-label="多米能力" className="duomi-capability-trigger flex-1 max-w-[280px]">
                <SelectValue>{selectedCapability.name}</SelectValue>
              </SelectTrigger>
              <SelectContent side={side} sideOffset={6} position="popper" align="start" className="duomi-capability-select-content">
                {providers.map((provider) => (
                  <SelectGroup key={provider}>
                    <SelectLabel>{provider}</SelectLabel>
                    {categoryCapabilities
                      .filter((item) => item.provider === provider)
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="duomi-capability-option">
                            <strong>{item.name}</strong>
                            <small>{item.priceLabel} · {capabilityStatusLabel[item.status]}</small>
                          </span>
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="duomi-doc-btn flex-shrink-0 h-10 px-3 gap-1.5 font-semibold"
              onClick={() => setIsDocOpen(true)}
              title="查看多米 API 官方接口使用文档"
            >
              <BookOpen size={15} className="text-[var(--green)]" />
              <span className="hidden sm:inline text-xs">文档</span>
            </Button>
          </div>
        </div>

        <div className={`duomi-capability-summary status-${selectedCapability.status}`}>
          <div className="duomi-summary-header flex items-center justify-between w-full flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="duomi-provider-tag">{selectedCapability.provider}</span>
              <strong className="duomi-price-highlight">{selectedCapability.priceLabel}</strong>
              <em className="duomi-status-badge">{capabilityStatusLabel[selectedCapability.status]}</em>
            </div>
            {selectedCapability.priceNote ? <span className="duomi-price-note">{selectedCapability.priceNote}</span> : null}
          </div>
          {selectedCapability.description ? <p className="duomi-desc">{selectedCapability.description}</p> : null}
        </div>

        <DuomiCapabilityFields
          capability={selectedCapability}
          values={capabilityValues}
          onChange={(key, value) => setCapabilityValues((current) => ({ ...current, [key]: value }))}
        />

        <DuomiApiDocDialog open={isDocOpen} onOpenChange={setIsDocOpen} />
      </section>
    );
  };

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
          {renderCreationMode()}
          {usesCapability ? renderCapabilityPanel("top") : null}
          <div className="composer-floating-controls">
            {!usesCapability ? <div className={`composer-fields ${!isNanoBanana && sizeMode === "custom" ? "has-custom-size" : ""}`} data-tour="composer-options">
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
                <FieldLabel htmlFor="composer-quality">{isVideo ? "时长" : isNanoBanana ? "分辨率" : "Quality"}</FieldLabel>
                {isVideo
                  ? renderVideoDurationSelect("composer-quality", "top")
                  : isNanoBanana && supportsNanoImageSize
                    ? renderNanoImageSizeSelect("composer-quality", "top")
                    : isNanoBanana
                      ? <Input id="composer-quality" value="自动" readOnly aria-label="分辨率" />
                      : apiProviderId === "grsai"
                        ? <Input id="composer-quality" value="自动" readOnly aria-label="Quality" />
                        : renderQualitySelect("composer-quality", "top")}
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="composer-size">{isVideo || isNanoBanana ? "比例" : "Size"}</FieldLabel>
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
              {isKlingVideo ? (
                <Field orientation="horizontal" className="kling-sound-field">
                  <FieldLabel htmlFor="composer-sound">音画同步</FieldLabel>
                  {renderSoundSwitch("composer-sound")}
                </Field>
              ) : null}
              {modelPrice !== null ? (
                <div className="kling-price-pill" title={`预计价格：${formatModelPrice(modelPrice)}`}>
                  <span>预计</span>
                  <strong>{formatModelPrice(modelPrice)}</strong>
                </div>
              ) : null}
            </div> : (
              <div className="duomi-capability-active-label">
                <Shapes size={15} />
                <span>{selectedCapability?.name}</span>
              </div>
            )}

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

          {!usesCapability ? <Field className="composer-input-field">
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
                {notice ? (
                  <div className="notice-line composer-notice-inline">
                    <MousePointer2 size={14} />
                    <span>{inputImages.length > 0 ? "检测到图片，将自动使用图生图" : notice}</span>
                  </div>
                ) : null}
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
          </Field> : (
            <div className="duomi-capability-submit-row">
              <span>{selectedCapability?.priceLabel}</span>
              <Button
                className="composer-submit"
                type="submit"
                disabled={isSubmitting || !selectedCapability || !isDuomiCapabilitySubmittable(selectedCapability)}
              >
                {isSubmitting ? <Loader2 className="spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                <span>{isSubmitting ? "加入中" : "加入队列"}</span>
              </Button>
            </div>
          )}
        </form>
        <ReferenceImagePreview image={previewImage} onClose={() => setPreviewImage(null)} />
      </>
    );
  }

  if (usesCapability) {
    return (
      <>
        <form ref={panelRef} className="create-panel" onSubmit={submit} noValidate>
          {renderCreationMode()}
          <div className="panel-title">
            <div>
              <p className="eyebrow">多米能力</p>
              <h2>{selectedCapability?.name ?? "选择能力"}</h2>
            </div>
            <Shapes size={24} />
          </div>
          {renderCapabilityPanel()}
          <Button
            type="submit"
            disabled={isSubmitting || !selectedCapability || !isDuomiCapabilitySubmittable(selectedCapability)}
          >
            {isSubmitting ? <Loader2 className="spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            {isSubmitting ? "加入中" : "加入能力任务队列"}
          </Button>
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
      {renderCreationMode()}
      <div className="panel-title">
        <div>
          <p className="eyebrow">{isVideo ? "视频任务" : "绘图任务"}</p>
          <h2>{isVideo ? "创建视频" : "创建绘制"}</h2>
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
          <FieldLabel>{isVideo || isNanoBanana ? "比例" : "Size"}</FieldLabel>
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
          <FieldLabel>{isVideo ? "时长" : isNanoBanana ? "分辨率" : "Quality"}</FieldLabel>
          {isVideo
            ? renderVideoDurationSelect()
            : isNanoBanana && supportsNanoImageSize
              ? renderNanoImageSizeSelect()
              : isNanoBanana
                ? <Input value="自动" readOnly aria-label="分辨率" />
                : apiProviderId === "grsai"
                  ? <Input value="自动" readOnly aria-label="Quality" />
                  : renderQualitySelect()}
        </Field>
        <Field>
          <FieldLabel>模型</FieldLabel>
          {renderModelSelect()}
        </Field>
      </div>

      {isKlingVideo ? (
        <div className="form-grid">
          <Field>
            <FieldLabel>音画同步</FieldLabel>
            {renderSoundSwitch()}
          </Field>
          <Field>
            <FieldLabel>预计价格</FieldLabel>
            <div className="kling-price-value">{formatModelPrice(modelPrice)}</div>
          </Field>
        </div>
      ) : modelPrice !== null ? (
        <Field>
          <FieldLabel>预计价格</FieldLabel>
          <div className="kling-price-value">{formatModelPrice(modelPrice)}</div>
        </Field>
      ) : null}



      <Button type="submit" disabled={isSubmitting || isUploading}>
        {isSubmitting ? <Loader2 className="spin" data-icon="inline-start" /> : <ImageUp data-icon="inline-start" />}
        {isSubmitting ? "加入中" : "加入绘制队列"}
      </Button>
    </form>
    <ReferenceImagePreview image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );
}
