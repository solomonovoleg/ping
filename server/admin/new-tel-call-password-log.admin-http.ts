import type { Express, Request, Response } from "express";
import {
  aggregateNewTelCallPasswordLog,
  aggregateNewTelCallPasswordLogByDay,
  countNewTelCallPasswordLogSince,
  listNewTelCallPasswordLogRows,
} from "../auth/new-tel/new-tel-call-password-log.repo";

const MAX_DAYS = 90;
const ROW_LIMIT = 2000;

export function registerAdminNewTelCallPasswordLogRoutes(app: Express): void {
  app.get("/api/admin/new-tel-call-password-log", async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const daysRaw = Number(req.query.days ?? 14);
      const days = Math.min(MAX_DAYS, Math.max(1, Math.floor(Number.isFinite(daysRaw) ? daysRaw : 14)));
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const [summary, byDay, rows, totalCount] = await Promise.all([
        aggregateNewTelCallPasswordLog(from),
        aggregateNewTelCallPasswordLogByDay(from),
        listNewTelCallPasswordLogRows(from, ROW_LIMIT),
        countNewTelCallPasswordLogSince(from),
      ]);
      const truncated = totalCount > ROW_LIMIT;
      res.json({
        days,
        from: from.toISOString(),
        summary,
        byDay,
        rows,
        truncated,
        rowLimit: ROW_LIMIT,
      });
    } catch (e) {
      console.error("new-tel-call-password-log", e);
      const err = e as { code?: string; message?: string };
      const pg = typeof err.code === "string" ? err.code : "";
      let hint = "";
      if (pg === "42P01") {
        hint =
          " В БД нет таблицы new_tel_call_password_log — на сервере выполните: node scripts/run-migrations.cjs (или ваш шаг деплоя с миграциями).";
      } else if (pg === "42703") {
        hint =
          " В таблице журнала нет колонки (часто detail) — догоните миграции: scripts/migrate-new-tel-call-password-log-detail.cjs в цепочке run-migrations.cjs.";
      }
      res.status(500).json({
        message: `Не удалось загрузить журнал New-Tel.${hint}`,
        postgresCode: pg || undefined,
      });
    }
  });
}
