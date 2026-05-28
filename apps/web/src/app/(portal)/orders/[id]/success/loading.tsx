export default function OrderSuccessLoading() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-5 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-white/10" />
      <div className="h-6 w-56 rounded bg-white/10" />
      <div className="h-4 w-72 rounded bg-white/5" />
      <div className="flex gap-3 mt-4">
        <div className="h-9 w-32 rounded-lg bg-white/10" />
        <div className="h-9 w-32 rounded-lg bg-white/5" />
      </div>
    </div>
  );
}
