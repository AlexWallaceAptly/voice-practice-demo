export function LevelMeter({ level }: { level: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, level)) * 100)
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Microphone level"
    >
      <div
        className="h-full rounded-full bg-emerald-500 transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
