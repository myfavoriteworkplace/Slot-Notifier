import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm flex flex-col items-center text-center gap-5 animate-in fade-in duration-200">

          {/* Icon */}
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          {/* Copy */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              An unexpected error occurred. Your data is safe — nothing was lost.
              Please try reloading the page.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              onClick={() => window.location.reload()}
              className="flex-1 gap-2 active:scale-[0.98] transition-transform"
              data-testid="button-reload-page"
            >
              <RefreshCw className="h-4 w-4" />
              Reload page
            </Button>
            <Button
              variant="outline"
              onClick={this.handleReset}
              className="flex-1 active:scale-[0.98] transition-transform"
              data-testid="button-try-again"
            >
              Try again
            </Button>
          </div>

          {/* Error detail — dev only */}
          {import.meta.env.DEV && this.state.error && (
            <details className="w-full text-left rounded-xl border border-border/50 bg-muted/30 overflow-hidden">
              <summary className="px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:bg-muted/50 transition-colors">
                Error details (dev only)
              </summary>
              <pre className="px-4 py-3 text-[11px] text-destructive overflow-x-auto leading-relaxed border-t border-border/40">
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}

        </div>
      </div>
    );
  }
}
