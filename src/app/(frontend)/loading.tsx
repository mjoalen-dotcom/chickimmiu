export default function Loading() {
  return (
    <main className="bg-cream-50 min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-cream-300 border-t-gold-500 rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground tracking-wide">載入中...</p>
      </div>
    </main>
  )
}
