import { memo, type ImgHTMLAttributes, useEffect, useRef, useState } from "react";

const MAX_IMAGE_LOAD_ATTEMPTS = 5;
const IMAGE_RETRY_DELAY_MS = 1000;

type RetryingImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

export const RetryingImage = memo(function RetryingImage({
  src,
  onError,
  onLoad,
  loading = "lazy",
  decoding = "async",
  ...props
}: RetryingImageProps) {
  const [attempt, setAttempt] = useState(1);
  const retryTimeoutRef = useRef<number | null>(null);

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current === null) return;
    window.clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = null;
  };

  useEffect(() => {
    clearRetryTimeout();
    setAttempt(1);

    return clearRetryTimeout;
  }, [src]);

  return (
    <img
      {...props}
      key={`${src}-${attempt}`}
      src={src}
      loading={loading}
      decoding={decoding}
      onLoad={(event) => {
        clearRetryTimeout();
        onLoad?.(event);
      }}
      onError={(event) => {
        onError?.(event);
        if (attempt >= MAX_IMAGE_LOAD_ATTEMPTS || retryTimeoutRef.current !== null) return;

        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          setAttempt((current) => Math.min(current + 1, MAX_IMAGE_LOAD_ATTEMPTS));
        }, IMAGE_RETRY_DELAY_MS);
      }}
    />
  );
});
