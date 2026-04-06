import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallbackScreen } from "./ErrorFallbackScreen";

type Props = {
  children: ReactNode;
  /** Кастомный fallback вместо дефолтного (для модалок, просмотрщиков). */
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
};
type State = { hasError: boolean; error: Error | null };

const TRANSIENT_ERROR_RE =
  /(Failed to fetch|NetworkError|Load failed|dynamically imported module|Loading chunk|Importing a module script failed|not a valid JavaScript MIME type|timeout)/i;

function isTransientError(error: Error | null): boolean {
  if (!error) return false;
  return TRANSIENT_ERROR_RE.test(error.message ?? "");
}

/** Ловит необработанные ошибки в дереве и показывает запасной UI вместо падения всего приложения. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  componentDidMount(): void {
    window.addEventListener("online", this.handleOnline);
  }

  componentWillUnmount(): void {
    window.removeEventListener("online", this.handleOnline);
  }

  private resetBoundary = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleOnline = (): void => {
    if (!this.state.hasError) return;
    if (!isTransientError(this.state.error)) return;
    this.resetBoundary();
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (fallback) {
        const node = typeof fallback === "function" ? fallback(this.resetBoundary) : fallback;
        return node;
      }
      const transient = isTransientError(this.state.error);
      return (
        <ErrorFallbackScreen
          title="Что-то пошло не так"
          subtitle={
            transient
              ? "Временный сбой загрузки. Попробуйте ещё раз — обычно помогает."
              : "Произошла ошибка. Попробуйте обновить страницу."
          }
          onRetry={this.resetBoundary}
          onBack={() => window.history.back()}
          devError={
            import.meta.env.DEV && this.state.error
              ? this.state.error.message
              : null
          }
        />
      );
    }
    return this.props.children;
  }
}
