'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Clock3, Database, FileText, Layers, MoreHorizontal, Search, Send, Terminal, TextQuote, User, X, Zap } from 'lucide-react'
import clsx from 'clsx'

import { useAuth } from '@/components/auth-provider'
import { ApiError, chatApi, documentsApi, kbApi } from '@/lib/api'
import { buildChatDebugState, findConversation, mapMessagesToViewModel, notifyChatSessionsChanged, readChatDebugState, saveChatDebugState } from '@/lib/chat'
import { clearManagedChatStream, getManagedChatStreamSnapshot, startManagedChatStream, subscribeManagedChatStream, type ManagedChatStreamSnapshot } from '@/lib/chat-stream'
import { formatDateTime } from '@/lib/format'
import type { ChatCitationItem, ChatDebugState, ChatMessageViewModel, ChunkPreviewResponse, ConversationItem, KnowledgeBaseItem } from '@/lib/types'

const DEFAULT_TOP_K = 3
const AUTO_SCROLL_THRESHOLD = 96

type RightPanelType = 'debug' | 'citation'
type PreviewableChunk = Pick<ChatCitationItem, 'chunk_id' | 'document_id' | 'filename' | 'chunk_index' | 'start_offset' | 'end_offset'> & { snippet: string | null }

const formatScore = (value: number | null) => (value === null || Number.isNaN(value) ? '--' : value.toFixed(3))
const formatDuration = (value: number | null) => (value === null || Number.isNaN(value) ? '--' : `${value} ms`)

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
    setSelectedPreviewSource(null)
    setCitationPreview(null)
    setExpandedCitationGroups({})
    setIsContextExpanded(false)
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

    void handle.promise.catch((sendError) => {
      setPendingQuestion(null)
      setShowPendingAssistant(false)
      setIsSending(false)
      setInput(question)
      setError(sendError instanceof ApiError ? sendError.message : '发送失败，请稍后重试。')
    })
  }

  async function handleOpenChunkPreview(source: PreviewableChunk) {
    const currentToken = token ?? ''
    if (!currentToken || !source.chunk_id) return
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    setSelectedPreviewSource(source)
    setCitationPreview(null)
    setPreviewError('')
    setIsPreviewLoading(true)
    setActiveRightPanel('citation')
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
          还没有可展示的调试数据。发送一条新问题后，这里会显示本次问答的阈值判断、上下文预览、耗时和召回片段。
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
              <Metric label="Top1 Score" value={formatScore(debugState.top1Score)} />
              <Metric label="Threshold" value={formatScore(debugState.threshold)} />
            </div>
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium',
                debugState.decision === 'reject' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
            >
              {debugState.decision === 'reject' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {debugState.decision ?? '--'}
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
              ['Retrieval', formatDuration(debugState.retrievalMs)],
              ['Embedding', formatDuration(debugState.embeddingMs)],
              ['LLM', formatDuration(debugState.llmMs)],
              ['Total', formatDuration(debugState.totalMs)],
            ].map(([label, value]) => (
              <MetricCard key={label} label={label} value={value} />
            ))}
          </div>
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
              return (
                <div key={`${item.chunkId}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-800">{item.filename}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                        <span>chunk {item.chunkIndex}</span>
                        <span>/</span>
                        <span>id {item.chunkId}</span>
                        {item.whetherCited ? <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">cited</span> : null}
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
              onClick={() => setActiveRightPanel((current) => (current === 'debug' ? null : 'debug'))}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                isDebugOpen ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <Terminal className="h-3.5 w-3.5" />
              调试面板
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
                        <div className="p-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                          {assistantContent}
                          {message.status === 'streaming' ? <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-blue-500/70 align-middle" /> : null}
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
        <div className="z-20 flex w-80 flex-shrink-0 flex-col border-l border-slate-200 bg-slate-50 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              {isDebugOpen ? <Terminal className="h-4 w-4 text-blue-600" /> : <FileText className="h-4 w-4 text-blue-600" />}
              {isDebugOpen ? 'RAG 调试视图' : '原文预览'}
            </div>
            <button onClick={() => setActiveRightPanel(null)} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-4">{isDebugOpen ? renderDebugPanel() : renderPreviewPanel()}</div>
        </div>
      ) : null}
    </div>
  )
}

function Metric({ label, value, truncate = false }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] text-slate-400">{label}</div>
      <div className={clsx('text-slate-700', truncate && 'truncate')} title={truncate ? value : undefined}>
        {value}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">{text}</div>
}
