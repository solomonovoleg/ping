import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { BindingFormFields } from "./BindingFormFields";
import type { VkParserFormUserOption } from "./BindingFormFields";

export function VkParserDialogs(props: {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  editBindingId: string | null;
  onCloseEdit: () => void;
  users: VkParserFormUserOption[];
  userSearch: string;
  setUserSearch: (v: string) => void;
  platformUserId: string;
  setPlatformUserId: (v: string) => void;
  vkAccessToken: string;
  setVkAccessToken: (v: string) => void;
  vkOwnerId: string;
  setVkOwnerId: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  parseIntervalMinutes: string;
  setParseIntervalMinutes: (v: string) => void;
  postsPerRun: string;
  setPostsPerRun: (v: string) => void;
  requireModeration: boolean;
  setRequireModeration: (v: boolean) => void;
  visibility: "public" | "followers";
  setVisibility: (v: "public" | "followers") => void;
  cityLine: string;
  setCityLine: (v: string) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  createMut: UseMutationResult<unknown, Error, void, unknown>;
  updateMut: UseMutationResult<unknown, Error, void, unknown>;
  testTokenMut: UseMutationResult<{ vkUserId: number }, Error, void, unknown>;
}) {
  const createBusy = props.createMut.isPending;
  const updateBusy = props.updateMut.isPending;
  const testBusy = props.testTokenMut.isPending;

  return (
    <>
      <Dialog open={props.createOpen} onOpenChange={props.setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новая привязка ВК</DialogTitle>
            <DialogDescription>
              Токен хранится зашифрованным. После сохранения проверьте первый прогон кнопкой «Сканировать» в списке привязок.
            </DialogDescription>
          </DialogHeader>
          <BindingFormFields
            platformUserId={props.platformUserId}
            setPlatformUserId={props.setPlatformUserId}
            userSearch={props.userSearch}
            setUserSearch={props.setUserSearch}
            users={props.users}
            vkAccessToken={props.vkAccessToken}
            setVkAccessToken={props.setVkAccessToken}
            vkOwnerId={props.vkOwnerId}
            setVkOwnerId={props.setVkOwnerId}
            displayName={props.displayName}
            setDisplayName={props.setDisplayName}
            parseIntervalMinutes={props.parseIntervalMinutes}
            setParseIntervalMinutes={props.setParseIntervalMinutes}
            postsPerRun={props.postsPerRun}
            setPostsPerRun={props.setPostsPerRun}
            requireModeration={props.requireModeration}
            setRequireModeration={props.setRequireModeration}
            visibility={props.visibility}
            setVisibility={props.setVisibility}
            cityLine={props.cityLine}
            setCityLine={props.setCityLine}
            enabled={props.enabled}
            setEnabled={props.setEnabled}
            formDisabled={createBusy}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[var(--uix-touch-min)] w-full sm:w-auto"
              disabled={!props.vkAccessToken.trim() || testBusy || createBusy}
              onClick={() => props.testTokenMut.mutate()}
            >
              {testBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
              Проверить токен
            </Button>
            <Button
              type="button"
              className="min-h-[var(--uix-touch-min)] w-full sm:w-auto"
              disabled={
                createBusy || !props.platformUserId || !props.vkAccessToken.trim() || !props.vkOwnerId.trim()
              }
              onClick={() => props.createMut.mutate()}
            >
              {createBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!props.editBindingId} onOpenChange={(o) => !o && props.onCloseEdit()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать привязку</DialogTitle>
            <DialogDescription>
              Автор постов на платформе сменить нельзя. Новый токен ВК указывайте только если нужно заменить доступ.
            </DialogDescription>
          </DialogHeader>
          <BindingFormFields
            platformUserId={props.platformUserId}
            setPlatformUserId={props.setPlatformUserId}
            userSearch={props.userSearch}
            setUserSearch={props.setUserSearch}
            users={props.users}
            vkAccessToken={props.vkAccessToken}
            setVkAccessToken={props.setVkAccessToken}
            vkOwnerId={props.vkOwnerId}
            setVkOwnerId={props.setVkOwnerId}
            displayName={props.displayName}
            setDisplayName={props.setDisplayName}
            parseIntervalMinutes={props.parseIntervalMinutes}
            setParseIntervalMinutes={props.setParseIntervalMinutes}
            postsPerRun={props.postsPerRun}
            setPostsPerRun={props.setPostsPerRun}
            requireModeration={props.requireModeration}
            setRequireModeration={props.setRequireModeration}
            visibility={props.visibility}
            setVisibility={props.setVisibility}
            cityLine={props.cityLine}
            setCityLine={props.setCityLine}
            enabled={props.enabled}
            setEnabled={props.setEnabled}
            tokenHint="Оставьте пустым, чтобы не менять"
            lockPlatformUser
            formDisabled={updateBusy}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[var(--uix-touch-min)] w-full sm:w-auto"
              disabled={!props.vkAccessToken.trim() || testBusy || updateBusy}
              onClick={() => props.testTokenMut.mutate()}
            >
              {testBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
              Проверить новый токен
            </Button>
            <Button
              type="button"
              className="min-h-[var(--uix-touch-min)] w-full sm:w-auto"
              disabled={updateBusy}
              onClick={() => props.updateMut.mutate()}
            >
              {updateBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
