import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ImagePlus, ImageUp, Loader2, MousePointer2, Play, X } from "lucide-react";
import { ChangeEvent, ClipboardEvent, FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prefersReducedMotion } from "../../lib/motion";
import type { CreateJobPayload, DrawMode } from "../../types";
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

export function CreateJobPanel({ isSubmitting, notice, variant = "panel", onSubmit, onUploadImage }: CreateJobPanelProps) {
  const panelRef = useRef<HTMLFormElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [thinking, setThinking] = useState<ThinkingValue>("high");
  const [inputImages, setInputImages] = useState<UploadResult[]>([]);
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
    const filesFromItems = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const files = filesFromItems.length > 0 ? filesFromItems : Array.from(event.clipboardData.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    void uploadFiles(imageFiles);
  };

  const removeImage = (url: string) => {
    setInputImages((current) => current.filter((image) => image.url !== url));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      setUploadError("请先填写提示词");
      return;
    }

    const inputImageUrls = inputImages.map((image) => image.url);
    setUploadError("");
    await onSubmit({
      mode: currentMode,
      prompt: nextPrompt,
      inputImageUrl: inputImageUrls[0],
      inputImageUrls,
      width: 1024,
      height: 1024,
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

  if (variant === "composer") {
    return (
      <form ref={panelRef} className="create-panel composer-panel" onSubmit={submit}>
        <div className="composer-floating-controls">
          <div className="composer-fields">
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
              <FieldLabel>Thinking</FieldLabel>
              <Select value={thinking} onValueChange={(value) => setThinking(value as ThinkingValue)}>
                <SelectTrigger aria-label="Thinking" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="high">high</SelectItem>
                    <SelectItem value="medium">medium</SelectItem>
                    <SelectItem value="low">low</SelectItem>
                    <SelectItem value="standard">standard</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
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
              placeholder="描述你想生成的画面，或直接粘贴图片作为参考"
              aria-invalid={Boolean(uploadError)}
            />
            <InputGroupAddon align="inline-end" className="composer-actions">
              <Button type="button" variant="outline" size="icon" asChild title="添加参考图片">
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
          {uploadError ? <FieldError className="composer-error">{uploadError}</FieldError> : null}
        </Field>
      </form>
    );
  }

  return (
    <form ref={panelRef} className="create-panel" onSubmit={submit}>
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
        <span>{inputImages.length > 0 ? `${inputImages.length} 张参考图` : "可选参考图片"}</span>
      </label>

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
          <Input value="auto" readOnly />
        </Field>
      </div>

      <div className="form-grid">
        <Field>
          <FieldLabel>Thinking</FieldLabel>
          <Select value={thinking} onValueChange={(value) => setThinking(value as ThinkingValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="high">high</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="low">low</SelectItem>
                <SelectItem value="standard">standard</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
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
