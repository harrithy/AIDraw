import {
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  ImageUp,
  KeyRound,
  MousePointer2,
  SlidersHorizontal,
  Sparkles,
  X
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalTransition } from "../../hooks/useModalTransition";

type OnboardingGuideProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish: () => void;
};

type TourPlacement = "top" | "right" | "bottom" | "left";

type TourRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type TourSize = {
  width: number;
  height: number;
};

type PopoverLayout = {
  placement: TourPlacement;
  style: CSSProperties;
};

const tourSteps = [
  {
    target: '[data-tour="folder-create"]',
    placement: "right" as TourPlacement,
    title: "创建文件夹",
    body: "先在左侧创建或选择一个文件夹，生成任务会保存在当前文件夹中。",
    tip: "不同主题可以分开建文件夹，后续查找会更轻松。",
    icon: FolderPlus
  },
  {
    target: '[data-tour="api-settings"]',
    placement: "bottom" as TourPlacement,
    title: "配置接口",
    body: "点击接口设置，填写多米 API Key、Base URL 和模型。",
    tip: "没有 Key 时可以先体验本地示例；填好后会走真实生成。",
    icon: KeyRound
  },
  {
    target: '[data-tour="composer"]',
    placement: "top" as TourPlacement,
    title: "输入提示词",
    body: "在底部输入想生成的画面，也可以粘贴、拖拽或上传参考图。",
    tip: "有参考图时会自动切换成图生图，并在结果旁保留缩略图。",
    icon: ImageUp
  },
  {
    target: '[data-tour="composer-options"]',
    placement: "top" as TourPlacement,
    title: "设置参数",
    body: "这里可以调整数量、Quality、Size 和模型，再加入绘制队列。",
    tip: "任务会自动排队处理，右上角会显示运行、等待和完成数量。",
    icon: SlidersHorizontal
  },
  {
    target: '[data-tour="canvas"]',
    placement: "right" as TourPlacement,
    title: "整理结果",
    body: "生成后的卡片会出现在画布中，可以放大预览、下载、重绘或拖拽整理。",
    tip: "鼠标滚轮可以缩放画布，工具栏也能排序和重置视图。",
    icon: MousePointer2
  }
];

const SPOTLIGHT_PADDING = 8;
const POPOVER_GAP = 14;
const POPOVER_WIDTH = 322;
const DEFAULT_POPOVER_HEIGHT = 214;
const VIEWPORT_PADDING = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toTourRect = (rect: DOMRect): TourRect => ({
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
  left: rect.left,
  width: rect.width,
  height: rect.height
});

const getSpotlightStyle = (rect: TourRect): CSSProperties => {
  const left = Math.max(VIEWPORT_PADDING, rect.left - SPOTLIGHT_PADDING);
  const top = Math.max(VIEWPORT_PADDING, rect.top - SPOTLIGHT_PADDING);
  const right = Math.min(window.innerWidth - VIEWPORT_PADDING, rect.right + SPOTLIGHT_PADDING);
  const bottom = Math.min(window.innerHeight - VIEWPORT_PADDING, rect.bottom + SPOTLIGHT_PADDING);

  return {
    left,
    top,
    width: Math.max(28, right - left),
    height: Math.max(28, bottom - top)
  };
};

const getPopoverLayout = (
  rect: TourRect | null,
  placement: TourPlacement,
  popoverSize: TourSize | null
): PopoverLayout => {
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
  const height = popoverSize?.height ?? DEFAULT_POPOVER_HEIGHT;
  const fallback = {
    left: (window.innerWidth - width) / 2,
    top: Math.max(VIEWPORT_PADDING, window.innerHeight * 0.18),
    width
  };

  if (!rect) {
    return {
      placement: "bottom",
      style: fallback
    };
  }

  let resolvedPlacement = placement;
  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.bottom + POPOVER_GAP;

  if (placement === "top") {
    top = rect.top - POPOVER_GAP - height;
  }
  if (placement === "right") {
    left = rect.right + POPOVER_GAP;
    top = rect.top + rect.height / 2 - height / 2;
  }
  if (placement === "left") {
    left = rect.left - POPOVER_GAP - width;
    top = rect.top + rect.height / 2 - height / 2;
  }

  if (placement === "top" && top < VIEWPORT_PADDING) {
    resolvedPlacement = "bottom";
    top = rect.bottom + POPOVER_GAP;
  }
  if (placement === "bottom" && top + height > window.innerHeight - VIEWPORT_PADDING) {
    resolvedPlacement = "top";
    top = rect.top - POPOVER_GAP - height;
  }
  if (
    (placement === "left" || placement === "right") &&
    (left < VIEWPORT_PADDING || left + width > window.innerWidth - VIEWPORT_PADDING)
  ) {
    const hasBottomSpace = rect.bottom + POPOVER_GAP + height <= window.innerHeight - VIEWPORT_PADDING;
    resolvedPlacement = hasBottomSpace ? "bottom" : "top";
    left = rect.left + rect.width / 2 - width / 2;
    top = hasBottomSpace ? rect.bottom + POPOVER_GAP : rect.top - POPOVER_GAP - height;
  }

  return {
    placement: resolvedPlacement,
    style: {
      left: clamp(left, VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING),
      top: clamp(top, VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - height)),
      width
    }
  };
};

