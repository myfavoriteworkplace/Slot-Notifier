import { toast } from "@/hooks/use-toast";
import { humaniseError } from "@/lib/errors";

type NotifyOptions = {
  description?: string;
  duration?: number;
  persist?: boolean;
  action?: React.ReactElement;
};

function fire(
  variant: "default" | "destructive",
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
    fire("default", title, { duration: 4000, ...options }),

  info: (title: string, options?: NotifyOptions) =>
    fire("default", title, { duration: 5000, ...options }),

  warning: (title: string, options?: NotifyOptions) =>
    fire("default", `⚠️ ${title}`, { duration: 6000, ...options }),

  error: (title: string, options?: NotifyOptions) =>
    fire("destructive", title, { ...options }),

  critical: (title: string, options?: NotifyOptions) =>
    fire("destructive", title, { persist: true, ...options }),

  apiError: (err: unknown, fallbackTitle?: string) => {
    const { title, description } = humaniseError(err, fallbackTitle);
    return fire("destructive", title, { description });
  },
};
