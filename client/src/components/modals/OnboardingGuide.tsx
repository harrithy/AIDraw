import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  HelpCircle,
  ImageUp,
  KeyRound,
  MousePointer2,
  SlidersHorizontal,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";

type OnboardingGuideProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish: () => void;
};

const guideSteps = [
  {
    title: "先建一个文件夹",
    summary: "左侧输入文件夹名并创建，后续生成的任务都会保存在当前文件夹里。",
    detail: "不同项目可以拆成不同文件夹，方便回头查找和继续调整。",
    icon: FolderPlus
  },
  {
    title: "配置多米 API",
    summary: "点击顶部工具栏的设置按钮，填入 API Key、Base URL 和模型。",
    detail: "没有 Key 时也能体验本地示例图；填好 Key 后会走真实生成接口。",
    icon: KeyRound
  },
  {
    title: "输入提示词或添加参考图",
    summary: "底部输入框写画面描述；粘贴、拖拽或上传图片后会自动作为图生图参考。",
    detail: "参考图会先上传成 URL，生成后的卡片旁边也会保留缩略图。",
    icon: ImageUp
  },
  {
    title: "选择尺寸与质量",
    summary: "按需要选择 Size、Quality 和数量，再点击加入队列。",
    detail: "任务会自动排队处理；当前等待、运行和完成数量会显示在右上角。",
    icon: SlidersHorizontal
  },
  {
    title: "查看、下载和继续迭代",
    summary: "生成卡片可以放大预览、下载、重新绘制，也可以拖动画布整理流程。",
    detail: "图生图任务会在结果旁展示参考图，方便对照输出效果。",
    icon: MousePointer2
  }
];

export function OnboardingGuide({
  open,
  onOpenChange,
  onFinish
}: OnboardingGuideProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = guideSteps[activeIndex];
  const ActiveIcon = activeStep.icon;
  const isLastStep = activeIndex === guideSteps.length - 1;
  const progress = useMemo(() => `${activeIndex + 1}/${guideSteps.length}`, [activeIndex]);

  const closeGuide = () => {
    onFinish();
  };

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open]);

  const moveStep = (direction: -1 | 1) => {
    setActiveIndex((current) => Math.min(Math.max(current + direction, 0), guideSteps.length - 1));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : closeGuide())}>
      <DialogContent className="onboarding-dialog" showCloseButton={false}>
        <DialogHeader>
          <div className="dialog-title-row onboarding-title-row">
            <div>
              <p className="eyebrow">首次指引</p>
              <DialogTitle>从第一个任务开始</DialogTitle>
            </div>
            <HelpCircle size={22} />
          </div>
          <DialogDescription>
            按下面的顺序走一遍，就能完成从配置到出图的完整流程。
          </DialogDescription>
        </DialogHeader>

        <div className="onboarding-body">
          <nav className="onboarding-steps" aria-label="指引步骤">
            {guideSteps.map((step, index) => {
              const StepIcon = step.icon;
              const selected = index === activeIndex;
              const completed = index < activeIndex;

              return (
                <button
                  key={step.title}
                  type="button"
                  className={`onboarding-step${selected ? " active" : ""}${completed ? " completed" : ""}`}
                  onClick={() => setActiveIndex(index)}
                  aria-current={selected ? "step" : undefined}
                >
                  <span className="onboarding-step-icon">
                    {completed ? <CheckCircle2 size={17} /> : <StepIcon size={17} />}
                  </span>
                  <span>{step.title}</span>
                </button>
              );
            })}
          </nav>

          <section className="onboarding-card" aria-live="polite">
            <div className="onboarding-card-head">
              <span className="onboarding-card-icon">
                <ActiveIcon size={26} />
              </span>
              <span className="onboarding-progress">{progress}</span>
            </div>
            <h3>{activeStep.title}</h3>
            <p>{activeStep.summary}</p>
            <small>{activeStep.detail}</small>
          </section>
        </div>

        <div className="onboarding-footer">
          <button type="button" className="secondary-submit" onClick={closeGuide}>
            <X size={16} />
            跳过
          </button>
          <div className="onboarding-footer-actions">
            <button
              type="button"
              className="secondary-submit"
              onClick={() => moveStep(-1)}
              disabled={activeIndex === 0}
            >
              <ChevronLeft size={16} />
              上一步
            </button>
            <button
              type="button"
              className="submit-button onboarding-primary"
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
      </DialogContent>
    </Dialog>
  );
}
