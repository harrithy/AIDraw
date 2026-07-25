import { ImageOff, Loader2 } from "lucide-react";
import { memo, type ImgHTMLAttributes, useEffect, useRef, useState } from "react";

/** 图片加载最多重试次数 */
const MAX_IMAGE_LOAD_ATTEMPTS = 5;
/** 每次重试的间隔毫秒 */
const IMAGE_RETRY_DELAY_MS = 1000;

/** RetryingImage 组件的 Props 类型 */
type RetryingImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

/**
 * 带自动重试的图片组件。
 * 图片加载失败时自动重试（最多 5 次，间隔 1 秒），
 * 彻底失败后显示占位图标。适用于远程生成图片加载不稳定的场景。
 */
export const RetryingImage = memo(function RetryingImage({
  src,
  onError,
  onLoad,
  loading = "lazy",
  decoding = "async",
  className,
  ...props
}: RetryingImageProps) {
  const [attempt, setAttempt] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const retryTimeoutRef = useRef<number | null>(null);

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current === null) return;
    window.clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = null;
  };

  useEffect(() => {
    clearRetryTimeout();
    setAttempt(1);
    setIsLoaded(false);
    setHasFailed(false);

    return clearRetryTimeout;
  }, [src]);

  return (
    <div className="retrying-image-wrapper">
      {!isLoaded && (
        <div className="image-skeleton-placeholder">
          {hasFailed ? (
            <>
              <ImageOff size={22} className="image-skeleton-error-icon" />
              <span className="image-skeleton-text">图片加载失败</span>
            </>
          ) : (
            <>
              <Loader2 size={16} className="spin image-skeleton-spinner" />
              <span className="image-skeleton-text image-skeleton-loading-text">加载中</span>
            </>
          )}
        </div>
      )}
      <img
        {...props}
        key={`${src}-${attempt}`}
        src={src}
        loading={loading}
        decoding={decoding}
        className={`retrying-img ${isLoaded ? "is-loaded" : "is-loading"} ${className ?? ""}`}
        onLoad={(event) => {
          clearRetryTimeout();
          setIsLoaded(true);
          setHasFailed(false);
          onLoad?.(event);
        }}
        onError={(event) => {
          onError?.(event);
          if (attempt >= MAX_IMAGE_LOAD_ATTEMPTS || retryTimeoutRef.current !== null) {
            setHasFailed(true);
            return;
          }

          retryTimeoutRef.current = window.setTimeout(() => {
            retryTimeoutRef.current = null;
            setAttempt((current) => Math.min(current + 1, MAX_IMAGE_LOAD_ATTEMPTS));
          }, IMAGE_RETRY_DELAY_MS);
        }}
      />
    </div>
  );
});
