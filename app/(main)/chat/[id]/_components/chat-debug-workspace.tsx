'use client'

import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, Database, Search, Terminal, TextQuote, Zap } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import type { ChatDebugState, ChatMessageViewModel, ChunkPreviewResponse, ConversationItem } from '@/lib/types'

import {
  buildTraceSummaryRows,
  formatDuration,
  formatScore,
  getDebugEvidenceTitle,
  getGraphDecisionLabel,
  getGraphNodeDescription,
  getGraphNodeLabel,
  getGraphStatusLabel,
  getTraceChunkHint,
  getTraceSummaryToneClass,
  type DebugEvidenceMode,
  type PreviewableChunk,
} from '../_lib/chat-session-view'
import type { ChatChunkPreviewOptions } from '../_hooks/use-chat-session-controller'
import { AssistantMarkdown } from './assistant-markdown'
import { Metric, MetricCard } from './metric'

export function ChatDebugWorkspace({
  conversation,
  debugState,
  selectedTraceNode,
  setSelectedTraceNode,
  selectedTraceItem,
  evidenceMode,
  selectedPreviewSource,
  citationPreview,
  previewSegments,
  isContextExpanded,
  setIsContextExpanded,
  isPreviewLoading,
  previewError,
  latestAssistantMessage,
  citedRetrievedChunks,
  topRetrievedChunk,
  handleOpenChunkPreview,
  isGuardChunksExpanded,
  setIsGuardChunksExpanded,
}: {
  conversation: ConversationItem | null
  debugState: ChatDebugState | null
  selectedTraceNode: string | null
  setSelectedTraceNode: Dispatch<SetStateAction<string | null>>
  selectedTraceItem: ChatDebugState['graphTrace'][number] | null
  evidenceMode: DebugEvidenceMode
  selectedPreviewSource: PreviewableChunk | null
  citationPreview: ChunkPreviewResponse | null
  previewSegments: { before: string; highlight: string; after: string } | null
  isContextExpanded: boolean
  setIsContextExpanded: Dispatch<SetStateAction<boolean>>
  isPreviewLoading: boolean
  previewError: string
  latestAssistantMessage: ChatMessageViewModel | null
  citedRetrievedChunks: ChatDebugState['retrievedChunks']
  topRetrievedChunk: ChatDebugState['retrievedChunks'][number] | null
  handleOpenChunkPreview: (source: PreviewableChunk, options?: ChatChunkPreviewOptions) => Promise<void>
  isGuardChunksExpanded: boolean
  setIsGuardChunksExpanded: Dispatch<SetStateAction<boolean>>
}) {
  if (!debugState) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-lg rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center shadow-sm">
          <div className="text-base font-semibold text-slate-900">还没有可展示的调试数据</div>
          <div className="mt-3 text-sm leading-7 text-slate-500">发送一条新问题后，这里会展示本次问答的阈值判断、执行流程、检索证据和最终引用。</div>
        </div>
      </div>
    )
  }

  const comparisonGap = debugState.top1Score !== null && debugState.threshold !== null ? (debugState.top1Score - debugState.threshold).toFixed(3) : '--'

  const renderContextCard = () => {
    if (!debugState.finalContextPreview) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          当前节点没有额外的最终上下文可展示，通常表示本次请求未进入模型生成阶段。
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">发送给模型的最终上下文</div>
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-600 whitespace-pre-wrap break-words">
          {isContextExpanded || debugState.finalContextPreview.length <= 360 ? debugState.finalContextPreview : `${debugState.finalContextPreview.slice(0, 360)}...`}
        </div>
        {debugState.finalContextPreview.length > 360 ? (
          <button onClick={() => setIsContextExpanded((current) => !current)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
            {isContextExpanded ? (
              <>
                收起上下文 <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                展开上下文 <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        ) : null}
      </div>
    )
  }

  const renderSystemEvidence = () => {
    if (!selectedTraceItem) {
      return null
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">处理结果</div>
          <div className="mt-3 text-base font-semibold text-slate-900">{getGraphNodeLabel(selectedTraceItem.node)}</div>
          <div className="mt-2 text-sm leading-7 text-slate-600">{getGraphNodeDescription(selectedTraceItem)}</div>
          {buildTraceSummaryRows(selectedTraceItem).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {buildTraceSummaryRows(selectedTraceItem).map((row) => (
                <span key={`${selectedTraceItem.node}-${row.label}`} className={clsx('rounded-full border px-3 py-1 text-xs font-medium', getTraceSummaryToneClass(row.tone))}>
                  {row.label}: {row.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {selectedTraceItem.node === 'finalize_response' ? (
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="会话标题" value={conversation?.title ?? '当前会话'} />
            <MetricCard label="知识库" value={debugState.knowledgeBaseName} />
            <MetricCard label="执行耗时" value={formatDuration(selectedTraceItem.durationMs)} />
          </div>
        ) : null}
      </div>
    )
  }

  const renderEvidenceChunkCard = (
    item: ChatDebugState['retrievedChunks'][number],
    index: number,
    options?: {
      showCitationBadge?: boolean
      showTopBadge?: boolean
      focusNode?: string | null
      muted?: boolean
      highlighted?: boolean
    },
  ) => {
    const previewTarget: PreviewableChunk = {
      chunk_id: item.chunkId,
      document_id: item.documentId,
      filename: item.filename,
      chunk_index: item.chunkIndex,
      start_offset: item.startOffset,
      end_offset: item.endOffset,
      snippet: item.snippet,
    }
    const isCurrentPreview =
      selectedPreviewSource?.document_id === item.documentId &&
      selectedPreviewSource?.chunk_id === item.chunkId &&
      selectedPreviewSource?.chunk_index === item.chunkIndex

    return (
      <div
        key={`${item.chunkId}-${index}`}
        className={clsx(
          'rounded-2xl border bg-white p-4 shadow-sm transition-all',
          options?.highlighted ? 'border-blue-300 bg-blue-50/40 shadow-blue-100' : 'border-slate-200',
          options?.muted && 'opacity-60',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">{item.filename}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <span>chunk {item.chunkIndex}</span>
              <span>/</span>
              <span>id {item.chunkId}</span>
              {options?.showCitationBadge && item.whetherCited ? <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">已引用</span> : null}
              {options?.showTopBadge ? <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">最高分</span> : null}
            </div>
          </div>
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">{item.score.toFixed(3)}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{item.snippet}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="text-[11px] text-slate-400">{item.startOffset !== null && item.endOffset !== null ? `offset ${item.startOffset} - ${item.endOffset}` : '未提供定位信息'}</div>
          <button
            onClick={() =>
              void handleOpenChunkPreview(previewTarget, {
                preserveDebugWorkspace: true,
                focusNode: options?.focusNode ?? selectedTraceNode,
              })
            }
            className={clsx('rounded-md px-2 py-1 text-xs font-medium transition-colors', isCurrentPreview ? 'bg-blue-50 text-blue-700' : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700')}
          >
            查看原文
          </button>
        </div>
      </div>
    )
  }

  const renderChunkPreviewCard = () => {
    if (!selectedPreviewSource && !isPreviewLoading && !previewError && !citationPreview) {
      return null
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">原文预览</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{selectedPreviewSource?.filename ?? citationPreview?.filename ?? '片段预览'}</div>
          </div>
          {selectedPreviewSource ? (
            <div className="flex gap-2 text-xs text-slate-500">
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">chunk {selectedPreviewSource.chunk_index}</span>
              {selectedPreviewSource.chunk_id ? <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">ID {selectedPreviewSource.chunk_id}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          {isPreviewLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">正在加载原文预览...</div>
          ) : previewError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{previewError}</div>
          ) : citationPreview ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
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
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">选择片段后，这里会展示对应 chunk 的原文预览。</div>
          )}
        </div>
      </div>
    )
  }

  const renderEvidencePanel = () => {
    if (!selectedTraceItem) {
      return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">请选择左侧一个执行步骤，这里会展示对应的判断依据和证据。</div>
    }

    if (evidenceMode === 'rewrite') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">改写结论</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MetricCard label="是否使用历史消息" value={selectedTraceItem.usedHistory ? '是' : '否'} />
              <MetricCard label="流程状态" value={getGraphStatusLabel(selectedTraceItem.status)} />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">原始问题</div>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{debugState.question}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">最终检索问题</div>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{selectedTraceItem.rewrittenQuestion ?? debugState.question}</div>
            </div>
          </div>
        </div>
      )
    }

    if (evidenceMode === 'retrieval') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm leading-7 text-blue-700">当前正在查看检索结果。下面按得分从高到低展示本次召回到的全部候选片段。</div>
          <div className="grid gap-4 xl:grid-cols-2">
            {debugState.retrievedChunks.map((item, index) =>
              renderEvidenceChunkCard(item, index, {
                showCitationBadge: true,
                showTopBadge: index === 0,
                focusNode: 'retrieve_dense_candidates',
                highlighted: true,
              }),
            )}
          </div>
          {renderContextCard()}
        </div>
      )
    }

    if (evidenceMode === 'guard') {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="最高相似度" value={formatScore(selectedTraceItem.top1Score)} className="border-emerald-200 bg-emerald-50/70" />
            <MetricCard label="拒答阈值" value={formatScore(selectedTraceItem.threshold)} className="border-amber-200 bg-amber-50/70" />
            <MetricCard label="分差" value={comparisonGap === '--' ? '--' : comparisonGap} className="border-blue-200 bg-blue-50/70" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">判定结论</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{getGraphDecisionLabel(selectedTraceItem.decision)}</div>
              </div>
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                  selectedTraceItem.decision === 'reject' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                )}
              >
                {selectedTraceItem.decision === 'reject' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {getGraphNodeDescription(selectedTraceItem)}
              </span>
            </div>
          </div>
          {topRetrievedChunk ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">最高分片段</div>
              {renderEvidenceChunkCard(topRetrievedChunk, 0, {
                showCitationBadge: true,
                showTopBadge: true,
                focusNode: 'relevance_guard',
                highlighted: true,
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">本次没有召回结果，所以系统直接触发拒答。</div>
          )}
          {debugState.retrievedChunks.length > 1 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                onClick={() => setIsGuardChunksExpanded((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50/60"
              >
                <span>{`查看其他召回片段（${debugState.retrievedChunks.length - 1}）`}</span>
                {isGuardChunksExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {isGuardChunksExpanded ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {debugState.retrievedChunks.slice(1).map((item, index) =>
                    renderEvidenceChunkCard(item, index + 1, {
                      showCitationBadge: true,
                      focusNode: 'relevance_guard',
                    }),
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    }

    if (evidenceMode === 'citations') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm leading-7 text-blue-700">当前只展示最终被答案实际引用的片段。未被引用的召回片段不会出现在这里。</div>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="最终引用数量" value={String(selectedTraceItem.citedCount ?? citedRetrievedChunks.length)} className="border-blue-200 bg-blue-50/70" />
            <MetricCard
              label="引用来源"
              value={selectedTraceItem.usedFallbackCitations ? '自动兜底引用' : '模型显式引用'}
              className={selectedTraceItem.usedFallbackCitations ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/70'}
            />
            <MetricCard label="最终判定" value={getGraphDecisionLabel(debugState.decision)} />
          </div>
          {citedRetrievedChunks.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {citedRetrievedChunks.map((item, index) =>
                renderEvidenceChunkCard(item, index, {
                  showCitationBadge: true,
                  focusNode: 'build_citations',
                  highlighted: true,
                }),
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">当前没有可展示的最终引用。</div>
          )}
        </div>
      )
    }

    if (evidenceMode === 'answer') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">最终回答预览</div>
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <AssistantMarkdown content={latestAssistantMessage?.content || '当前没有可展示的回答内容。'} isStreaming={latestAssistantMessage?.status === 'streaming'} />
            </div>
          </div>
          {citedRetrievedChunks.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">本次回答引用的片段</div>
              <div className="grid gap-4 xl:grid-cols-2">
                {citedRetrievedChunks.map((item, index) =>
                  renderEvidenceChunkCard(item, index, {
                    showCitationBadge: true,
                    focusNode: selectedTraceItem.node,
                    highlighted: true,
                  }),
                )}
              </div>
            </div>
          ) : null}
          {renderContextCard()}
        </div>
      )
    }

    return renderSystemEvidence()
  }

  return (
    <div className="flex min-h-full flex-col gap-4 xl:h-full xl:min-h-0 xl:gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">本次问题</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{debugState.question}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Database className="h-3.5 w-3.5" />
              {debugState.knowledgeBaseName}
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm">
            {debugState.decision === 'reject' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-700" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />}
            <span className={debugState.decision === 'reject' ? 'text-amber-700' : 'text-emerald-700'}>{getGraphDecisionLabel(debugState.decision)}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard label="最高相似度" value={formatScore(debugState.top1Score)} className="border-emerald-200 bg-emerald-50/70" />
          <MetricCard label="拒答阈值" value={formatScore(debugState.threshold)} className="border-amber-200 bg-amber-50/70" />
          <MetricCard label="最终引用" value={String(citedRetrievedChunks.length)} className="border-blue-200 bg-blue-50/70" />
          <MetricCard label="总耗时" value={formatDuration(debugState.totalMs)} />
          <MetricCard label="检索耗时" value={formatDuration(debugState.retrievalMs)} />
          <MetricCard label="模型生成" value={formatDuration(debugState.llmMs)} />
        </div>
      </div>

      <div className="xl:hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-1 pb-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">执行流程</div>
            <div className="mt-1 text-xs text-slate-500">小屏下改为紧凑切换，先选步骤，再看对应证据。</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">{debugState.graphTrace.length} 步</div>
        </div>
        <div className="-mx-1 mt-4 overflow-x-auto pb-2">
          <div className="flex gap-3 px-1">
            {debugState.graphTrace.map((item, index) => {
              const isSelected = selectedTraceNode === item.node
              return (
                <button
                  key={`mobile-${item.node}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedTraceNode(item.node)
                    setIsContextExpanded(false)
                  }}
                  className={clsx(
                    'min-w-[180px] max-w-[220px] flex-shrink-0 rounded-2xl border p-3 text-left transition-all',
                    isSelected ? 'border-blue-300 bg-blue-50/70 shadow-sm shadow-blue-100' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">{index + 1}</span>
                        <span className="text-xs font-semibold leading-5 text-slate-900">{getGraphNodeLabel(item.node)}</span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-600">{getGraphNodeDescription(item)}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        {selectedTraceItem ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">当前步骤</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{getGraphNodeLabel(selectedTraceItem.node)}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{getTraceChunkHint(selectedTraceItem)}</div>
          </div>
        ) : null}
      </div>

      <div className="hidden xl:grid xl:min-h-0 xl:flex-1 xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:flex xl:min-h-0 xl:flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-2 pb-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">执行流程</div>
              <div className="mt-1 text-xs text-slate-500">按步骤选择，右侧会同步展示对应证据。</div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">{debugState.graphTrace.length} 步</div>
          </div>
          <div className="mt-4 space-y-3 pr-1 pb-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2 xl:pb-4">
            {debugState.graphTrace.map((item, index) => {
              const summaryRows = buildTraceSummaryRows(item).slice(0, 2)
              const isSelected = selectedTraceNode === item.node
              return (
                <button
                  key={`${item.node}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedTraceNode(item.node)
                    setIsContextExpanded(false)
                  }}
                  className={clsx(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    isSelected ? 'border-blue-300 bg-blue-50/70 shadow-sm shadow-blue-100' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">{index + 1}</span>
                        <span className="text-sm font-semibold text-slate-900">{getGraphNodeLabel(item.node)}</span>
                      </div>
                      <div className="mt-2 text-xs leading-6 text-slate-600">{getGraphNodeDescription(item)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[10px]">
                      <span
                        className={clsx(
                          'min-w-[56px] whitespace-nowrap rounded border px-2 py-0.5 text-center font-medium leading-5',
                          item.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700',
                        )}
                      >
                        {getGraphStatusLabel(item.status)}
                      </span>
                      <span className="text-slate-400">{formatDuration(item.durationMs)}</span>
                    </div>
                  </div>
                  {summaryRows.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summaryRows.map((row) => (
                        <span key={`${item.node}-${row.label}`} className={clsx('rounded-full border px-2.5 py-1 text-[11px] font-medium', getTraceSummaryToneClass(row.tone))}>
                          {row.label}: {row.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5 xl:flex xl:min-h-0 xl:flex-col">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Search className="h-4 w-4 text-blue-600" />
              {getDebugEvidenceTitle(evidenceMode)}
            </div>
            {selectedTraceItem ? <div className="text-sm leading-6 text-slate-500">{getTraceChunkHint(selectedTraceItem)}</div> : null}
          </div>
          <div className="mt-5 space-y-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2 xl:pb-4">
            {renderEvidencePanel()}
            {renderChunkPreviewCard()}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5 xl:hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Search className="h-4 w-4 text-blue-600" />
            {getDebugEvidenceTitle(evidenceMode)}
          </div>
          {selectedTraceItem ? <div className="text-sm leading-6 text-slate-500">{getTraceChunkHint(selectedTraceItem)}</div> : null}
        </div>
        <div className="mt-5 space-y-5">
          {renderEvidencePanel()}
          {renderChunkPreviewCard()}
        </div>
      </div>
    </div>
  )
}
