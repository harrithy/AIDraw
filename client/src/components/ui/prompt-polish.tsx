import { DropdownMenu } from "radix-ui";
import { Check, Loader2, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/ui/message";
import {
  DEEPSEEK_MODEL_LABELS,
  DEEPSEEK_THINKING_LABELS,
  PROMPT_POLISH_STYLE_LABELS,
  getDeepSeekApiKey,
  isDeepSeekVisionModel,
  polishWithDeepSeek,
  type DeepSeekModel,
  type DeepSeekThinkingLevel,
  type PromptPolishStyle
} from "@/lib/deepseekApi";
import { getSettings } from "@/lib/storage/settings";

type PromptPolishProps = {
  /** 当前提示词文本；为空时点击会提示先填写。 */
  text: string;
  /** 润写完整成功后回写结果；失败时不会覆盖原文。 */
  onPolished: (text: string) => void;
  /** 触发按钮尺寸，默认 sm。 */
  size?: "sm" | "icon-sm";
  /** 参考图片 URL（图生图场景）；提供时自动切换到看图润写模型并结合图片内容润写。 */
  images?: string[];
};

const POLISH_STYLES = Object.keys(PROMPT_POLISH_STYLE_LABELS) as PromptPolishStyle[];
const MODELS = Object.keys(DEEPSEEK_MODEL_LABELS) as DeepSeekModel[];
const THINKING_LEVELS = Object.keys(DEEPSEEK_THINKING_LABELS) as DeepSeekThinkingLevel[];

const MENU_LABEL_CLASS =
  "px-2.5 pt-2 pb-1 text-[11px] font-semibold text-[var(--muted)] select-none";
const MENU_ITEM_CLASS =
  "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] outline-none hover:bg-[var(--hover)] data-[highlighted]:bg-[var(--hover)]";

/** 生成「模型/思考强度」这类选择项：点击选中但菜单保持展开。 */
function renderSelectItem<T extends string>({
  value,
  label,
  current,
  onSelect
}: {
  value: T;
  label: string;
  current: T;
  onSelect: (value: T) => void;
}) {
  return (
    <DropdownMenu.Item
      key={value}
      className={MENU_ITEM_CLASS}
      onSelect={(event) => {
        event.preventDefault();
        onSelect(value);
      }}
    >
      {current === value ? (
        <Check size={13} className="text-[var(--green)] flex-shrink-0" />
      ) : (
        <span className="inline-block w-[13px] flex-shrink-0" />
      )}
      <span>{label}</span>
    </DropdownMenu.Item>
  );
}

/**
 * 生图提示词输入框旁的「AI 润写」按钮。
 * 下拉可切换 DeepSeek 模型与思考强度，选风格后调用流式润写并逐字回填输入框；
 * 润写完成后展示「回退」按钮，可一键还原润写前的原文。
 */
export function PromptPolish({ text, onPolished, size = "sm", images = [] }: PromptPolishProps) {
  const [isPolishing, setIsPolishing] = useState(false);
  const [model, setModel] = useState<DeepSeekModel>("deepseek-v4-pro");
  const [thinking, setThinking] = useState<DeepSeekThinkingLevel>("high");
  const [lastResult, setLastResult] = useState<{ original: string; polished: string } | null>(null);
  const modelTouchedByUserRef = useRef(false);
  const latestTextRef = useRef(text);
  latestTextRef.current = text;

  const hasUndo = !isPolishing && lastResult !== null && text === lastResult.polished;

  // 加入参考图时自动切到看图润写模型；用户手动选过模型则不覆盖。
  useEffect(() => {
    if (images.length > 0 && !modelTouchedByUserRef.current && !isDeepSeekVisionModel(model)) {
      setModel("deepseek-v4-flash-vision-exp");
    }
  }, [images.length, model]);

  const polish = async (style: PromptPolishStyle) => {
    const originalText = text;
    const nextText = originalText.trim();
    if (!nextText) {
      Message.error("请先填写提示词，再使用 AI 润写");
      return;
    }
    if (isPolishing) return;
    setIsPolishing(true);
    try {
      const settings = await getSettings();
      const apiKey = getDeepSeekApiKey(settings);
      if (!apiKey) {
        Message.error("未配置 DeepSeek API Key，请先在「接口设置」中导入 DeepSeek Key");
        return;
      }
      const polished = await polishWithDeepSeek({
        text: nextText,
        apiKey,
        style,
        model,
        thinking,
        images
      });
      if (latestTextRef.current !== originalText) {
        Message.info("润写期间提示词已被修改，本次结果未覆盖你的新内容");
        return;
      }
      onPolished(polished);
      setLastResult({ original: originalText, polished });
      Message.success(
        `提示词润写完成（${DEEPSEEK_MODEL_LABELS[model].split("（")[0]} · ${PROMPT_POLISH_STYLE_LABELS[style]}）`
      );
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "提示词润写失败");
    } finally {
      setIsPolishing(false);
    }
  };

  const revert = () => {
    if (!lastResult) return;
    onPolished(lastResult.original);
    setLastResult(null);
    Message.info("已还原为润写前的提示词");
  };

  return (
    <span className="inline-flex items-center gap-1.5 flex-shrink-0">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild disabled={isPolishing}>
          <Button
            type="button"
            variant="outline"
            size={size}
            className="prompt-polish-trigger flex-shrink-0"
            title={`用 DeepSeek 润写提示词（当前 ${DEEPSEEK_MODEL_LABELS[model].split("（")[0]}）`}
            aria-label="AI 润写提示词"
          >
            {isPolishing ? (
              <Loader2 className="spin" size={15} />
            ) : (
              <Sparkles size={15} className="text-[var(--green)]" />
            )}
            {size !== "icon-sm" ? <span>{isPolishing ? "润写中" : "AI 润写"}</span> : null}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            align="start"
            className="prompt-polish-menu z-50 min-w-[190px] rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1 shadow-xl"
          >
            <DropdownMenu.Label className={MENU_LABEL_CLASS}>模型</DropdownMenu.Label>
            {MODELS.map((value) =>
              renderSelectItem({
                value,
                label: DEEPSEEK_MODEL_LABELS[value],
                current: model,
                onSelect: (nextModel) => {
                  modelTouchedByUserRef.current = true;
                  setModel(nextModel);
                }
              })
            )}

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

            <DropdownMenu.Label className={MENU_LABEL_CLASS}>思考强度</DropdownMenu.Label>
            {THINKING_LEVELS.map((value) =>
              renderSelectItem({
                value,
                label: DEEPSEEK_THINKING_LABELS[value],
                current: thinking,
                onSelect: setThinking
              })
            )}

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

            <DropdownMenu.Label className={MENU_LABEL_CLASS}>润写风格</DropdownMenu.Label>
            {POLISH_STYLES.map((style) => (
              <DropdownMenu.Item
                key={style}
                className={MENU_ITEM_CLASS}
                onSelect={() => void polish(style)}
              >
                <Sparkles size={13} className="text-[var(--green)] flex-shrink-0" />
                <span>{PROMPT_POLISH_STYLE_LABELS[style]}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {hasUndo ? (
        <Button
          type="button"
          variant="ghost"
          size={size}
          className="prompt-polish-undo flex-shrink-0"
          title="回退到润写前的提示词"
          aria-label="回退到润写前"
          onClick={revert}
        >
          <Undo2 size={15} className="text-[var(--muted)]" />
          {size !== "icon-sm" ? <span>回退</span> : null}
        </Button>
      ) : null}
    </span>
  );
}
