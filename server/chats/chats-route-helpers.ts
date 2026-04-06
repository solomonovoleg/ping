import type { Response } from "express";
import { ChatsServiceError } from "./chats-service-error";

export function chatRouteParam(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

/** @returns true если ответ уже отправлен */
export function respondChatsServiceError(res: Response, error: unknown): boolean {
  if (error instanceof ChatsServiceError) {
    res.status(error.status).json({ message: error.message });
    return true;
  }
  return false;
}
