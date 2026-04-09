'use client'

import clsx from 'clsx'

export function Metric({ label, value, truncate = false, className }: { label: string; value: string; truncate?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-0.5 text-[10px] text-slate-400">{label}</div>
      <div className={clsx('text-slate-700', truncate && 'truncate')} title={truncate ? value : undefined}>
        {value}
      </div>
    </div>
  )
}

export function MetricCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={clsx('rounded-lg border border-slate-200 bg-white p-3 shadow-sm', className)}>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}
