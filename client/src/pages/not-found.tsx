import { ErrorFallbackScreen } from "@/components/ErrorFallbackScreen";

export default function NotFound() {
  return (
    <ErrorFallbackScreen
      code="404"
      title="Страница не найдена"
      subtitle="Такой страницы нет. Проверьте адрес или вернитесь назад."
      onRetry={() => window.location.reload()}
      onBack={() => window.history.back()}
    />
  );
}