export function OnboardingGuide({
  open,
  onOpenChange,
  onFinish
}: OnboardingGuideProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [popoverSize, setPopoverSize] = useState<TourSize | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const isPresent = useModalTransition({
    open,
    scopeRef: layerRef,
    backdropRef,
    panelRef: popoverRef
  });
  const activeStep = tourSteps[activeIndex];
  const ActiveIcon = activeStep.icon;
  const isLastStep = activeIndex === tourSteps.length - 1;
  const progress = useMemo(() => `${activeIndex + 1}/${tourSteps.length}`, [activeIndex]);

  const closeGuide = useCallback(() => {
    onOpenChange(false);
    onFinish();
  }, [onFinish, onOpenChange]);

  const measureTarget = useCallback(
    (scrollIntoView = false) => {
      const target = document.querySelector<HTMLElement>(activeStep.target);
      if (!target) {
        setTargetRect(null);
        return;
      }

      if (scrollIntoView) {
        target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }

      setTargetRect(toTourRect(target.getBoundingClientRect()));
    },
    [activeStep.target]
  );

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !isPresent) return;

    measureTarget(true);
    const timer = window.setTimeout(() => measureTarget(false), 260);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPresent, measureTarget, open]);

  useLayoutEffect(() => {
    if (!open || !isPresent || !popoverRef.current) return;

    const updateSize = () => {
      const { width, height } = popoverRef.current?.getBoundingClientRect() ?? { width: POPOVER_WIDTH, height: DEFAULT_POPOVER_HEIGHT };
      setPopoverSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(popoverRef.current);
    return () => observer.disconnect();
  }, [activeIndex, isPresent, open]);

  useEffect(() => {
    if (!open) return;

    const update = () => measureTarget(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGuide();
    };

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeGuide, measureTarget, open]);

  const moveStep = (direction: -1 | 1) => {
    setActiveIndex((current) => Math.min(Math.max(current + direction, 0), tourSteps.length - 1));
  };

  if (!isPresent) return null;

  const popoverLayout = getPopoverLayout(targetRect, activeStep.placement, popoverSize);

  return createPortal(
    <div ref={layerRef} className={`onboarding-tour-layer${targetRect ? "" : " no-target"}`} role="dialog" aria-modal="true" aria-label="首次指引">
      <div ref={backdropRef} className="onboarding-tour-backdrop">
        <div className="onboarding-tour-guard" onClick={closeGuide} />
        {targetRect ? <div className="onboarding-tour-spotlight" style={getSpotlightStyle(targetRect)} /> : null}
      </div>
      <section
        ref={popoverRef}
        className="onboarding-tour-popover"
        data-placement={popoverLayout.placement}
        style={popoverLayout.style}
      >
        <div className="onboarding-tour-head">
          <span className="onboarding-tour-icon">
            <ActiveIcon size={21} />
          </span>
          <span className="onboarding-tour-progress">{progress}</span>
          <button type="button" className="onboarding-tour-close" onClick={closeGuide} title="关闭指引">
            <X size={16} />
          </button>
        </div>

        <div className="onboarding-tour-copy">
          <p className="eyebrow">首次指引</p>
          <h3>{activeStep.title}</h3>
          <p>{activeStep.body}</p>
          <small>{activeStep.tip}</small>
        </div>

        <div className="onboarding-tour-steps" aria-label="指引步骤">
          {tourSteps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              className={`onboarding-tour-dot${index === activeIndex ? " active" : ""}${index < activeIndex ? " completed" : ""}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`第 ${index + 1} 步：${step.title}`}
              aria-current={index === activeIndex ? "step" : undefined}
            />
          ))}
        </div>

        <div className="onboarding-tour-actions">
          <button type="button" className="secondary-submit" onClick={closeGuide}>
            跳过
          </button>
          <div className="onboarding-tour-nav">
            <button
              type="button"
              className="secondary-submit"
              onClick={() => moveStep(-1)}
              disabled={activeIndex === 0}
              title="上一步"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="submit-button onboarding-tour-primary"
              onClick={() => (isLastStep ? closeGuide() : moveStep(1))}
            >
              {isLastStep ? (
                <>
                  <Sparkles size={16} />
                  开始使用
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
