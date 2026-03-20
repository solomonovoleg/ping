export type CallCommandIntent = {
  intentType: "save_to_tasks";
  title: string;
  payload: { segmentIds: string[] };
};

const SAVE_TASKS_PATTERNS = [
  /запиши .*?(в задачи|как задачу)/i,
  /добавь .*?(в задачи|в трек)/i,
  /нужно .*?(зафиксировать|записать)/i,
  /это .*?(задача|нужно сделать)/i,
  /сделай .*?задач/i,
];

export function detectCallIntent(text: string, segmentId: string): CallCommandIntent | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const hit = SAVE_TASKS_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!hit) return null;
  return {
    intentType: "save_to_tasks",
    title: "Записать в задачи?",
    payload: { segmentIds: [segmentId] },
  };
}
