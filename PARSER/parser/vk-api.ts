const VK_API_VERSION = "5.199";
const USER_AGENT = "PingMootVkParser/1.0";

/** Слишком частые запросы / flood (частично пересекаются). */
const RETRYABLE_VK_ERROR_CODES = new Set([6, 9, 29]);

type VkError = { error_code: number; error_msg: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Вызов метода VK API (GET). При 6/9/29 — пауза и до 3 попыток.
 * @see https://dev.vk.com/reference/errors
 */
export async function vkApiGet<T>(method: string, searchParams: URLSearchParams): Promise<T> {
  searchParams.set("v", VK_API_VERSION);
  const url = `https://api.vk.com/method/${method}?${searchParams.toString()}`;
  let lastMsg = "VK API: ошибка после повторов";

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(600 * attempt);
    }
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const json = (await res.json()) as { response?: T; error?: VkError };
    if (json.error) {
      const code = json.error.error_code;
      const msg = json.error.error_msg || `VK error ${code}`;
      if (RETRYABLE_VK_ERROR_CODES.has(code) && attempt < 2) {
        lastMsg = msg;
        continue;
      }
      throw new Error(msg);
    }
    if (json.response === undefined) {
      throw new Error("VK API: пустой response");
    }
    return json.response;
  }
  throw new Error(lastMsg);
}
