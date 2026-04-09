import type {
  ChatCitationItem,
  ChatDebugState,
  ChatMessageViewModel,
  ChunkPreviewResponse,
  ConversationItem,
} from '@/lib/types'
import type { ManagedChatStreamSnapshot } from '@/lib/chat-stream'

export const DEFAULT_TOP_K = 3
export const AUTO_SCROLL_THRESHOLD = 96
export const STREAM_RECOVERY_MAX_ATTEMPTS = 4
export const STREAM_RECOVERY_INTERVAL_MS = 450
export const STREAM_STALL_TIMEOUT_MS = 8000
export const STREAM_STALL_POLL_INTERVAL_MS = 3000

export type RightPanelType = 'debug' | 'citation'
export type PreviewableChunk = Pick<
  ChatCitationItem,
  'chunk_id' | 'document_id' | 'filename' | 'chunk_index' | 'start_offset' | 'end_offset'
> & { snippet: string | null }
export type GraphTraceItem = ChatDebugState['graphTrace'][number]
export type TraceChunkFocusMode = 'none' | 'all' | 'cited' | 'top1'
export type DebugEvidenceMode = 'rewrite' | 'retrieval' | 'guard' | 'answer' | 'citations' | 'system'

const GRAPH_NODE_LABELS: Record<string, string> = {
  validate_request: '校验请求',
  resolve_conversation: '解析会话',
  rewrite_question: '问题改写',
  retrieve_dense_candidates: '向量召回',
  retrieve_bm25_candidates: 'BM25 召回',
  fuse_candidates: '候选融合',
  rerank_candidates: 'Rerank 重排',
  relevance_guard: '相关度守卫',
  generate_answer: '生成回答',
  stream_answer: '流式生成回答',
  build_citations: '构建引用',
  finalize_response: '组装并保存结果',
}

export function formatScore(value: number | null) {
  return value === null || Number.isNaN(value) ? '--' : value.toFixed(3)
}

export function formatDuration(value: number | null) {
  return value === null || Number.isNaN(value) ? '--' : `${value} ms`
}

export function getGraphNodeLabel(node: string) {
  return GRAPH_NODE_LABELS[node] ?? node
}

export function getGraphStatusLabel(status: GraphTraceItem['status']) {
  return status === 'completed' ? '已完成' : '已跳过'
}

export function getGraphDecisionLabel(decision: GraphTraceItem['decision'] | ChatDebugState['decision']) {
  if (decision === 'answer') return '允许回答'
  if (decision === 'reject') return '触发拒答'
  return '--'
}

export function getRejectReasonLabel(reason: GraphTraceItem['rejectReason'] | ChatDebugState['rejectReason']) {
  if (reason === 'no_candidate') return '无候选结果'
  if (reason === 'low_confidence') return '候选置信度不足'
  return '--'
}

export function getGraphNodeDescription(item: GraphTraceItem) {
  if (item.node === 'validate_request') {
    return '已校验问题内容，并确认当前知识库可访问。'
  }
  if (item.node === 'resolve_conversation') {
    return '已定位当前会话，并加载最近几轮消息作为上下文。'
  }
  if (item.node === 'rewrite_question') {
    return item.usedHistory ? '结合最近对话，将追问改写为独立问题。' : '没有可用历史，本次直接使用原问题。'
  }
  if (item.node === 'retrieve_dense_candidates') {
    if (item.denseCandidatesCount === null && item.retrievalCount === null) return '尚未得到向量召回结果。'
    if ((item.denseCandidatesCount ?? item.retrievalCount ?? 0) === 0) return '向量召回没有返回可用候选。'
    return `向量召回得到 ${item.denseCandidatesCount ?? item.retrievalCount} 个候选，最高分 ${formatScore(item.top1Score)}。`
  }
  if (item.node === 'retrieve_bm25_candidates') {
    if (item.bm25CandidatesCount === null) return '尚未生成 BM25 召回结果。'
    if (item.bm25CandidatesCount === 0) return 'BM25 召回没有命中关键词候选。'
    return `BM25 召回得到 ${item.bm25CandidatesCount} 个候选，用于补足术语和编号类命中。`
  }
  if (item.node === 'fuse_candidates') {
    if (item.fusionCandidatesCount === null) return '尚未生成融合结果。'
    if (item.fusionCandidatesCount === 0) return '融合后没有保留任何候选。'
    return `已用 RRF 融合双路召回，保留 ${item.fusionCandidatesCount} 个候选。`
  }
  if (item.node === 'rerank_candidates') {
    if (item.retrievalCount === null) return '尚未执行重排。'
    return item.rerankApplied ? `已对 ${item.retrievalCount} 个候选完成 rerank 重排。` : 'rerank 未启用或不可用，已回退到融合结果排序。'
  }
  if (item.node === 'relevance_guard') {
    if (item.decision === 'answer') {
      return `守卫分数 ${formatScore(item.top1Score)} 高于阈值 ${formatScore(item.threshold)}，允许继续回答。`
    }
    if (item.top1Score === null) {
      return '没有可用候选结果，直接触发拒答。'
    }
    return `守卫分数 ${formatScore(item.top1Score)} 低于阈值 ${formatScore(item.threshold)}，触发拒答。`
  }
  if (item.node === 'generate_answer' || item.node === 'stream_answer') {
    return '基于筛选后的候选片段生成最终回答。'
  }
  if (item.node === 'build_citations') {
    if (item.citedCount === null) return '正在整理回答引用。'
    if (item.citedCount === 0) return '本次回答没有生成可展示的引用。'
    return `已整理 ${item.citedCount} 条引用，并标记最终使用的片段。`
  }
  if (item.node === 'finalize_response') {
    return '已保存助手消息、引用信息和调试轨迹。'
  }
  return item.detail
}

