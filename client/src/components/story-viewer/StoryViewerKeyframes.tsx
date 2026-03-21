/** Keyframes для лайка и подсказки просмотров (inline в портале сториз). */
export function StoryViewerKeyframes() {
  return (
    <style>{`
      @keyframes pulseStoryHeartPop {
        0% { transform: scale(1); opacity: 1; }
        40% { transform: scale(1.45); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes pulseStoryLiveBlip {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.8); }
      }
    `}</style>
  );
}
