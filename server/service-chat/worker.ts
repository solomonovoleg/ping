import { processServiceChatQueue } from "./service";

export async function processServiceChatWorker(): Promise<number> {
  return processServiceChatQueue(30);
}
