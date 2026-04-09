'use client'

export function EmptyState({ text }: { text: string }) {
  return <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">{text}</div>
}
