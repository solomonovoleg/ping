import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { fetchDashboardStats } from "@/lib/admin";
import { Users, UserX, UserMinus, UserPlus } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-12 rounded bg-muted" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Не удалось загрузить статистику"}
        </p>
      </div>
    );
  }

  const cards = [
    { title: "Всего пользователей", value: stats.total, icon: Users },
    { title: "Заблокировано", value: stats.blocked, icon: UserX },
    { title: "Удалено (скрыто)", value: stats.deleted, icon: UserMinus },
    { title: "За сегодня", value: stats.registeredToday, icon: UserPlus },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title} className="overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
