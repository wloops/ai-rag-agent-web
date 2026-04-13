'use client'

import { FileText, Terminal, X } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ChunkPreviewResponse } from '@/lib/types'

import type { RightPanelType, PreviewableChunk } from '../_lib/chat-session-view'

export function ChatSideOverlay({
  activeRightPanel,
  title,
  subtitle,
  selectedPreviewSource,
  citationPreview,
  previewSegments,
  isPreviewLoading,
  previewError,
  onClose,
  debugWorkspace,
}: {
  activeRightPanel: RightPanelType | null
  title: string
  subtitle: string
  selectedPreviewSource: PreviewableChunk | null
  citationPreview: ChunkPreviewResponse | null
  previewSegments: { before: string; highlight: string; after: string } | null
  isPreviewLoading: boolean
  previewError: string
  onClose: () => void
  debugWorkspace: ReactNode
}) {
  if (!activeRightPanel) {
    return null
  }

  const isDebugOpen = activeRightPanel === 'debug'

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/30 p-2 backdrop-blur-sm sm:p-3 lg:p-4">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-2xl shadow-slate-950/10">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-3">
            {isDebugOpen ? <Terminal className="h-4 w-4 text-blue-600" /> : <FileText className="h-4 w-4 text-blue-600" />}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <div className="truncate text-xs text-slate-500">{subtitle}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={isDebugOpen ? 'min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6' : 'min-h-0 flex-1 overflow-hidden p-4 sm:p-6'}>
          {isDebugOpen ? (
            <div className="mx-auto w-full max-w-7xl">{debugWorkspace}</div>
          ) : (
            <div className="mx-auto h-full max-w-5xl overflow-y-auto">{renderPreviewPanel(selectedPreviewSource, citationPreview, previewSegments, isPreviewLoading, previewError)}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function renderPreviewPanel(
  selectedPreviewSource: PreviewableChunk | null,
  citationPreview: ChunkPreviewResponse | null,
  previewSegments: { before: string; highlight: string; after: string } | null,
  isPreviewLoading: boolean,
  previewError: string,
) {
  if (isPreviewLoading) return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">正在加载原文预览...</div>
  if (previewError) return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{previewError}</div>
  if (!citationPreview) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">选择引用或召回片段后，这里会展示对应 chunk 的原文预览。</div>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">文档信息</div>
        <div className="mt-3 text-sm font-medium text-slate-900">{citationPreview.filename}</div>
        <div className="mt-2 flex gap-2 text-xs text-slate-500">
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">chunk {selectedPreviewSource?.chunk_index ?? citationPreview.chunk_index}</span>
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">ID {selectedPreviewSource?.chunk_id ?? citationPreview.chunk_id}</span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">原文预览</div>
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-7 text-slate-700">
          {citationPreview.preview_text ? (
            <div className="whitespace-pre-wrap break-words">
              {previewSegments?.before}
              {previewSegments?.highlight ? <mark className="rounded bg-blue-100 px-1 py-0.5 text-slate-900 ring-1 ring-blue-200">{previewSegments.highlight}</mark> : null}
              {previewSegments?.after}
            </div>
          ) : (
            '当前片段暂无可展示的原文内容。'
          )}
        </div>
      </div>
    </div>
  )
}
