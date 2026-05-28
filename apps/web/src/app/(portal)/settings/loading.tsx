export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-36 bg-white/10 rounded" />
        <div className="h-3 w-56 bg-white/5 rounded" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between h-12 rounded-xl bg-white/5 border border-white/5 px-4">
            <div className="h-3 w-32 bg-white/10 rounded" />
            <div className="h-5 w-10 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
