import { useEffect, useId, useRef, useState } from "react";
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
    <FieldLabel htmlFor={htmlFor} title={field.description}>
      <span>{field.label}</span>
      {field.required ? (
        <span className="text-destructive" aria-label="必填">
          *
        </span>
      ) : null}
    </FieldLabel>
  );
}

function JsonField({ field, id, value, onChange }: JsonFieldProps) {
  const [draft, setDraft] = useState(() => formatJsonValue(value));
  const [error, setError] = useState<string>();
  const acceptedValueRef = useRef(getJsonSignature(value));

  useEffect(() => {
    const signature = getJsonSignature(value);
    // 父组件回传刚解析的值时保留用户原始排版和光标位置。
    if (signature === acceptedValueRef.current) return;
    acceptedValueRef.current = signature;
    setDraft(formatJsonValue(value));
    setError(undefined);
  }, [value]);

  return (
    <Field data-invalid={Boolean(error)} title={field.description}>
      <RequiredLabel field={field} htmlFor={id} />
      <Textarea
        id={id}
        value={draft}
        placeholder={field.placeholder}
        required={field.required}
        aria-invalid={Boolean(error)}
        title={field.description}
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
            setError("请输入有效的 JSON");
          }
        }}
      />
      {error ? (
        <FieldError>{error}</FieldError>
      ) : null}
    </Field>
  );
}

function UrlListField({ field, id, value, onChange }: UrlListFieldProps) {
  const [draft, setDraft] = useState(() => formatUrlListValue(value));
  const [error, setError] = useState<string>();
  const acceptedValueRef = useRef(getJsonSignature(parseUrlListValue(formatUrlListValue(value))));

  useEffect(() => {
    const signature = getJsonSignature(Array.isArray(value) ? value.map(String) : parseUrlListValue(formatUrlListValue(value)));
    // 忽略父组件原样回传，允许保留末尾空行以继续输入下一条 URL。
    if (signature === acceptedValueRef.current) return;
    acceptedValueRef.current = signature;
    setDraft(formatUrlListValue(value));
  }, [value]);

  return (
    <Field data-invalid={Boolean(error)} title={field.description}>
      <RequiredLabel field={field} htmlFor={id} />
      <Textarea
        id={id}
        value={draft}
        placeholder={field.placeholder}
        required={field.required}
        aria-invalid={Boolean(error)}
        title={field.description}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          const nextValue = parseUrlListValue(nextDraft);
          setDraft(nextDraft);
          acceptedValueRef.current = getJsonSignature(nextValue);
          onChange(nextValue);
          setError(field.max !== undefined && nextValue.length > field.max ? `最多 ${field.max} 条` : undefined);
        }}
      />
      {error ? (
        <FieldError>{error}</FieldError>
      ) : null}
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
  if (field.type === "json") {
    return <JsonField field={field} id={id} value={value} onChange={onChange} />;
  }

  if (field.type === "url-list") {
    return <UrlListField field={field} id={id} value={value} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <Field orientation="horizontal" title={field.description}>
        <RequiredLabel field={field} htmlFor={id} />
        <Switch
          id={id}
          checked={value === true}
          required={field.required}
          aria-required={field.required}
          title={field.description}
          onCheckedChange={onChange}
        />
      </Field>
    );
  }

  if (field.type === "select") {
    const options = field.options ?? [];
    const selectedOption = options.find((option) => Object.is(option.value, value));

    return (
      <Field title={field.description}>
        <RequiredLabel field={field} htmlFor={id} />
        <Select
          value={selectedOption ? getSelectOptionToken(selectedOption.value) : undefined}
          required={field.required}
          onValueChange={(token) => {
            const option = options.find((item) => getSelectOptionToken(item.value) === token);
            if (option) onChange(option.value);
          }}
        >
          <SelectTrigger id={id} className="w-full" aria-required={field.required} title={field.description}>
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

  if (field.type === "textarea") {
    return (
      <Field title={field.description}>
        <RequiredLabel field={field} htmlFor={id} />
        <Textarea
          id={id}
          value={asInputValue(value)}
          placeholder={field.placeholder}
          required={field.required}
          title={field.description}
          onChange={(event) => {
            onChange(event.currentTarget.value);
          }}
        />
      </Field>
    );
  }

  return (
    <Field title={field.description}>
      <RequiredLabel field={field} htmlFor={id} />
      <Input
        id={id}
        type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
        value={asInputValue(value)}
        placeholder={field.placeholder}
        required={field.required}
        min={field.type === "number" ? field.min : undefined}
        max={field.type === "number" ? field.max : undefined}
        step={field.type === "number" ? field.step : undefined}
        title={field.description}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          onChange(field.type === "number" ? (nextValue === "" ? undefined : Number(nextValue)) : nextValue);
        }}
      />
    </Field>
  );
}

/** 根据多米能力字段定义渲染受控表单。 */
export function DuomiCapabilityFields({ capability, values, onChange }: DuomiCapabilityFieldsProps) {
  const formId = useId();

  return (
    <div className="grid gap-4">
      {capability.fields.map((field, index) => (
        <CapabilityField
          key={`${capability.id}:${field.key}`}
          field={field}
          id={`${formId}-${index}`}
          value={getFieldValue(field, values)}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </div>
  );
}
