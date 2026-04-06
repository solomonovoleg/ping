import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminPanelCard, AdminSectionTemplate, adminPageStackClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminHelpPage,
  fetchAdminHelpPages,
  updateAdminHelpPage,
  type AdminHelpPageRow,
} from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const SLUG_HINT = "латиница, цифры, дефис, например install-app";

export default function AdminHelpPages() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminHelpPageRow | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftSort, setDraftSort] = useState("0");
  const [createOpen, setCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const { data: pages = [], isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "help-pages"],
    queryFn: fetchAdminHelpPages,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Нет выбранной страницы");
      const sort = parseInt(draftSort.trim(), 10);
      return updateAdminHelpPage(editing.slug, {
        title: draftTitle.trim(),
        body: draftBody,
        sortOrder: Number.isFinite(sort) ? sort : editing.sortOrder,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "help-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["help-page"] });
      void queryClient.invalidateQueries({ queryKey: ["help-pages-list"] });
      toast({ title: "Сохранено" });
      setEditing(null);
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createAdminHelpPage({
        slug: newSlug.trim().toLowerCase(),
        title: newTitle.trim(),
        body: "## Заголовок\n\nТекст абзаца.",
        sortOrder: pages.length ? Math.max(...pages.map((p) => p.sortOrder)) + 1 : 1,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "help-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["help-pages-list"] });
      toast({ title: "Страница создана" });
      setCreateOpen(false);
      setNewSlug("");
      setNewTitle("");
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const openEdit = (p: AdminHelpPageRow) => {
    setEditing(p);
    setDraftTitle(p.title);
    setDraftBody(p.body);
    setDraftSort(String(p.sortOrder));
  };

  const publicUrl = (slug: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/help/${encodeURIComponent(slug)}`;

  const copyLink = (slug: string) => {
    const url = publicUrl(slug);
    void navigator.clipboard.writeText(url).then(
      () => toast({ title: "Ссылка скопирована", description: url }),
      () => toast({ title: "Не удалось скопировать", variant: "destructive" })
    );
  };

  return (
    <div className={cn(adminPageStackClass(), "space-y-6")}>
      <AdminPageHeader
        title={
          <>
            <BookOpen className="h-7 w-7 shrink-0 opacity-90" aria-hidden />
            Справочные страницы
          </>
        }
        description={
          <>
            Тексты для разделов <code className="text-xs">/help/…</code> в приложении (видны только авторизованным
            пользователям). Разметка: абзацы через пустую строку, подзаголовки{" "}
            <code className="text-xs">## Заголовок</code>. Спецстраницы: <code className="text-xs">invite-friends</code>,{" "}
            <code className="text-xs">install-app</code>.
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setCreateOpen((o) => !o)}>
          <Plus className="w-4 h-4 mr-2" />
          Новая страница
        </Button>
      </div>

      {createOpen ? (
        <AdminPanelCard className="max-w-md space-y-3 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Создать</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="hp-slug">Slug URL</Label>
              <Input
                id="hp-slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-topic"
                maxLength={64}
              />
              <p className="text-xs text-muted-foreground mt-1">{SLUG_HINT}</p>
            </div>
            <div>
              <Label htmlFor="hp-title">Заголовок</Label>
              <Input
                id="hp-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value.slice(0, 500))}
                placeholder="Название в меню"
              />
            </div>
            <Button
              type="button"
              disabled={!newSlug.trim() || !newTitle.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Создание…" : "Создать"}
            </Button>
          </div>
        </AdminPanelCard>
      ) : null}

      <AdminSectionTemplate
        title="Все страницы"
        isLoading={isLoading}
        loadingRows={3}
        error={error}
        onRetry={() => void refetch()}
        errorTitle="Не удалось загрузить справочные страницы"
        empty={pages.length === 0}
        emptyIcon={BookOpen}
        emptyTitle="Справочные страницы пока отсутствуют"
        emptyDescription="Создайте первую страницу, чтобы пользователи видели раздел Help внутри приложения."
        emptyActionLabel="Новая страница"
        onEmptyAction={() => setCreateOpen(true)}
      >
        <ul className="space-y-2">
          {pages.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  /help/{p.slug} · sort {p.sortOrder}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => copyLink(p.slug)}>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Ссылка
                </Button>
                <Button type="button" size="sm" onClick={() => openEdit(p)}>
                  Редактировать
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </AdminSectionTemplate>

      {editing ? (
        <AdminPanelCard className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Редактирование: {editing.slug}</h2>
            <p className="mt-1 break-all text-xs admin-text-muted">{publicUrl(editing.slug)}</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ed-title">Заголовок</Label>
              <Input id="ed-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value.slice(0, 500))} />
            </div>
            <div>
              <Label htmlFor="ed-sort">Порядок в меню (число)</Label>
              <Input id="ed-sort" value={draftSort} onChange={(e) => setDraftSort(e.target.value)} className="max-w-[120px]" />
            </div>
            <div>
              <Label htmlFor="ed-body">Текст</Label>
              <Textarea
                id="ed-body"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="min-h-[280px] font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !draftTitle.trim()}>
                {saveMut.isPending ? "Сохранение…" : "Сохранить"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </AdminPanelCard>
      ) : null}
    </div>
  );
}
