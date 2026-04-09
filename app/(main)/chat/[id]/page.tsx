'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Clock3, Database, FileText, Layers, MoreHorizontal, Search, Send, Terminal, TextQuote, User, X, Zap } from 'lucide-react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { useAuth } from '@/components/auth-provider'
import { ApiError, chatApi, documentsApi, kbApi } from '@/lib/api'
import { buildChatDebugState, findConversation, mapMessagesToViewModel, notifyChatSessionsChanged, readChatDebugState, saveChatDebugState } from '@/lib/chat'
import { clearManagedChatStream, getManagedChatStreamSnapshot, startManagedChatStream, subscribeManagedChatStream, type ManagedChatStreamSnapshot } from '@/lib/chat-stream'
import { formatDateTime } from '@/lib/format'
import type { ChatCitationItem, ChatDebugState, ChatMessageViewModel, ChunkPreviewResponse, ConversationItem, KnowledgeBaseItem } from '@/lib/types'

const DEFAULT_TOP_K = 3
const AUTO_SCROLL_THRESHOLD = 96
const STREAM_RECOVERY_MAX_ATTEMPTS = 4
const STREAM_RECOVERY_INTERVAL_MS = 450

type RightPanelType = 'debug' | 'citation'
type PreviewableChunk = Pick<ChatCitationItem, 'chunk_id' | 'document_id' | 'filename' | 'chunk_index' | 'start_offset' | 'end_offset'> & { snippet: string | null }
type GraphTraceItem = ChatDebugState['graphTrace'][number]
type TraceChunkFocusMode = 'none' | 'all' | 'cited' | 'top1'
type DebugEvidenceMode = 'rewrite' | 'retrieval' | 'guard' | 'answer' | 'citations' | 'system'

const formatScore = (value: number | null) => (value === null || Number.isNaN(value) ? '--' : value.toFixed(3))
const formatDuration = (value: number | null) => (value === null || Number.isNaN(value) ? '--' : `${value} ms`)
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

function getGraphNodeLabel(node: string) {
  return GRAPH_NODE_LABELS[node] ?? node
}

function getGraphStatusLabel(status: GraphTraceItem['status']) {
  return status === 'completed' ? '已完成' : '已跳过'
}

function getGraphDecisionLabel(decision: GraphTraceItem['decision'] | ChatDebugState['decision']) {
  if (decision === 'answer') return '允许回答'
  if (decision === 'reject') return '触发拒答'
  return '--'
}

function getRejectReasonLabel(reason: GraphTraceItem['rejectReason'] | ChatDebugState['rejectReason']) {
  if (reason === 'no_candidate') return '无候选结果'
  if (reason === 'low_confidence') return '候选置信度不足'
  return '--'
}

