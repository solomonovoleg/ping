/**
 * Уровень громкости по MediaStream (аудиодорожка) через AnalyserNode.
 */
export function createStreamLevelReader(stream: MediaStream): () => number {
  const track = stream.getAudioTracks()[0];
  if (!track || track.readyState !== "live") {
    return () => 0;
  }
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let data: Uint8Array | null = null;
  try {
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    data = new Uint8Array(analyser.frequencyBinCount);
  } catch {
    return () => 0;
  }

  return () => {
    if (!analyser || !data) return 0;
    try {
      analyser.getByteFrequencyData(data);
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i];
      return s / data.length / 255;
    } catch {
      return 0;
    }
  };
}

export function pickDominantSpeaker(
  levels: Map<string, () => number>,
  localUserId: string,
  localLevel: () => number,
  threshold = 0.06,
  /** Предыдущий «говорящий» — не переключаемся без заметного перевеса (меньше дёрганья UI / ducking). */
  previous: string | null = null,
  stickiness = 0.042,
): string | null {
  let best: string | null = null;
  let bestV = threshold;
  const lv = localLevel();
  if (lv > bestV) {
    best = localUserId;
    bestV = lv;
  }
  levels.forEach((read, uid) => {
    const v = read();
    if (v > bestV) {
      best = uid;
      bestV = v;
    }
  });

  if (!previous || !best || previous === best) return best;

  const prevV = previous === localUserId ? localLevel() : levels.get(previous)?.() ?? 0;
  if (prevV >= threshold && bestV <= prevV + stickiness) return previous;
  return best;
}
