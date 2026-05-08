import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface BackButtonProps {
  fallback?: string;
  className?: string;
  label?: string;
}

export function BackButton({ fallback = "/", className, label = "Back" }: BackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-primary transition-colors ${className ?? ""}`}
      data-testid="button-back"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