function getGraphNodeDescription(item: GraphTraceItem) {
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

function getDebugEvidenceMode(node: string | null): DebugEvidenceMode {
  if (node === 'rewrite_question') return 'rewrite'
  if (node === 'retrieve_dense_candidates' || node === 'retrieve_bm25_candidates' || node === 'fuse_candidates' || node === 'rerank_candidates') return 'retrieval'
  if (node === 'relevance_guard') return 'guard'
  if (node === 'generate_answer' || node === 'stream_answer') return 'answer'
  if (node === 'build_citations') return 'citations'
  return 'system'
}

function getDebugEvidenceTitle(mode: DebugEvidenceMode) {
  if (mode === 'rewrite') return '问题改写依据'
  if (mode === 'retrieval') return '检索证据'
  if (mode === 'guard') return '阈值判定依据'
  if (mode === 'answer') return '回答生成结果'
  if (mode === 'citations') return '最终引用证据'
  return '系统处理结果'
}

function resolvePreferredTraceNode(graphTrace: GraphTraceItem[], preferredNode?: string | null) {
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
function buildTraceSummaryRows(item: GraphTraceItem) {
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

function getTraceChunkFocusMode(node: string | null): TraceChunkFocusMode {
  // 固定节点与证据区的联动规则，避免 UI 调整时检索解释漂移。
  if (node === 'retrieve_dense_candidates' || node === 'retrieve_bm25_candidates' || node === 'fuse_candidates' || node === 'rerank_candidates') return 'all'
  if (node === 'build_citations') return 'cited'
  if (node === 'relevance_guard') return 'top1'
  return 'none'
}

function getTraceChunkHint(item: GraphTraceItem | null) {
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
function getTraceSummaryToneClass(tone: 'slate' | 'blue' | 'emerald' | 'amber' = 'slate') {
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function getDistanceFromBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight
}

function getPreviewSegments(preview: ChunkPreviewResponse | null) {
  if (!preview) return null
  const text = preview.preview_text ?? ''
  const start = Math.max(0, Math.min(preview.highlight_start_offset, text.length))
  const end = Math.max(start, Math.min(preview.highlight_end_offset, text.length))
  return { before: text.slice(0, start), highlight: text.slice(start, end), after: text.slice(end) }
}

function buildFallbackConversation(conversationId: number, snapshot: ManagedChatStreamSnapshot | null): ConversationItem | null {
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

function buildStreamingAssistantMessage(snapshot: ManagedChatStreamSnapshot): ChatMessageViewModel {
  return {
    id: `stream-assistant-${snapshot.conversationId}`,
    role: 'assistant',
    content: snapshot.answer,
    citations: snapshot.finalResponse?.citations ?? [],
    status: snapshot.status,
  }
}

function AssistantMarkdown({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold tracking-tight text-slate-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold tracking-tight text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-900">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-900">{children}</h4>,
          p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1 marker:text-slate-400">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">{children}</blockquote>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 hover:text-blue-700">
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className)
            if (isBlock) {
              return <code className={clsx('block overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-[13px] leading-6 text-slate-100', className)}>{children}</code>
            }

            return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">{children}</code>
          },
          pre: ({ children }) => <pre className="overflow-x-auto rounded-xl bg-slate-950">{children}</pre>,
          hr: () => <hr className="border-slate-200" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-600">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming ? <span className="inline-block h-4 w-2 animate-pulse rounded-sm bg-blue-500/70 align-middle" /> : null}
    </div>
  )
}

export default function ChatSessionPage() {
  const params = useParams()
  const conversationId = Number(params.id)
  const { token } = useAuth()
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const previewRequestIdRef = useRef(0)
  const handledStreamTerminalRef = useRef<string | null>(null)
  const shouldStickToBottomRef = useRef(true)

  const [conversation, setConversation] = useState<ConversationItem | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([])
  const [messages, setMessages] = useState<ChatMessageViewModel[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelType | null>(null)
  const [debugState, setDebugState] = useState<ChatDebugState | null>(null)
  const [selectedTraceNode, setSelectedTraceNode] = useState<string | null>(null)
  const [selectedPreviewSource, setSelectedPreviewSource] = useState<PreviewableChunk | null>(null)
  const [citationPreview, setCitationPreview] = useState<ChunkPreviewResponse | null>(null)
  const [expandedCitationGroups, setExpandedCitationGroups] = useState<Record<string, boolean>>({})
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [activeStream, setActiveStream] = useState<ManagedChatStreamSnapshot | null>(null)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [showPendingAssistant, setShowPendingAssistant] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [isGuardChunksExpanded, setIsGuardChunksExpanded] = useState(false)

  useEffect(() => {
    const currentToken = token ?? ''
    if (!currentToken || Number.isNaN(conversationId)) return
    let isMounted = true

    async function loadData() {
      setIsLoading(true)
      setError('')
      try {
        const [conversationItems, knowledgeBaseItems, messageItems] = await Promise.all([
          chatApi.listConversations(currentToken),
          kbApi.list(currentToken),
          chatApi.listMessages(currentToken, conversationId),
        ])
        if (!isMounted) return

        const fallbackConversation = buildFallbackConversation(conversationId, getManagedChatStreamSnapshot(conversationId))
        const currentConversation = findConversation(conversationItems, conversationId) ?? fallbackConversation
        if (!currentConversation) throw new Error('会话不存在或已删除。')

        setConversation(currentConversation)
        setKnowledgeBases(knowledgeBaseItems)
        setMessages(mapMessagesToViewModel(messageItems))
        setDebugState(readChatDebugState(conversationId))
      } catch (loadError) {
        if (!isMounted) return
        setError(loadError instanceof ApiError ? loadError.message : '会话加载失败。')
        setConversation(null)
        setMessages([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      isMounted = false
    }
  }, [conversationId, token])

  useEffect(() => {
    if (Number.isNaN(conversationId)) {
      return
    }

    handledStreamTerminalRef.current = null
    setActiveStream(getManagedChatStreamSnapshot(conversationId))
    const unsubscribe = subscribeManagedChatStream(conversationId, (snapshot) => {
      setActiveStream({ ...snapshot })
    })

    return unsubscribe
  }, [conversationId])

  useEffect(() => {
    previewRequestIdRef.current += 1
    setActiveRightPanel(null)
    setSelectedTraceNode(null)
    setSelectedPreviewSource(null)
    setCitationPreview(null)
    setExpandedCitationGroups({})
    setIsContextExpanded(false)
    setIsGuardChunksExpanded(false)
    setPreviewError('')
    setIsPreviewLoading(false)
    setPendingQuestion(null)
    setShowPendingAssistant(false)
  }, [conversationId])

  useEffect(() => {
    const element = messageListRef.current
    if (!element) {
      return
    }

    const syncScrollState = () => {
      const isNearBottom = getDistanceFromBottom(element) <= AUTO_SCROLL_THRESHOLD
      shouldStickToBottomRef.current = isNearBottom
      setShowScrollToBottom(!isNearBottom)
    }

    syncScrollState()
    element.addEventListener('scroll', syncScrollState, { passive: true })
    return () => {
      element.removeEventListener('scroll', syncScrollState)
    }
  }, [conversationId])

  useEffect(() => {
    shouldStickToBottomRef.current = true
    setShowScrollToBottom(false)

    const frame = window.requestAnimationFrame(() => {
      scrollMessagesToBottom('auto')
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [conversationId])

  useEffect(() => {
    const currentToken = token ?? ''
    if (!currentToken || !activeStream || activeStream.conversationId !== conversationId) {
      return
    }

    if (activeStream.status === 'error') {
      setIsSending(false)
      setShowPendingAssistant(true)
      if (activeStream.error) {
        setError(activeStream.error)
      }
      return
    }

    if (activeStream.status !== 'complete' || !activeStream.finalResponse) {
      return
    }

    const terminalKey = `${activeStream.conversationId}:${activeStream.updatedAt}`
    if (handledStreamTerminalRef.current === terminalKey) {
      return
    }
    handledStreamTerminalRef.current = terminalKey

    saveChatDebugState(
      buildChatDebugState({
        response: activeStream.finalResponse,
        question: activeStream.question,
        knowledgeBase: knowledgeBases.find((item) => item.id === activeStream.knowledgeBaseId) ?? null,
        topK: DEFAULT_TOP_K,
      }),
    )
    setDebugState(readChatDebugState(conversationId))
    setIsContextExpanded(false)
    setError('')

    let cancelled = false
    void (async () => {
      try {
        const messageItems = await chatApi.listMessages(currentToken, conversationId)
        if (cancelled) {
          return
        }
        setMessages(mapMessagesToViewModel(messageItems))
        setPendingQuestion(null)
        setShowPendingAssistant(false)
        setIsSending(false)
        notifyChatSessionsChanged()
        clearManagedChatStream(conversationId)
        setActiveStream(null)
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setError(loadError instanceof ApiError ? loadError.message : '会话消息刷新失败，请稍后重试。')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeStream, conversationId, knowledgeBases, token])

  const knowledgeBase = useMemo(() => conversation && knowledgeBases.find((item) => item.id === conversation.knowledge_base_id), [conversation, knowledgeBases])
  const isDebugOpen = activeRightPanel === 'debug'
  const isCitationPreviewOpen = activeRightPanel === 'citation'
  const previewSegments = useMemo(() => getPreviewSegments(citationPreview), [citationPreview])
  const selectedTraceItem = useMemo(() => debugState?.graphTrace.find((item) => item.node === selectedTraceNode) ?? null, [debugState, selectedTraceNode])
  const traceChunkFocusMode = useMemo(() => getTraceChunkFocusMode(selectedTraceNode), [selectedTraceNode])
  const evidenceMode = useMemo<DebugEvidenceMode>(() => getDebugEvidenceMode(selectedTraceNode), [selectedTraceNode])
  const displayMessages = useMemo(() => {
    const items = [...messages]

    if (pendingQuestion) {
      items.push({
        id: `pending-user-${conversationId}`,
        role: 'user',
        content: pendingQuestion,
        citations: [],
        status: 'streaming',
      })
    }

    if (activeStream && activeStream.conversationId === conversationId) {
      items.push(buildStreamingAssistantMessage(activeStream))
    } else if (showPendingAssistant) {
      items.push({
        id: `pending-assistant-${conversationId}`,
        role: 'assistant',
        content: '',
        citations: [],
        status: 'streaming',
      })
    }

    return items
  }, [activeStream, conversationId, messages, pendingQuestion, showPendingAssistant])
  const displayMessageCount = displayMessages.length
  const streamingAnswerLength = activeStream?.answer.length ?? 0
  const latestAssistantMessage = useMemo(() => [...displayMessages].reverse().find((item) => item.role === 'assistant') ?? null, [displayMessages])
  const citedRetrievedChunks = useMemo(() => debugState?.retrievedChunks.filter((item) => item.whetherCited) ?? [], [debugState])
  const topRetrievedChunk = debugState?.retrievedChunks[0] ?? null

  useEffect(() => {
    if (!selectedTraceNode || !debugState) {
      return
    }
    if (!debugState.graphTrace.some((item) => item.node === selectedTraceNode)) {
      setSelectedTraceNode(resolvePreferredTraceNode(debugState.graphTrace))
    }
  }, [debugState, selectedTraceNode])

  useEffect(() => {
    if (activeRightPanel !== 'debug' || !debugState || selectedTraceNode) {
      return
    }
    setSelectedTraceNode(resolvePreferredTraceNode(debugState.graphTrace))
  }, [activeRightPanel, debugState, selectedTraceNode])

  useEffect(() => {
    if (selectedTraceNode !== 'relevance_guard') {
      setIsGuardChunksExpanded(false)
    }
  }, [selectedTraceNode])

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      scrollMessagesToBottom(activeStream?.status === 'streaming' ? 'auto' : 'smooth')
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [activeStream?.status, displayMessageCount, isLoading, streamingAnswerLength])

  async function refreshMessages(currentToken: string, currentConversationId: number) {
    setMessages(mapMessagesToViewModel(await chatApi.listMessages(currentToken, currentConversationId)))
  }

  async function recoverMessagesAfterStream(
    currentToken: string,
    currentConversationId: number,
    expectedMessageCount: number,
  ) {
    for (let attempt = 0; attempt < STREAM_RECOVERY_MAX_ATTEMPTS; attempt += 1) {
      const messageItems = await chatApi.listMessages(currentToken, currentConversationId)
      if (messageItems.length >= expectedMessageCount) {
        return mapMessagesToViewModel(messageItems)
      }

      if (attempt < STREAM_RECOVERY_MAX_ATTEMPTS - 1) {
        // 某些线上链路里，消息入库会比流请求的结束感知更晚一拍，这里做短重试避免用户手动刷新。
        await new Promise((resolve) => window.setTimeout(resolve, STREAM_RECOVERY_INTERVAL_MS * (attempt + 1)))
      }
    }

    return null
  }

  function openDebugWorkspace(preferredNode?: string | null) {
    setActiveRightPanel('debug')
    if (!debugState) {
      setSelectedTraceNode(null)
      return
    }
    setSelectedTraceNode(resolvePreferredTraceNode(debugState.graphTrace, preferredNode))
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = 'auto') {
    const element = messageListRef.current
    if (!element) {
      return
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    })
    shouldStickToBottomRef.current = true
    setShowScrollToBottom(false)
  }

  function handleSend() {
    const currentToken = token ?? ''
    const question = input.trim()
    if (!currentToken || !conversation) return
    if (!question) {
      setError('请输入问题内容。')
      return
    }

    setError('')
    setInput('')
    setPendingQuestion(question)
    setShowPendingAssistant(true)
    setIsSending(true)
    shouldStickToBottomRef.current = true
    setShowScrollToBottom(false)
    const expectedMessageCount = messages.length + 2

    const handle = startManagedChatStream({
      token: currentToken,
      payload: {
        knowledge_base_id: conversation.knowledge_base_id,
        conversation_id: conversation.id,
        question,
        top_k: DEFAULT_TOP_K,
        debug: true,
      },
      onStart: () => {
        notifyChatSessionsChanged()
      },
      onError: (message) => {
        setError(message)
      },
    })

    void handle.promise
      .then(async () => {
        const latestSnapshot = getManagedChatStreamSnapshot(conversation.id)
        if (latestSnapshot?.status === 'complete' || latestSnapshot?.status === 'error') {
          return
        }

        const recoveredMessages = await recoverMessagesAfterStream(currentToken, conversation.id, expectedMessageCount)
        if (!recoveredMessages) {
          return
        }

        setMessages(recoveredMessages)
        setPendingQuestion(null)
        setShowPendingAssistant(false)
        setIsSending(false)
        setError('')
        notifyChatSessionsChanged()
        clearManagedChatStream(conversation.id)
        setActiveStream(null)
      })
      .catch((sendError) => {
        setPendingQuestion(null)
        setShowPendingAssistant(false)
        setIsSending(false)
        setInput(question)
        setError(sendError instanceof ApiError ? sendError.message : '发送失败，请稍后重试。')
      })
  }

  async function handleOpenChunkPreview(source: PreviewableChunk, options?: { preserveDebugWorkspace?: boolean; focusNode?: string | null }) {
    const currentToken = token ?? ''
    if (!currentToken || !source.chunk_id) return
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    setSelectedPreviewSource(source)
    setCitationPreview(null)
    setPreviewError('')
    setIsPreviewLoading(true)
    if (options?.preserveDebugWorkspace) {
      openDebugWorkspace(options.focusNode ?? selectedTraceNode)
    } else {
      setActiveRightPanel('citation')
    }
    try {
      const preview = await documentsApi.getChunkPreview(currentToken, source.document_id, source.chunk_id)
      if (previewRequestIdRef.current === requestId) setCitationPreview(preview)
    } catch (previewLoadError) {
      if (previewRequestIdRef.current === requestId) {
        setPreviewError(previewLoadError instanceof ApiError ? previewLoadError.message : '原文预览加载失败，请稍后重试。')
      }
    } finally {
      if (previewRequestIdRef.current === requestId) setIsPreviewLoading(false)
    }
  }

  const renderPreviewPanel = () => {
    if (isPreviewLoading) return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">正在加载原文预览...</div>
    if (previewError) return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{previewError}</div>
    if (!citationPreview)
      return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">选择引用或召回片段后，这里会展示对应 chunk 的原文预览。</div>
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">文档信息</div>
          <div className="mt-3 text-sm font-medium text-slate-900">{citationPreview.filename}</div>
          <div className="mt-2 flex gap-2 text-xs text-slate-500">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">chunk {citationPreview.chunk_index}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">ID {citationPreview.chunk_id}</span>
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

  const renderDebugPanel = () => {
    if (!debugState)
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          还没有可展示的调试数据。发送一条新问题后，这里会显示本次问答的阈值判断、上下文预览、耗时和召回片段。{' '}
        </div>
      )
    return (
      <>
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Search className="h-3.5 w-3.5" />
            请求概览
          </h4>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div>
              <div className="mb-0.5 text-[10px] text-slate-400">问题</div>
              <div className="rounded border border-slate-100 bg-slate-50 p-1.5 text-xs font-medium text-slate-800">{debugState.question}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="知识库" value={debugState.knowledgeBaseName} truncate />
              <Metric label="Top K" value={String(debugState.topK)} />
              <Metric
                label="最高相似度"
                value={formatScore(debugState.top1Score)}
                className={clsx(selectedTraceNode === 'relevance_guard' && 'rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5')}
              />
              <Metric
                label="拒答阈值"
                value={formatScore(debugState.threshold)}
                className={clsx(selectedTraceNode === 'relevance_guard' && 'rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5')}
              />
            </div>
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium',
                debugState.decision === 'reject' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
            >
              {debugState.decision === 'reject' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {getGraphDecisionLabel(debugState.decision)}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            耗时拆分
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['检索耗时', formatDuration(debugState.retrievalMs)],
              ['向量化', formatDuration(debugState.embeddingMs)],
              ['模型生成', formatDuration(debugState.llmMs)],
              ['总耗时', formatDuration(debugState.totalMs)],
            ].map(([label, value]) => (
              <MetricCard key={label} label={label} value={value} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Terminal className="h-3.5 w-3.5" />
            执行轨迹（点击联动）({debugState.graphTrace.length})
          </h4>
          {debugState.graphTrace.length > 0 ? (
            <div className="space-y-2">
              {debugState.graphTrace.map((item, index) => {
                const summaryRows = buildTraceSummaryRows(item)
                return (
                  <button
                    key={`${item.node}-${index}`}
                    type="button"
                    onClick={() => setSelectedTraceNode((current) => (current === item.node ? null : item.node))}
                    className={clsx(
                      'w-full rounded-lg border bg-white p-3 text-left shadow-sm transition-all',
                      selectedTraceNode === item.node ? 'border-blue-300 bg-blue-50/60 shadow-blue-100' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-800">{getGraphNodeLabel(item.node)}</div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-500">{getGraphNodeDescription(item)}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[10px]">
                        <span
                          className={clsx(
                            'rounded border px-1.5 py-0.5 font-medium',
                            item.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700',
                          )}
                        >
                          {getGraphStatusLabel(item.status)}
                        </span>
                        <span className="text-slate-400">{formatDuration(item.durationMs)}</span>
                      </div>
                    </div>
                    {summaryRows.length > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        {summaryRows.map((row) => (
                          <div key={`${item.node}-${row.label}`} className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-slate-400">{row.label}</div>
                            <div className={clsx('inline-flex max-w-full rounded-md border px-2 py-1 text-[11px] font-medium', getTraceSummaryToneClass(row.tone))}>
                              <span className="break-all text-left">{row.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 text-[10px] text-slate-400">{selectedTraceNode === item.node ? '再次点击可取消联动高亮。' : '点击后可联动查看下面的召回片段和阈值判断。'}</div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-500">当前请求尚未记录可展示的执行轨迹。 </div>
          )}
        </div>
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <TextQuote className="h-3.5 w-3.5" />
            最终上下文
          </h4>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {debugState.finalContextPreview ? (
              <>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-6 text-slate-600 whitespace-pre-wrap break-words">
                  {isContextExpanded || debugState.finalContextPreview.length <= 280 ? debugState.finalContextPreview : `${debugState.finalContextPreview.slice(0, 280)}...`}
                </div>
                {debugState.finalContextPreview.length > 280 ? (
                  <button onClick={() => setIsContextExpanded((current) => !current)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                    {isContextExpanded ? (
                      <>
                        收起
                        <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        展开
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">当前请求未向 LLM 发送最终上下文，通常表示本次命中了拒答逻辑。</div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Zap className="h-3.5 w-3.5" />
            召回片段 ({debugState.retrievedChunks.length})
          </h4>
          {selectedTraceItem ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs leading-6 text-blue-700">
              <div className="font-medium">{getGraphNodeLabel(selectedTraceItem.node)}</div>
              <div>{getTraceChunkHint(selectedTraceItem)}</div>
            </div>
          ) : null}
          <div className="space-y-2">
            {debugState.retrievedChunks.map((item, index) => {
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
                isCitationPreviewOpen &&
                selectedPreviewSource?.document_id === item.documentId &&
                selectedPreviewSource?.chunk_id === item.chunkId &&
                selectedPreviewSource?.chunk_index === item.chunkIndex
              const isTopChunk = index === 0
              const isHighlighted = traceChunkFocusMode === 'all' || (traceChunkFocusMode === 'cited' && item.whetherCited) || (traceChunkFocusMode === 'top1' && isTopChunk)
              const isMuted = traceChunkFocusMode === 'cited' ? !item.whetherCited : traceChunkFocusMode === 'top1' ? !isTopChunk : false
              return (
                <div
                  key={`${item.chunkId}-${index}`}
                  className={clsx(
                    'rounded-lg border bg-white p-3 shadow-sm transition-all',
                    isHighlighted ? 'border-blue-300 bg-blue-50/40 shadow-blue-100' : 'border-slate-200',
                    isMuted && 'opacity-55',
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-800">{item.filename}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                        <span>chunk {item.chunkIndex}</span>
                        <span>/</span>
                        <span>id {item.chunkId}</span>
                        {item.whetherCited ? <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">已引用</span> : null}
                        {traceChunkFocusMode === 'top1' && isTopChunk ? (
                          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">最高分</span>
                        ) : null}
                      </div>
                    </div>
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{item.score.toFixed(3)}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{item.snippet}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                    <div className="text-[10px] text-slate-400">{item.startOffset !== null && item.endOffset !== null ? `offset ${item.startOffset} - ${item.endOffset}` : '未提供定位信息'}</div>
                    <button
                      onClick={() => handleOpenChunkPreview(previewTarget)}
                      className={clsx(
                        'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                        isCurrentPreview ? 'bg-blue-50 text-blue-700' : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700',
                      )}
                    >
                      查看原文
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </>
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
      activeRightPanel !== null && selectedPreviewSource?.document_id === item.documentId && selectedPreviewSource?.chunk_id === item.chunkId && selectedPreviewSource?.chunk_index === item.chunkIndex

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
              handleOpenChunkPreview(previewTarget, {
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

  const renderDebugWorkspace = () => {
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
            当前节点没有额外的最终上下文可展示，通常表示本次请求未进入模型生成阶段。{' '}
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

    const renderEvidencePanel = () => {
      if (!selectedTraceItem) {
        return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">请选择左侧一个执行步骤，这里会展示对应的判断依据和证据。 </div>
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
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm leading-7 text-blue-700">当前正在查看检索结果。下面按得分从高到低展示本次召回到的全部候选片段。 </div>
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
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm leading-7 text-blue-700">当前只展示最终被答案实际引用的片段。未被引用的召回片段不会出现在这里。 </div>
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
      <div className="flex h-full min-h-0 flex-col gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="最高相似度" value={formatScore(debugState.top1Score)} className="border-emerald-200 bg-emerald-50/70" />
            <MetricCard label="拒答阈值" value={formatScore(debugState.threshold)} className="border-amber-200 bg-amber-50/70" />
            <MetricCard label="最终引用" value={String(citedRetrievedChunks.length)} className="border-blue-200 bg-blue-50/70" />
            <MetricCard label="总耗时" value={formatDuration(debugState.totalMs)} />
            <MetricCard label="检索耗时" value={formatDuration(debugState.retrievalMs)} />
            <MetricCard label="模型生成" value={formatDuration(debugState.llmMs)} />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-2 pb-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">执行流程</div>
                <div className="mt-1 text-xs text-slate-500">按步骤选择，右侧会同步展示对应证据。</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">{debugState.graphTrace.length} 步</div>
            </div>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 pb-4">
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

          <div className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Search className="h-4 w-4 text-blue-600" />
                {getDebugEvidenceTitle(evidenceMode)}
              </div>
              {selectedTraceItem ? <div className="text-sm leading-6 text-slate-500">{getTraceChunkHint(selectedTraceItem)}</div> : null}
            </div>
            <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 pb-4">
              {renderEvidencePanel()}
              {renderChunkPreviewCard()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-1 overflow-hidden bg-white">
      <div className="relative flex min-w-0 flex-1 flex-col bg-white">
        <div className="z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">{conversation?.title ?? '会话详情'}</h2>
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
              <Database className="h-3 w-3" />
              {knowledgeBase?.name ?? '未匹配知识库'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => (isDebugOpen ? setActiveRightPanel(null) : openDebugWorkspace())}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                isDebugOpen ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <Terminal className="h-3.5 w-3.5" />
              调试工作区{' '}
            </button>
            <button className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={messageListRef} className="flex-1 space-y-8 overflow-y-auto p-6">
          {error ? <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {isLoading ? (
            <EmptyState text="正在加载会话内容..." />
          ) : displayMessages.length === 0 ? (
            <EmptyState text="该会话还没有消息。" />
          ) : (
            displayMessages.map((message) => {
              const isUser = message.role === 'user'
              const isCitationGroupExpanded = Boolean(expandedCitationGroups[message.id])
              const assistantContent = message.content || (message.status === 'error' ? '回答中断，请重试。' : '正在生成...')
              return (
                <div key={message.id} className={clsx('mx-auto flex max-w-4xl gap-4', isUser && 'flex-row-reverse')}>
                  <div
                    className={clsx(
                      'mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border shadow-sm',
                      isUser ? 'border-slate-200 bg-slate-100' : 'border-blue-700 bg-blue-600 text-white',
                    )}
                  >
                    {isUser ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={clsx('flex max-w-[85%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
                    {isUser ? (
                      <div className="rounded-2xl rounded-tr-sm bg-slate-900 px-5 py-3.5 text-sm leading-relaxed text-white shadow-sm whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <div className="w-full overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white shadow-sm">
                        <div className="p-5">
                          <AssistantMarkdown content={assistantContent} isStreaming={message.status === 'streaming'} />
                        </div>
                        {message.citations.length > 0 ? (
                          <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-2">
                            <button
                              onClick={() => setExpandedCitationGroups((current) => ({ ...current, [message.id]: !current[message.id] }))}
                              className="mb-3 mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/60"
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-slate-400" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">引用来源 ({message.citations.length})</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>{isCitationGroupExpanded ? '收起' : '展开查看'}</span>
                                {isCitationGroupExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </button>
                            {isCitationGroupExpanded ? (
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {message.citations.map((citation) => {
                                  const isPreviewAvailable = Boolean(citation.chunk_id)
                                  const isCurrentPreview =
                                    isCitationPreviewOpen &&
                                    selectedPreviewSource?.document_id === citation.document_id &&
                                    selectedPreviewSource?.chunk_id === citation.chunk_id &&
                                    selectedPreviewSource?.chunk_index === citation.chunk_index
                                  return (
                                    <div
                                      key={`${message.id}-${citation.document_id}-${citation.chunk_id ?? citation.chunk_index}`}
                                      className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-blue-300 hover:shadow-sm"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                          <span className="truncate text-xs font-medium text-slate-700 transition-colors group-hover:text-blue-700">{citation.filename}</span>
                                        </div>
                                        <span className="flex-shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">chunk {citation.chunk_index}</span>
                                      </div>
                                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{citation.snippet ?? '暂无摘要'}</p>
                                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                                        <div className="text-[10px] text-slate-400">
                                          {citation.start_offset !== null && citation.end_offset !== null ? `offset ${citation.start_offset} - ${citation.end_offset}` : '未提供定位信息'}
                                        </div>
                                        <button
                                          onClick={() => handleOpenChunkPreview({ ...citation, snippet: citation.snippet ?? null })}
                                          disabled={!isPreviewAvailable}
                                          className={clsx(
                                            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                            isPreviewAvailable
                                              ? isCurrentPreview
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                              : 'cursor-not-allowed text-slate-300',
                                          )}
                                        >
                                          {isPreviewAvailable ? '查看原文' : '原文不可用'}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-400">
                          <span>{message.status === 'streaming' ? '生成中' : message.status === 'error' ? '生成中断' : message.createdAt ? formatDateTime(message.createdAt) : 'AI 响应'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div className="h-4" />
        </div>

        {showScrollToBottom && displayMessages.length > 0 ? (
          <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2">
            <button
              onClick={() => scrollMessagesToBottom('smooth')}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-lg shadow-slate-200/70 transition-colors hover:border-blue-200 hover:text-blue-700"
            >
              <ChevronDown className="h-4 w-4" />
              回到底部
            </button>
          </div>
        ) : null}

        <div className="border-t border-slate-100 bg-white p-4">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-[80px] w-full resize-none bg-transparent p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="继续输入问题，系统将基于当前知识库继续检索回答..."
            />
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="flex items-center gap-1.5 rounded-lg p-1.5 text-xs font-medium text-slate-500">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">{knowledgeBase?.name ?? '未匹配知识库'}</span>
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending || !conversation}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-all',
                  input.trim() && !isSending && conversation ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-slate-200 text-slate-400',
                )}
              >
                {isSending ? '发送中' : '发送'}
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeRightPanel ? (
        <div className="absolute inset-0 z-30 bg-slate-950/30 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-2xl shadow-slate-950/10">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
              <div className="flex min-w-0 items-center gap-3">
                {isDebugOpen ? <Terminal className="h-4 w-4 text-blue-600" /> : <FileText className="h-4 w-4 text-blue-600" />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{isDebugOpen ? 'RAG 调试工作区' : '原文预览'}</div>
                  <div className="truncate text-xs text-slate-500">{conversation?.title ?? debugState?.question ?? '当前会话'}</div>
                </div>
              </div>
              <button onClick={() => setActiveRightPanel(null)} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
              {isDebugOpen ? renderDebugWorkspace() : <div className="mx-auto h-full max-w-5xl overflow-y-auto">{renderPreviewPanel()}</div>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Metric({ label, value, truncate = false, className }: { label: string; value: string; truncate?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-0.5 text-[10px] text-slate-400">{label}</div>
      <div className={clsx('text-slate-700', truncate && 'truncate')} title={truncate ? value : undefined}>
        {value}
      </div>
    </div>
  )
}

function MetricCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={clsx('rounded-lg border border-slate-200 bg-white p-3 shadow-sm', className)}>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">{text}</div>
}
