'use client'

import clsx from 'clsx'
import { Database, MoreHorizontal, Terminal } from 'lucide-react'

export function ChatSessionHeader({
  title,
  knowledgeBaseName,
  isDebugOpen,
  onToggleDebug,
}: {
  title: string
  knowledgeBaseName: string
  isDebugOpen: boolean
  onToggleDebug: () => void
}) {
  return (
    <div className="z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
          <Database className="h-3 w-3" />
          {knowledgeBaseName}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleDebug}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            isDebugOpen ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          <Terminal className="h-3.5 w-3.5" />
          调试工作区
        </button>
        <button className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
