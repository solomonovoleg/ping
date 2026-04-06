interface DesktopMainSurfaceProps {
  children: React.ReactNode;
}

export function DesktopMainSurface({ children }: DesktopMainSurfaceProps) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-3 lg:px-6">
      <div className="min-h-full rounded-2xl border border-border/45 bg-card/30 p-3 shadow-sm shadow-black/[0.03] lg:p-4">
        {children}
      </div>
    </div>
  );
}
