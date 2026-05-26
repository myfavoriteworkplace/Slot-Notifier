import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  ShieldAlert,
} from "lucide-react"

type VariantKey =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "critical"
  | "default"
  | "destructive"

interface VariantConfig {
  Icon: React.ElementType
  iconClass: string
  iconBgClass: string
  accentClass: string
  progressClass: string
  autoDismissMs?: number
}

const VARIANT_CONFIG: Record<VariantKey, VariantConfig> = {
  success: {
    Icon: CheckCircle2,
    iconClass: "text-green-600",
    iconBgClass: "bg-green-50",
    accentClass: "bg-green-500",
    progressClass: "bg-green-500",
    autoDismissMs: 4000,
  },
  info: {
    Icon: Info,
    iconClass: "text-blue-600",
    iconBgClass: "bg-blue-50",
    accentClass: "bg-blue-500",
    progressClass: "bg-blue-500",
    autoDismissMs: 5000,
  },
  warning: {
    Icon: AlertTriangle,
    iconClass: "text-amber-600",
    iconBgClass: "bg-amber-50",
    accentClass: "bg-amber-500",
    progressClass: "bg-amber-400",
    autoDismissMs: 6000,
  },
  error: {
    Icon: XCircle,
    iconClass: "text-red-600",
    iconBgClass: "bg-red-50",
    accentClass: "bg-red-500",
    progressClass: "bg-red-400",
  },
  critical: {
    Icon: ShieldAlert,
    iconClass: "text-red-100",
    iconBgClass: "bg-red-700/40",
    accentClass: "bg-red-950",
    progressClass: "bg-red-300",
  },
  default: {
    Icon: Info,
    iconClass: "text-gray-500",
    iconBgClass: "bg-gray-100",
    accentClass: "bg-gray-400",
    progressClass: "bg-gray-400",
    autoDismissMs: 5000,
  },
  destructive: {
    Icon: XCircle,
    iconClass: "text-red-100",
    iconBgClass: "bg-red-700/40",
    accentClass: "bg-red-700",
    progressClass: "bg-red-300",
  },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const key = (variant ?? "default") as VariantKey
        const config = VARIANT_CONFIG[key] ?? VARIANT_CONFIG.default
        const { Icon, iconClass, iconBgClass, accentClass, progressClass, autoDismissMs } = config

        return (
          <Toast key={id} variant={variant} {...props}>
            {/* Left accent bar */}
            <div
              aria-hidden
              className={`absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl ${accentClass}`}
            />

            {/* Content row */}
            <div className="flex items-start gap-3 flex-1 pl-5 pr-8 py-3.5">
              {/* Icon bubble */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBgClass}`}
              >
                <Icon className={`h-4 w-4 ${iconClass}`} strokeWidth={2.2} />
              </div>

              {/* Text */}
              <div className="grid min-w-0 pt-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>

            {action}
            <ToastClose />

            {/* Auto-dismiss progress bar */}
            {autoDismissMs && (
              <div
                aria-hidden
                className={`absolute bottom-0 left-0 h-[3px] w-full origin-left ${progressClass} opacity-25`}
                style={{
                  animation: `toast-progress ${autoDismissMs}ms linear forwards`,
                }}
              />
            )}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
