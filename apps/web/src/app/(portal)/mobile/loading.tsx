export default function MobileLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-44 bg-white/10 rounded" />
        <div className="h-3 w-64 bg-white/5 rounded" />
      </div>
      <div className="flex justify-center">
        <div className="w-64 h-[500px] rounded-[40px] bg-white/5 border border-white/10" />
      </div>
    </div>
  );
}
