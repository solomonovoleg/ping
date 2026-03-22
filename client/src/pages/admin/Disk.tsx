import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-xl mt-2" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Диск</h1>
        <Card>
          <CardContent className="py-6 space-y-3">
            <p className="text-sm text-destructive">Не удалось загрузить статистику.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mount = data.mount;
  const uploadRows = data.rows.filter((r) => r.section === "uploads");
  const maxUploadBytes = Math.max(1, ...uploadRows.map((r) => r.bytes));

  const uploadsTotalBytes = uploadRows.reduce((a, r) => a + r.bytes, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="w-7 h-7 opacity-90" aria-hidden />
            Диск
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Объём по типам контента, том диска (statfs), нагрузка сервера и размер папки проекта — с долями от тома и
            от каталога приложения. Том: <span className="font-mono text-xs">{data.statfsPath}</span>
            {data.cwd !== data.statfsPath ? (
              <span className="block text-xs mt-0.5">cwd процесса: {data.cwd}</span>
            ) : null}
            {data.projectPath !== data.cwd ? (
              <span className="block text-xs mt-0.5">
                Папка проекта (DISK_PROJECT_PATH): <span className="font-mono">{data.projectPath}</span>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Обновлено:{" "}
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString("ru-RU") : "—"}
            {isFetching ? " …" : ""}
          </span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => refetch()}>
            Обновить
          </Button>
        </div>
      </div>

      {data.s3Configured ? (
        <div
          className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            Включён S3: новые файлы могут уходить в объектное хранилище. Локальные папки{" "}
            <span className="font-mono">uploads/</span> могут не отражать весь объём медиа.
          </span>
        </div>
      ) : null}

      {data.mountError ? (
        <p className="text-sm text-destructive">
          Не удалось прочитать statfs: {data.mountError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4" aria-hidden />
            Сервер и проект
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            RAM и CPU — хост целиком (процесс Node — строка RSS). Диск проекта — относительно размера тома и каталога
            приложения; папка <span className="font-mono">uploads/</span> — доля внутри измеренного дерева проекта.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
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
        </CardContent>
      </Card>

      {mount ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Том: всего</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold tabular-nums">{fmtBytes(mount.totalBytes)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Свободно</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold tabular-nums">{fmtBytes(mount.freeBytes)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Занято (том)</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold tabular-nums">
              {fmtBytes(mount.usedBytes)}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({fmtPct((mount.usedBytes / mount.totalBytes) * 100)})
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Сумма uploads/ (оценка)</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold tabular-nums">
              {fmtBytes(uploadsTotalBytes)}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({fmtPct((uploadsTotalBytes / mount.totalBytes) * 100)} тома)
              </span>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Разбивка</CardTitle>
          <p className="text-sm text-muted-foreground">
            «% тома» — доля от общего размера файловой системы. «% свободно» — насколько строка велика относительно
            оставшегося свободного места (если свободно мало, процент может быть больше 100%).
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
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
        </CardContent>
      </Card>
    </div>
  );
}
