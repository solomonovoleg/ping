import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, MessageCircle } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] w-full max-w-full min-w-0 overflow-x-hidden flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted">
              <AlertCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Страница не найдена</h1>
            <p className="text-sm text-muted-foreground">
              Такой страницы нет. Проверьте адрес или перейдите в чаты.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 min-h-[var(--uix-touch-min)]"
                onClick={() => setLocation("/")}
                aria-label="Перейти в чаты"
              >
                <MessageCircle className="w-4 h-4" />
                В чаты
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2 min-h-[var(--uix-touch-min)]"
                onClick={() => setLocation("/posts")}
                aria-label="Перейти на главную"
              >
                <Home className="w-4 h-4" />
                На главную
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
