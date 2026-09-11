export default function Loading() {
  return (
    <div className="p-8 max-w-5xl mx-auto animate-pulse">
      <div className="mb-8 border-b border-border pb-6 space-y-3">
        <div className="h-8 w-56 bg-surface-highlight rounded" />
        <div className="h-4 w-80 bg-surface-highlight rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-16 bg-surface-highlight rounded-xl" />
        <div className="h-16 bg-surface-highlight rounded-xl" />
        <div className="h-16 bg-surface-highlight rounded-xl" />
      </div>
    </div>
  )
}
