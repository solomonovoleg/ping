export function PulseProfileLayoutKeyframes() {
  return (
    <style>{`
      @keyframes pulse-profile-avatar-float {
        0%, 100% { transform: translateX(0px); }
        33% { transform: translateX(2.5px); }
        66% { transform: translateX(-2px); }
      }
    `}</style>
  );
}
