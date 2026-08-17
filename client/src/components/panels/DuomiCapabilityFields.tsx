import { useEffect, useId, useRef, useState } from "react";
import {
  Code2,
  FileCode,
  FileImage,
  ImagePlus,
  Link,
  Plus,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DuomiCapability, DuomiCapabilityField } from "../../lib/duomiCapabilities";

type DuomiCapabilityFieldsProps = {
  capability: DuomiCapability;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

type JsonFieldProps = {
  field: DuomiCapabilityField;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
};

type UrlListFieldProps = {
  field: DuomiCapabilityField;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
};

type Base64ImageFieldProps = {
  field: DuomiCapabilityField;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
};

const getFieldValue = (field: DuomiCapabilityField, values: Record<string, unknown>) =>
  values[field.key] ?? field.defaultValue;

const asInputValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
};

const getSelectOptionToken = (value: string | number | boolean) => `${typeof value}:${String(value)}`;

const formatJsonValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getJsonSignature = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatUrlListValue = (value: unknown) =>
  Array.isArray(value) ? value.map(String).join("\n") : typeof value === "string" ? value : "";

const parseUrlListValue = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

function RequiredLabel({ field, htmlFor }: { field: DuomiCapabilityField; htmlFor: string }) {
  return (
    <FieldLabel
      htmlFor={htmlFor}
      title={field.description}
      className="inline-flex flex-row items-center gap-1 font-semibold text-xs text-[var(--ink)] !w-auto cursor-pointer select-none mb-0.5"
    >
      {field.required ? (
        <span className="text-rose-500 font-bold text-xs inline !w-auto mr-0.5" aria-label="必填">
          *
        </span>
      ) : null}
      <span className="inline !w-auto">{field.label}</span>
      {field.description ? (
        <span className="text-[11px] font-normal text-[var(--muted)] truncate max-w-[260px] inline !w-auto ml-1">
          ({field.description})
        </span>
      ) : null}
    </FieldLabel>
  );
}

/**
 * 针对 Base64 图片字段（如 base64Array 混图）的专属智能选择与文件上传组件
 */
