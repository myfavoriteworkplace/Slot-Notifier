import { toast } from "@/hooks/use-toast";
import { humaniseError } from "@/lib/errors";

type ToastVariant = "success" | "info" | "warning" | "error" | "critical";

type NotifyOptions = {
  description?: string;
  duration?: number;
  persist?: boolean;
  action?: React.ReactElement;
};

function fire(
  variant: ToastVariant,
  title: string,
  options?: NotifyOptions,
) {
  const duration = options?.persist ? 0 : (options?.duration ?? undefined);
  return toast({
    title,
    description: options?.description,
    variant,
    action: options?.action,
    ...(duration !== undefined && duration > 0 ? { duration } : {}),
  });
}

export const notify = {
  success: (title: string, options?: NotifyOptions) =>
    fire("success", title, { duration: 4000, ...options }),

  info: (title: string, options?: NotifyOptions) =>
    fire("info", title, { duration: 5000, ...options }),

  warning: (title: string, options?: NotifyOptions) =>
    fire("warning", title, { duration: 6000, ...options }),

  error: (title: string, options?: NotifyOptions) =>
    fire("error", title, { ...options }),

  critical: (title: string, options?: NotifyOptions) =>
    fire("critical", title, { persist: true, ...options }),

  apiError: (err: unknown, fallbackTitle?: string) => {
    const { title, description } = humaniseError(err, fallbackTitle);
    return fire("error", title, { description });
  },
};
