import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

/** Ловит необработанные ошибки в дереве и показывает запасной UI вместо падения всего приложения. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <p className="text-lg font-medium text-foreground">Что-то пошло не так</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Произошла ошибка. Обновите страницу или вернитесь назад.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-xs text-muted-foreground max-w-full overflow-auto p-3 bg-muted rounded-lg">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="min-h-[var(--uix-touch-min)] px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:opacity-90"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[var(--uix-touch-min)] px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