function Base64ImageField({ field, id, value, onChange }: Base64ImageFieldProps) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [isProcessing, setIsProcessing] = useState(false);
  const isMultiple = field.key.toLowerCase().includes("array") || field.type === "url-list";

  // 提取当前的 base64 列表
  const imageList = Array.isArray(value)
    ? (value as string[])
    : typeof value === "string" && value.trim()
      ? [value]
      : [];

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    try {
      const readPromises = Array.from(files).map((file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const base64Results = await Promise.all(readPromises);

      if (isMultiple) {
        const nextList = [...imageList, ...base64Results];
        onChange(nextList);
      } else {
        onChange(base64Results[0]);
      }
    } catch (err) {
      console.error("Base64 读取失败", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeImage = (index: number) => {
    if (isMultiple) {
      const nextList = imageList.filter((_, i) => i !== index);
      onChange(nextList.length > 0 ? nextList : undefined);
    } else {
      onChange(undefined);
    }
  };

  return (
    <Field className="duomi-custom-field p-3.5 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-2.5 col-span-full">
      <div className="flex items-center justify-between">
        <RequiredLabel field={field} htmlFor={id} />
        <button
          type="button"
          className="text-[11px] text-[var(--green)] hover:underline font-medium flex items-center gap-1"
          onClick={() => setMode(mode === "file" ? "text" : "file")}
        >
          {mode === "file" ? <Code2 size={13} /> : <FileImage size={13} />}
          <span>{mode === "file" ? "切换为手动输入 Base64" : "切换为本地图片选择"}</span>
        </button>
      </div>

      {mode === "file" ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2.5 items-center">
            {imageList.map((imgUrl, idx) => (
              <div key={idx} className="duomi-image-thumb relative group w-20 h-20 rounded-lg overflow-hidden border border-[var(--line)] bg-black/5 shadow-xs flex-shrink-0 cursor-pointer">
                <img src={imgUrl} alt={`参考图 ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-rose-600 transition-all shadow-xs"
                  title="删除此图"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {(isMultiple || imageList.length === 0) && (
              <label className="duomi-upload-tile w-20 h-20 rounded-lg border-2 border-dashed border-[var(--line-strong)] hover:border-[var(--green)] hover:bg-[var(--hover)] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-[var(--muted)] hover:text-[var(--green)]">
                <input
                  type="file"
                  accept="image/*"
                  multiple={isMultiple}
                  className="sr-only"
                  onChange={(e) => void handleFileUpload(e.target.files)}
                />
                <ImagePlus size={20} className="transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-medium">{isProcessing ? "转换中" : "上传图片"}</span>
              </label>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            {isMultiple ? "支持直接选择 2~5 张图片文件，自动为您编码为 Base64 数组" : "选择一张图片文件，自动转换为 Base64 格式"}
          </p>
        </div>
      ) : (
        <Textarea
          id={id}
          value={formatJsonValue(value)}
          placeholder={field.placeholder || "请输入或粘贴 Base64 字符串"}
          required={field.required}
          className="font-mono text-xs max-h-32"
          onChange={(e) => {
            const val = e.currentTarget.value.trim();
            if (!val) {
              onChange(undefined);
              return;
            }
            try {
              onChange(JSON.parse(val));
            } catch {
              onChange(val);
            }
          }}
        />
      )}
    </Field>
  );
}

function JsonField({ field, id, value, onChange }: JsonFieldProps) {
  const [draft, setDraft] = useState(() => formatJsonValue(value));
  const [error, setError] = useState<string>();
  const acceptedValueRef = useRef(getJsonSignature(value));

  useEffect(() => {
    const signature = getJsonSignature(value);
    if (signature === acceptedValueRef.current) return;
    acceptedValueRef.current = signature;
    setDraft(formatJsonValue(value));
    setError(undefined);
  }, [value]);

  return (
    <Field data-invalid={Boolean(error)} title={field.description} className="col-span-full space-y-1.5">
      <RequiredLabel field={field} htmlFor={id} />
      <Textarea
        id={id}
        value={draft}
        placeholder={field.placeholder}
        required={field.required}
        aria-invalid={Boolean(error)}
        className="font-mono text-xs min-h-20"
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          setDraft(nextDraft);

          if (!nextDraft.trim()) {
            setError(undefined);
            onChange(undefined);
            return;
          }

          try {
            const parsedValue = JSON.parse(nextDraft);
            acceptedValueRef.current = getJsonSignature(parsedValue);
            onChange(parsedValue);
            setError(undefined);
          } catch {
            setError("请输入有效的 JSON 格式");
          }
        }}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function UrlListField({ field, id, value, onChange }: UrlListFieldProps) {
  const [draft, setDraft] = useState(() => formatUrlListValue(value));
  const [error, setError] = useState<string>();
  const acceptedValueRef = useRef(getJsonSignature(parseUrlListValue(formatUrlListValue(value))));

  useEffect(() => {
    const signature = getJsonSignature(Array.isArray(value) ? value.map(String) : parseUrlListValue(formatUrlListValue(value)));
    if (signature === acceptedValueRef.current) return;
    acceptedValueRef.current = signature;
    setDraft(formatUrlListValue(value));
  }, [value]);

  return (
    <Field data-invalid={Boolean(error)} title={field.description} className="col-span-full space-y-1.5">
      <RequiredLabel field={field} htmlFor={id} />
      <Textarea
        id={id}
        value={draft}
        placeholder={field.placeholder || "每行一条完整公网 URL"}
        required={field.required}
        aria-invalid={Boolean(error)}
        className="font-mono text-xs min-h-20"
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          const nextValue = parseUrlListValue(nextDraft);
          setDraft(nextDraft);
          acceptedValueRef.current = getJsonSignature(nextValue);
          onChange(nextValue);
          setError(field.max !== undefined && nextValue.length > field.max ? `最多支持 ${field.max} 条 URL` : undefined);
        }}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function CapabilityField({
  field,
  id,
  value,
  onChange
}: {
  field: DuomiCapabilityField;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  // 识别并注入 Base64 智能图片处理
  if (
    field.key.toLowerCase().includes("base64") ||
    (field.label && field.label.toLowerCase().includes("base64"))
  ) {
    return <Base64ImageField field={field} id={id} value={value} onChange={onChange} />;
  }

  if (field.type === "json") {
    return <JsonField field={field} id={id} value={value} onChange={onChange} />;
  }

  if (field.type === "url-list") {
    return <UrlListField field={field} id={id} value={value} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <div
        title={field.description}
        className="duomi-switch-card inline-flex items-center gap-3 w-fit px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--subtle)] hover:bg-[var(--hover)] hover:border-[var(--line-strong)] transition-all cursor-pointer select-none"
        onClick={() => onChange(!value)}
      >
        <RequiredLabel field={field} htmlFor={id} />
        <Switch
          id={id}
          checked={value === true}
          required={field.required}
          aria-required={field.required}
          onCheckedChange={onChange}
          className="pointer-events-none"
        />
      </div>
    );
  }

  if (field.type === "select") {
    const options = field.options ?? [];
    const selectedOption = options.find((option) => Object.is(option.value, value));

    return (
      <Field title={field.description} className="space-y-1.5">
        <RequiredLabel field={field} htmlFor={id} />
        <Select
          value={selectedOption ? getSelectOptionToken(selectedOption.value) : undefined}
          required={field.required}
          onValueChange={(token) => {
            const option = options.find((item) => getSelectOptionToken(item.value) === token);
            if (option) onChange(option.value);
          }}
        >
          <SelectTrigger id={id} className="w-full max-w-[200px] h-10 font-medium" aria-required={field.required}>
            <SelectValue placeholder={field.placeholder || "请选择"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={getSelectOptionToken(option.value)} value={getSelectOptionToken(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  if (field.type === "textarea" || field.key === "prompt") {
    return (
      <Field title={field.description} className="col-span-full space-y-1.5">
        <RequiredLabel field={field} htmlFor={id} />
        <Textarea
          id={id}
          value={asInputValue(value)}
          placeholder={field.placeholder || "请输入提示词或生成要求描述"}
          required={field.required}
          className="min-h-20 text-xs w-full"
          onChange={(event) => {
            onChange(event.currentTarget.value);
          }}
        />
      </Field>
    );
  }

  const isNumeric = field.type === "number";

  return (
    <Field title={field.description} className="space-y-1.5">
      <RequiredLabel field={field} htmlFor={id} />
      <Input
        id={id}
        type={isNumeric ? "number" : field.type === "url" ? "url" : "text"}
        value={asInputValue(value)}
        placeholder={field.placeholder || "请输入"}
        required={field.required}
        min={isNumeric ? field.min : undefined}
        max={isNumeric ? field.max : undefined}
        step={isNumeric ? field.step : undefined}
        className={`h-10 text-xs w-full ${isNumeric ? "max-w-[130px]" : "max-w-[340px]"}`}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          onChange(isNumeric ? (nextValue === "" ? undefined : Number(nextValue)) : nextValue);
        }}
      />
    </Field>
  );
}

/** 根据多米能力字段定义渲染受控表单（从上往下流式纵向布局）。 */
export function DuomiCapabilityFields({ capability, values, onChange }: DuomiCapabilityFieldsProps) {
  const formId = useId();

  return (
    <div
      key={capability.id}
      className="duomi-fields-vertical-stack flex flex-col gap-3.5 w-full animate-in fade-in duration-200"
    >
      {capability.fields.map((field, index) => (
        <div key={`${capability.id}:${field.key}`} className="duomi-field-row w-full">
          <CapabilityField
            field={field}
            id={`${formId}-${index}`}
            value={getFieldValue(field, values)}
            onChange={(value) => onChange(field.key, value)}
          />
        </div>
      ))}
    </div>
  );
}