export function getDebugEvidenceMode(node: string | null): DebugEvidenceMode {
  if (node === 'rewrite_question') return 'rewrite'
  if (node === 'retrieve_dense_candidates' || node === 'retrieve_bm25_candidates' || node === 'fuse_candidates' || node === 'rerank_candidates') return 'retrieval'
  if (node === 'relevance_guard') return 'guard'
  if (node === 'generate_answer' || node === 'stream_answer') return 'answer'
  if (node === 'build_citations') return 'citations'
  return 'system'
}

export function getDebugEvidenceTitle(mode: DebugEvidenceMode) {
  if (mode === 'rewrite') return '问题改写依据'
  if (mode === 'retrieval') return '检索证据'
  if (mode === 'guard') return '阈值判定依据'
  if (mode === 'answer') return '回答生成结果'
  if (mode === 'citations') return '最终引用证据'
  return '系统处理结果'
}

export function resolvePreferredTraceNode(graphTrace: GraphTraceItem[], preferredNode?: string | null) {
  const preferredOrder = [
    preferredNode,
    'rerank_candidates',
    'relevance_guard',
    'fuse_candidates',
    'retrieve_bm25_candidates',
    'retrieve_dense_candidates',
    'build_citations',
    'stream_answer',
    'generate_answer',
    'rewrite_question',
  ].filter(Boolean)

  for (const node of preferredOrder) {
    if (graphTrace.some((item) => item.node === node)) {
      return node ?? null
    }
  }

  return graphTrace[0]?.node ?? null
}

