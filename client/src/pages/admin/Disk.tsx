import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminMetricTile, AdminPageHeader, AdminPanelCard, adminPageStackClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { HardDrive, AlertTriangle, Cpu } from "lucide-react";
import { fetchOpsDisk } from "@/features/admin-ops/api";

const QK = ["admin", "ops", "disk"] as const;

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  if (i === 0) return `${Math.round(v)} ${units[i]}`;
  return `${v >= 10 || i < 2 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 10 ? n.toFixed(1) : n.toFixed(2)}%`;
}

function sectionTitle(section: "uploads" | "database" | "disk"): string {
  if (section === "uploads") return "Файлы в uploads/";
  if (section === "database") return "PostgreSQL";
  return "Том диска (statfs)";
}

function projectMeasureLabel(source: "du" | "walk_skipped" | "none"): string {
  if (source === "du") return "du — полное дерево каталога";
  if (source === "walk_skipped") return "обход без node_modules и .git";
  return "не удалось измерить";
}

function fmtLoad(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export default function AdminDiskPage() {
  const { data, isLoading, error, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: QK,
    queryFn: fetchOpsDisk,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className={cn(adminPageStackClass(), "space-y-6")}>
        <Skeleton className="h-10 w-56 rounded-lg bg-[hsl(var(--admin-elevated))]" />
        <div className="admin-surface-card space-y-3 p-5 sm:p-6">
          <Skeleton className="h-5 w-48 bg-[hsl(var(--admin-elevated-strong))]" />
          <Skeleton className="mt-2 h-4 w-full max-w-xl bg-[hsl(var(--admin-elevated-strong))]" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-12 w-full bg-[hsl(var(--admin-elevated-strong))]" />
            <Skeleton className="h-12 w-full bg-[hsl(var(--admin-elevated-strong))]" />
            <Skeleton className="h-12 w-full bg-[hsl(var(--admin-elevated-strong))]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn(adminPageStackClass(), "space-y-4")}>
        <AdminPageHeader title="Диск" description="Статистика тома, uploads и нагрузка сервера." showUserChrome={false} />
        <AdminPanelCard className="space-y-3 p-5 sm:p-6">
          <p className="text-sm text-[hsl(0_72%_62%)]">Не удалось загрузить статистику.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Повторить
          </Button>
        </AdminPanelCard>
      </div>
    );
  }

  const mount = data.mount;
  const uploadRows = data.rows.filter((r) => r.section === "uploads");
  const maxUploadBytes = Math.max(1, ...uploadRows.map((r) => r.bytes));

  const uploadsTotalBytes = uploadRows.reduce((a, r) => a + r.bytes, 0);

  return (
    <div className={cn(adminPageStackClass(), "space-y-6")}>
      <AdminPageHeader
        title={
          <>
            <HardDrive className="h-7 w-7 shrink-0 opacity-90" aria-hidden />
            Диск
          </>
        }
        description={
          <>
            Объём по типам контента, том (statfs), нагрузка и папка проекта. Том:{" "}
            <span className="font-mono text-xs">{data.statfsPath}</span>
            {data.cwd !== data.statfsPath ? <span className="mt-0.5 block text-xs">cwd процесса: {data.cwd}</span> : null}
            {data.projectPath !== data.cwd ? (
              <span className="mt-0.5 block text-xs">
                Папка проекта: <span className="font-mono">{data.projectPath}</span>
              </span>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <span className="text-xs admin-text-muted">
              Обновлено: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString("ru-RU") : "—"}
              {isFetching ? " …" : ""}
            </span>
            <Button size="sm" variant="outline" className="h-8" onClick={() => refetch()}>
              Обновить
            </Button>
          </div>
        }
      />

      <div
        className={cn(
          "flex gap-2 rounded-md border px-3 py-2 text-sm",
          data.mediaStorageMode === "s3"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
            : "border-border/60 bg-muted/30 text-foreground",
        )}
        role="status"
      >
        {data.mediaStorageMode === "s3" ? (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        ) : (
          <HardDrive className="w-4 h-4 shrink-0 mt-0.5 opacity-80" aria-hidden />
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            Медиа: {data.mediaStorageMode === "s3" ? "объектное хранилище (S3)" : "локально на диске сервера"}
          </p>
          <p className="text-xs opacity-90">
            {data.mediaStorageMode === "s3"
              ? "Новые загрузки могут уходить в бакет. Каталог uploads/ на VPS часто меньше полного объёма медиа."
              : "Основной объём файлов в uploads/ на том же томе, что и отчёт ниже."}
          </p>
          {data.s3BucketProbe.ran ? (
            <p
              className={cn(
                "text-xs font-medium",
                data.s3BucketProbe.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive",
              )}
            >
              {data.s3BucketProbe.ok
                ? "Проверка бакета (HeadBucket): OK"
                : `Проверка бакета: ошибка — ${data.s3BucketProbe.error}`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Проверка бакета не запускалась. Для HeadBucket при открытии отчёта:{" "}
              <span className="font-mono">OPS_DISK_S3_HEAD_BUCKET=1</span> на сервере.
            </p>
          )}
        </div>
      </div>

      {data.mountError ? (
        <p className="text-sm text-destructive">
          Не удалось прочитать statfs: {data.mountError}
        </p>
      ) : null}

      <AdminPanelCard className="space-y-4 p-5 text-sm sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[hsl(210_20%_98%)]">
            <Cpu className="h-4 w-4" aria-hidden />
            Сервер и проект
          </h2>
          <p className="mt-1 text-sm admin-text-muted">
            RAM и CPU — хост целиком (процесс Node — RSS). Диск проекта и <span className="font-mono">uploads/</span> — доли
            от тома и дерева проекта.
          </p>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-1">
            <div className="font-mono text-xs break-all text-muted-foreground">{data.host.projectPath}</div>
            <div className="text-xs text-muted-foreground">{projectMeasureLabel(data.host.projectDiskSource)}</div>
            {data.host.projectDiskError ? (
              <p className="text-xs text-destructive">{data.host.projectDiskError}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Папка проекта на диске</div>
              <div className="text-lg font-semibold tabular-nums">
                {data.host.projectDiskBytes != null ? fmtBytes(data.host.projectDiskBytes) : "—"}
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>от размера тома: {fmtPct(data.host.projectPctOfMountTotal)}</div>
                <div>от занятого на томе: {fmtPct(data.host.projectPctOfMountUsed)}</div>
                <div>от свободного: {fmtPct(data.host.projectPctOfMountFree)}</div>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Каталог uploads/ (целиком)</div>
              <div className="text-lg font-semibold tabular-nums">
                {data.host.uploadsDirBytes != null ? fmtBytes(data.host.uploadsDirBytes) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                доля от папки проекта: {fmtPct(data.host.uploadsPctOfProjectDisk)}
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Память ОС</div>
              <div className="text-lg font-semibold tabular-nums">{fmtBytes(data.host.memUsedBytes)}</div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>
                  всего {fmtBytes(data.host.memTotalBytes)}, свободно {fmtBytes(data.host.memFreeBytes)}
                </div>
                <div>занято: {fmtPct(data.host.memUsedPct)}</div>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Процесс Node (RSS)</div>
              <div className="text-lg font-semibold tabular-nums">{fmtBytes(data.host.processRssBytes)}</div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>от RAM сервера: {fmtPct(data.host.processRssPctOfMemTotal)}</div>
                <div>от занятой RAM: {fmtPct(data.host.processRssPctOfMemUsed)}</div>
                <div>от размера папки проекта: {fmtPct(data.host.processRssPctOfProjectDisk)}</div>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-1 sm:col-span-2 lg:col-span-2">
              <div className="text-xs text-muted-foreground">CPU (load average)</div>
              <div className="text-base font-semibold tabular-nums">
                {fmtLoad(data.host.loadAvg1)} / {fmtLoad(data.host.loadAvg5)} / {fmtLoad(data.host.loadAvg15)}
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>логических ядер: {data.host.cpuCount}</div>
                <div>
                  нагрузка на ядро (1 мин):{" "}
                  {data.host.loadPerCore1 != null ? fmtLoad(data.host.loadPerCore1) : "—"} — условно «занято ядер»
                </div>
                <div className="text-muted-foreground/80">
                  На Windows load average может быть 0 — это ограничение ОС, не нулевая нагрузка.
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminPanelCard>

      {mount ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricTile>
            <p className="text-xs font-medium admin-text-muted">Том: всего</p>
            <p className="text-lg font-semibold tabular-nums text-[hsl(210_20%_98%)]">{fmtBytes(mount.totalBytes)}</p>
          </AdminMetricTile>
          <AdminMetricTile>
            <p className="text-xs font-medium admin-text-muted">Свободно</p>
            <p className="text-lg font-semibold tabular-nums text-[hsl(210_20%_98%)]">{fmtBytes(mount.freeBytes)}</p>
          </AdminMetricTile>
          <AdminMetricTile>
            <p className="text-xs font-medium admin-text-muted">Занято (том)</p>
            <p className="text-lg font-semibold tabular-nums text-[hsl(210_20%_98%)]">
              {fmtBytes(mount.usedBytes)}
              <span className="ml-2 text-sm font-normal admin-text-muted">
                ({fmtPct((mount.usedBytes / mount.totalBytes) * 100)})
              </span>
            </p>
          </AdminMetricTile>
          <AdminMetricTile>
            <p className="text-xs font-medium admin-text-muted">Сумма uploads/ (оценка)</p>
            <p className="text-lg font-semibold tabular-nums text-[hsl(210_20%_98%)]">
              {fmtBytes(uploadsTotalBytes)}
              <span className="ml-2 text-sm font-normal admin-text-muted">
                ({fmtPct((uploadsTotalBytes / mount.totalBytes) * 100)} тома)
              </span>
            </p>
          </AdminMetricTile>
        </div>
      ) : null}

      <AdminPanelCard className="space-y-8 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Разбивка</h2>
          <p className="mt-1 text-sm admin-text-muted">
            «% тома» — доля от размера ФС. «% свободно» — относительно оставшегося места (может быть &gt;100%).
          </p>
        </div>
        <div className="space-y-8">
          {(["uploads", "database", "disk"] as const).map((section) => {
            const rows = data.rows.filter((r) => r.section === section);
            if (rows.length === 0) return null;
            return (
              <div key={section} className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground/90">{sectionTitle(section)}</h2>
                <ul className="space-y-3">
                  {rows.map((r) => {
                    const barPct =
                      section === "uploads" ? Math.min(100, (r.bytes / maxUploadBytes) * 100) : null;
                    const showPctBars = section === "uploads";
                    return (
                      <li key={r.id} className="space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                          <span className="text-foreground min-w-0 flex-1">{r.label}</span>
                          <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                            {fmtBytes(r.bytes)}
                            {r.files != null ? (
                              <span className="text-xs ml-2 text-muted-foreground/80">
                                ({r.files.toLocaleString("ru-RU")} ф.)
                              </span>
                            ) : null}
                          </span>
                        </div>
                        {showPctBars ? (
                          <div
                            className="h-2 rounded-full bg-muted overflow-hidden"
                            role="presentation"
                            aria-hidden
                          >
                            <div
                              className="h-full rounded-full bg-primary/80"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        ) : null}
                        {section === "disk" ? null : (
                          <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                            <span>от тома: {fmtPct(r.pctOfDiskTotal)}</span>
                            <span>от свободного: {fmtPct(r.pctOfDiskFree)}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </AdminPanelCard>
    </div>
  );
}
