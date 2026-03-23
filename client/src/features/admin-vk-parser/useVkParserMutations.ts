import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  approveVkParserItem,
  createVkParserBinding,
  deleteVkParserBinding,
  rejectVkParserItem,
  runVkParserAllEnabled,
  runVkParserBindingNow,
  testVkParserToken,
  updateVkParserBinding,
  type AdminVkParserBinding,
} from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { QK_BINDINGS, QK_QUEUE } from "./constants";

function invalidateQueue(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: [...QK_QUEUE] });
}

export function useVkParserMutations(args: {
  editBinding: AdminVkParserBinding | null;
  setCreateOpen: (v: boolean) => void;
  setEditBinding: (v: AdminVkParserBinding | null) => void;
  resetForm: () => void;
  platformUserId: string;
  vkAccessToken: string;
  vkOwnerId: string;
  displayName: string;
  parseIntervalMinutes: string;
  postsPerRun: string;
  requireModeration: boolean;
  visibility: "public" | "followers";
  cityLine: string;
  enabled: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: () =>
      createVkParserBinding({
        platformUserId: args.platformUserId,
        vkAccessToken: args.vkAccessToken,
        vkOwnerId: args.vkOwnerId,
        displayName: args.displayName.trim() || null,
        parseIntervalMinutes: Number(args.parseIntervalMinutes),
        postsPerRun: Number(args.postsPerRun),
        requireModeration: args.requireModeration,
        visibility: args.visibility,
        cityLine: args.cityLine.trim() || null,
        enabled: args.enabled,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK_BINDINGS });
      args.setCreateOpen(false);
      args.resetForm();
      toast({ title: "Привязка создана" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!args.editBinding) throw new Error("Нет привязки");
      const patch: Parameters<typeof updateVkParserBinding>[1] = {
        displayName: args.displayName.trim() || null,
        vkOwnerId: args.vkOwnerId,
        parseIntervalMinutes: Number(args.parseIntervalMinutes),
        postsPerRun: Number(args.postsPerRun),
        requireModeration: args.requireModeration,
        visibility: args.visibility,
        cityLine: args.cityLine.trim() || null,
        enabled: args.enabled,
      };
      if (args.vkAccessToken.trim()) patch.vkAccessToken = args.vkAccessToken.trim();
      return updateVkParserBinding(args.editBinding.id, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK_BINDINGS });
      args.setEditBinding(null);
      args.resetForm();
      toast({ title: "Сохранено" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteVkParserBinding,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK_BINDINGS });
      toast({ title: "Удалено" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const runOneMut = useMutation({
    mutationFn: runVkParserBindingNow,
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: QK_BINDINGS });
      invalidateQueue(queryClient);
      toast({
        title: `Готово: новых ${r.created}, пропущено ${r.skipped}, дублей ${r.duplicates}`,
      });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const runAllMut = useMutation({
    mutationFn: runVkParserAllEnabled,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: QK_BINDINGS });
      invalidateQueue(queryClient);
      const ok = data.results.filter((x) => x.ok).length;
      toast({ title: `Запущено привязок: ${data.results.length}, успешно: ${ok}` });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const testTokenMut = useMutation({
    mutationFn: () => testVkParserToken(args.vkAccessToken.trim()),
    onSuccess: (r) => toast({ title: `Токен OK, vk id: ${r.vkUserId}` }),
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: approveVkParserItem,
    onSuccess: () => {
      invalidateQueue(queryClient);
      toast({ title: "Опубликовано в ленте" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: rejectVkParserItem,
    onSuccess: () => {
      invalidateQueue(queryClient);
      toast({ title: "Отклонено" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  return {
    createMut,
    updateMut,
    deleteMut,
    runOneMut,
    runAllMut,
    testTokenMut,
    approveMut,
    rejectMut,
  };
}
