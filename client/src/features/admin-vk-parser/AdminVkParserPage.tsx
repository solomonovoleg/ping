import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { TapScaleButton } from "@/components/ui/tap-scale";
import type { AdminVkParserBinding } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { Download, Loader2 } from "lucide-react";
import { VkParserBindingsCard } from "./VkParserBindingsCard";
import { VkParserDialogs } from "./VkParserDialogs";
import { VkParserQueueCard } from "./VkParserQueueCard";
import { useVkParserData } from "./useVkParserData";
import { useVkParserMutations } from "./useVkParserMutations";
import { AdminPageHeader, adminPageStackClass } from "@/features/admin-shell";

export default function AdminVkParserPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editBinding, setEditBinding] = useState<AdminVkParserBinding | null>(null);

  const d = useVkParserData(createOpen, editBinding);

  const m = useVkParserMutations({
    editBinding,
    setCreateOpen,
    setEditBinding,
    resetForm: d.resetForm,
    platformUserId: d.platformUserId,
    vkAccessToken: d.vkAccessToken,
    vkOwnerId: d.vkOwnerId,
    displayName: d.displayName,
    parseIntervalMinutes: d.parseIntervalMinutes,
    postsPerRun: d.postsPerRun,
    requireModeration: d.requireModeration,
    visibility: d.visibility,
    cityLine: d.cityLine,
    enabled: d.enabled,
  });

  const handleOpenCreate = () => {
    d.resetForm();
    setCreateOpen(true);
  };

  const handleOpenEdit = (b: AdminVkParserBinding) => {
    setEditBinding(b);
    d.fillFormFromBinding(b);
  };

  return (
    <div className={cn(adminPageStackClass(), "w-full max-w-full min-w-0 space-y-8")}>
      <AdminPageHeader
        title={
          <>
            <Download className="h-7 w-7 shrink-0 opacity-80" aria-hidden />
            Парсер ВК
          </>
        }
        description={
          <>
            <p>
              Посты из стены сообщества ВКонтакте публикуются от имени выбранного пользователя PING. Список пользователей для
              автора постов берётся из основной базы сайта (как в разделе «Пользователи»). Отдельный сервис импорта на сервере
              нужен для опроса ВК, привязок и очереди — если он выключен, не загрузятся привязки и очередь (это не ошибка в
              ваших токенах).
            </p>
            <p className="mt-2">
              Привязок может быть сколько угодно: для разных людей — отдельно; одному человеку — несколько разных стен (разный{" "}
              <span className="font-mono">owner_id</span>). Одну и ту же пару «автор + стена» дублировать нельзя. Токен ВК в
              базе хранится в зашифрованном виде; фото сохраняются на ваш сервер или в S3.
            </p>
          </>
        }
        actions={
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <TapScaleButton
              type="button"
              haptic
              className={cn(
                buttonVariants({ variant: "secondary", size: "default" }),
                "min-h-[var(--uix-touch-min)] w-full justify-center sm:w-auto",
              )}
              onClick={handleOpenCreate}
            >
              Новая привязка
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              disabled={m.runAllMut.isPending}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "min-h-[var(--uix-touch-min)] w-full justify-center sm:w-auto",
              )}
              onClick={() => m.runAllMut.mutate()}
            >
              {m.runAllMut.isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              Запустить все
            </TapScaleButton>
          </div>
        }
      />

      <section className="space-y-8" aria-label="Парсер ВК: привязки и очередь">
        <VkParserBindingsCard
          bindings={d.bindings}
          loading={d.bindingsLoading}
          fetching={d.bindingsFetching}
          error={d.bindingsError}
          onRetry={() => d.refetchBindings()}
          onOpenCreate={handleOpenCreate}
          onOpenEdit={handleOpenEdit}
          runOneMut={m.runOneMut}
          deleteMut={m.deleteMut}
        />

        <VkParserQueueCard
          bindings={d.bindings}
          bindingsLoading={d.bindingsLoading}
          queueStatusFilter={d.queueStatusFilter}
          setQueueStatusFilter={d.setQueueStatusFilter}
          queueBindingFilter={d.queueBindingFilter}
          setQueueBindingFilter={d.setQueueBindingFilter}
          queuePage={d.queuePage}
          setQueuePage={d.setQueuePage}
          queue={d.queue}
          queueTotal={d.queueTotal}
          queueFrom={d.queueFrom}
          queueTo={d.queueTo}
          queueTotalPages={d.queueTotalPages}
          queueLoading={d.queueLoading}
          queueFetching={d.queueFetching}
          queueError={d.queueError}
          refetchQueue={() => d.refetchQueue()}
          bindingLabel={d.bindingLabel}
          approveMut={m.approveMut}
          rejectMut={m.rejectMut}
        />
      </section>

      <VkParserDialogs
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        editBindingId={editBinding?.id ?? null}
        onCloseEdit={() => setEditBinding(null)}
        users={d.users}
        userSearch={d.userSearch}
        setUserSearch={d.setUserSearch}
        platformUserId={d.platformUserId}
        setPlatformUserId={d.setPlatformUserId}
        vkAccessToken={d.vkAccessToken}
        setVkAccessToken={d.setVkAccessToken}
        vkOwnerId={d.vkOwnerId}
        setVkOwnerId={d.setVkOwnerId}
        displayName={d.displayName}
        setDisplayName={d.setDisplayName}
        parseIntervalMinutes={d.parseIntervalMinutes}
        setParseIntervalMinutes={d.setParseIntervalMinutes}
        postsPerRun={d.postsPerRun}
        setPostsPerRun={d.setPostsPerRun}
        requireModeration={d.requireModeration}
        setRequireModeration={d.setRequireModeration}
        visibility={d.visibility}
        setVisibility={d.setVisibility}
        cityLine={d.cityLine}
        setCityLine={d.setCityLine}
        enabled={d.enabled}
        setEnabled={d.setEnabled}
        createMut={m.createMut}
        updateMut={m.updateMut}
        testTokenMut={m.testTokenMut}
        usersFetching={d.usersFetching}
        usersError={d.usersError}
        onRetryUsers={() => void d.refetchUsers()}
      />
    </div>
  );
}