export function buildTraceSummaryRows(item: GraphTraceItem) {
  const rows: Array<{ label: string; value: string; tone?: 'slate' | 'blue' | 'emerald' | 'amber' }> = []

  if (item.node === 'rewrite_question') {
    rows.push({
      label: '历史消息',
      value: item.usedHistory ? '使用最近消息改写' : '未使用历史，直接复用原问题',
      tone: item.usedHistory ? 'blue' : 'slate',
    })
    if (item.rewrittenQuestion) {
      rows.push({
        label: '独立问题',
        value: item.rewrittenQuestion,
      })
    }
  }

  if (item.node === 'retrieve_dense_candidates') {
    if (item.denseCandidatesCount !== null) {
      rows.push({ label: '向量候选', value: String(item.denseCandidatesCount), tone: 'blue' })
    }
    if (item.top1Score !== null) {
      rows.push({ label: '最高分', value: formatScore(item.top1Score), tone: 'emerald' })
    }
  }

  if (item.node === 'retrieve_bm25_candidates' && item.bm25CandidatesCount !== null) {
    rows.push({ label: 'BM25 候选', value: String(item.bm25CandidatesCount), tone: 'blue' })
  }

  if (item.node === 'fuse_candidates' && item.fusionCandidatesCount !== null) {
    rows.push({ label: '融合候选', value: String(item.fusionCandidatesCount), tone: 'blue' })
  }

  if (item.node === 'rerank_candidates') {
    if (item.retrievalCount !== null) {
      rows.push({ label: '重排输入', value: String(item.retrievalCount), tone: 'blue' })
    }
    if (item.rerankApplied !== null) {
      rows.push({
        label: 'Rerank',
        value: item.rerankApplied ? '已执行' : '已降级',
        tone: item.rerankApplied ? 'emerald' : 'amber',
      })
    }
  }

  if (item.node === 'relevance_guard') {
    if (item.top1Score !== null) {
      rows.push({ label: '守卫分数', value: formatScore(item.top1Score), tone: 'emerald' })
    }
    if (item.threshold !== null) {
      rows.push({ label: '拒答阈值', value: formatScore(item.threshold), tone: 'amber' })
    }
    if (item.decision) {
      rows.push({
        label: '判定',
        value: getGraphDecisionLabel(item.decision),
        tone: item.decision === 'answer' ? 'emerald' : 'amber',
      })
    }
    if (item.rejectReason) {
      rows.push({
        label: '拒答原因',
        value: getRejectReasonLabel(item.rejectReason),
        tone: 'amber',
      })
    }
  }

  if (item.node === 'build_citations') {
    if (item.citedCount !== null) {
      rows.push({ label: '引用数量', value: String(item.citedCount), tone: 'blue' })
    }
    if (item.usedFallbackCitations !== null) {
      rows.push({
        label: '引用来源',
        value: item.usedFallbackCitations ? '自动兜底引用' : '模型显式引用',
        tone: item.usedFallbackCitations ? 'amber' : 'emerald',
      })
    }
  }

  return rows
}

export function getTraceChunkFocusMode(node: string | null): TraceChunkFocusMode {
  if (node === 'retrieve_dense_candidates' || node === 'retrieve_bm25_candidates' || node === 'fuse_candidates' || node === 'rerank_candidates') return 'all'
  if (node === 'build_citations') return 'cited'
  if (node === 'relevance_guard') return 'top1'
  return 'none'
}

export function getTraceChunkHint(item: GraphTraceItem | null) {
  if (!item) return null
  if (item.node === 'retrieve_dense_candidates') return '当前查看向量召回结果，下面会高亮参与排序的候选片段。'
  if (item.node === 'retrieve_bm25_candidates') return '当前查看 BM25 召回结果，下面会高亮命中关键词的候选片段。'
  if (item.node === 'fuse_candidates') return '当前查看融合结果，下面展示双路召回合并后的候选片段。'
  if (item.node === 'rerank_candidates') return '当前查看 rerank 结果，下面展示进入最终重排的候选片段。'
  if (item.node === 'build_citations') return '当前查看最终引用，下面会高亮被答案实际引用的片段。'
  if (item.node === 'relevance_guard') return '当前查看阈值判断，下面会突出守卫分数最高的候选片段。'
  if (item.node === 'rewrite_question') return '当前查看问题改写结果。这个节点主要解释追问是否被改写，不直接绑定具体片段。'
  return '当前节点主要展示执行说明，没有额外的片段联动规则。'
}

export function getTraceSummaryToneClass(tone: 'slate' | 'blue' | 'emerald' | 'amber' = 'slate') {
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export function getDistanceFromBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight
}

export function getPreviewSegments(preview: ChunkPreviewResponse | null) {
  if (!preview) return null
  const text = preview.preview_text ?? ''
  const start = Math.max(0, Math.min(preview.highlight_start_offset, text.length))
  const end = Math.max(start, Math.min(preview.highlight_end_offset, text.length))
  return { before: text.slice(0, start), highlight: text.slice(start, end), after: text.slice(end) }
}

export function buildFallbackConversation(conversationId: number, snapshot: ManagedChatStreamSnapshot | null): ConversationItem | null {
  if (!snapshot || snapshot.conversationId !== conversationId) {
    return null
  }

  return {
    id: conversationId,
    knowledge_base_id: snapshot.knowledgeBaseId,
    title: snapshot.question.slice(0, 30) || '新会话',
    created_at: snapshot.updatedAt,
    updated_at: snapshot.updatedAt,
  }
}

export function buildStreamingAssistantMessage(snapshot: ManagedChatStreamSnapshot): ChatMessageViewModel {
  return {
    id: `stream-assistant-${snapshot.conversationId}`,
    role: 'assistant',
    content: snapshot.answer,
    citations: snapshot.finalResponse?.citations ?? [],
    status: snapshot.status,
  }
}
