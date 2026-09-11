export default function Loading() {
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-pulse">
      <div className="mb-6 border-b border-border pb-4 space-y-3">
        <div className="h-7 w-48 bg-surface-highlight rounded" />
        <div className="h-4 w-72 bg-surface-highlight rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-24 bg-surface-highlight rounded-xl" />
        <div className="h-12 bg-surface-highlight rounded-xl" />
        <div className="h-12 bg-surface-highlight rounded-xl" />
        <div className="h-12 bg-surface-highlight rounded-xl" />
      </div>
    </div>
  )
}
