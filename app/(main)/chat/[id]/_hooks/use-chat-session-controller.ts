'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useParams } from 'next/navigation'

import { useAuth } from '@/components/auth-provider'
import { ApiError, chatApi, documentsApi, kbApi } from '@/lib/api'
import { buildChatDebugState, findConversation, mapMessagesToViewModel, notifyChatSessionsChanged, readChatDebugState, saveChatDebugState } from '@/lib/chat'
import { clearManagedChatStream, getManagedChatStreamSnapshot, startManagedChatStream, subscribeManagedChatStream, type ManagedChatStreamHandle, type ManagedChatStreamSnapshot } from '@/lib/chat-stream'
import type { ChatDebugState, ChatMessageViewModel, ChunkPreviewResponse, ConversationItem, KnowledgeBaseItem } from '@/lib/types'

import {
  AUTO_SCROLL_THRESHOLD,
  DEFAULT_TOP_K,
  STREAM_RECOVERY_INTERVAL_MS,
  STREAM_RECOVERY_MAX_ATTEMPTS,
  STREAM_STALL_POLL_INTERVAL_MS,
  STREAM_STALL_TIMEOUT_MS,
  buildFallbackConversation,
  buildStreamingAssistantMessage,
  getDebugEvidenceMode,
  getDistanceFromBottom,
  getPreviewSegments,
  getTraceChunkFocusMode,
  resolvePreferredTraceNode,
  type DebugEvidenceMode,
  type PreviewableChunk,
  type RightPanelType,
} from '../_lib/chat-session-view'

export interface ChatChunkPreviewOptions {
  preserveDebugWorkspace?: boolean
  focusNode?: string | null
}

export interface ChatSessionController {
  conversationId: number
  refs: {
    messageListRef: RefObject<HTMLDivElement | null>
  }
  data: {
    conversation: ConversationItem | null
    knowledgeBase: KnowledgeBaseItem | null
    debugState: ChatDebugState | null
    displayMessages: ChatMessageViewModel[]
    latestAssistantMessage: ChatMessageViewModel | null
    citedRetrievedChunks: ChatDebugState['retrievedChunks']
    topRetrievedChunk: ChatDebugState['retrievedChunks'][number] | null
    selectedTraceItem: ChatDebugState['graphTrace'][number] | null
    previewSegments: ReturnType<typeof getPreviewSegments>
    selectedPreviewSource: PreviewableChunk | null
    citationPreview: ChunkPreviewResponse | null
    evidenceMode: DebugEvidenceMode
    isDebugOpen: boolean
    isCitationPreviewOpen: boolean
  }
  ui: {
    input: string
    error: string
    isLoading: boolean
    isSending: boolean
    activeRightPanel: RightPanelType | null
    selectedTraceNode: string | null
    expandedCitationGroups: Record<string, boolean>
    isContextExpanded: boolean
    isPreviewLoading: boolean
    previewError: string
    showScrollToBottom: boolean
    isGuardChunksExpanded: boolean
  }
  actions: {
    setInput: Dispatch<SetStateAction<string>>
    setActiveRightPanel: Dispatch<SetStateAction<RightPanelType | null>>
    setSelectedTraceNode: Dispatch<SetStateAction<string | null>>
    setExpandedCitationGroups: Dispatch<SetStateAction<Record<string, boolean>>>
    setIsContextExpanded: Dispatch<SetStateAction<boolean>>
    setIsGuardChunksExpanded: Dispatch<SetStateAction<boolean>>
    handleSend: () => void
    handleOpenChunkPreview: (source: PreviewableChunk, options?: ChatChunkPreviewOptions) => Promise<void>
    openDebugWorkspace: (preferredNode?: string | null) => void
    scrollMessagesToBottom: (behavior?: ScrollBehavior) => void
  }
}

export function useChatSessionController(): ChatSessionController {
  const params = useParams()
  const conversationId = Number(params.id)
  const { token } = useAuth()
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const previewRequestIdRef = useRef(0)
  const handledStreamTerminalRef = useRef<string | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const activeStreamHandleRef = useRef<ManagedChatStreamHandle | null>(null)
  const pendingExpectedMessageCountRef = useRef<number | null>(null)

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
        pendingExpectedMessageCountRef.current = null
        notifyChatSessionsChanged()
        clearManagedChatStream(conversationId)
        setActiveStream(null)
        activeStreamHandleRef.current = null
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

  const knowledgeBase = useMemo(
    () => conversation && knowledgeBases.find((item) => item.id === conversation.knowledge_base_id),
    [conversation, knowledgeBases],
  )
  const isDebugOpen = activeRightPanel === 'debug'
  const isCitationPreviewOpen = activeRightPanel === 'citation'
  const previewSegments = useMemo(() => getPreviewSegments(citationPreview), [citationPreview])
  const selectedTraceItem = useMemo(
    () => debugState?.graphTrace.find((item) => item.node === selectedTraceNode) ?? null,
    [debugState, selectedTraceNode],
  )
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
  const latestAssistantMessage = useMemo(
    () => [...displayMessages].reverse().find((item) => item.role === 'assistant') ?? null,
    [displayMessages],
  )
  const citedRetrievedChunks = useMemo(
    () => debugState?.retrievedChunks.filter((item) => item.whetherCited) ?? [],
    [debugState],
  )
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

  useEffect(() => {
    const currentToken = token ?? ''
    if (!currentToken || !conversation || !activeStream || activeStream.conversationId !== conversationId || activeStream.status !== 'streaming') {
      return
    }

    const expectedMessageCount = pendingExpectedMessageCountRef.current
    if (!expectedMessageCount) {
      return
    }

    const elapsedMs = Date.now() - new Date(activeStream.updatedAt).getTime()
    const waitMs = Math.max(STREAM_STALL_TIMEOUT_MS - elapsedMs, 0)
    let cancelled = false

    const timeoutId = window.setTimeout(() => {
      if (cancelled) {
        return
      }

      void (async () => {
        try {
          const recoveredMessages = await recoverMessagesAfterStream(currentToken, conversation.id, expectedMessageCount)
          if (!recoveredMessages || cancelled) {
            return
          }

          activeStreamHandleRef.current?.abort()
          activeStreamHandleRef.current = null
          pendingExpectedMessageCountRef.current = null
          setMessages(recoveredMessages)
          setPendingQuestion(null)
          setShowPendingAssistant(false)
          setIsSending(false)
          setError('')
          notifyChatSessionsChanged()
          clearManagedChatStream(conversation.id)
          setActiveStream(null)
        } catch (loadError) {
          if (cancelled) {
            return
          }
          setError(loadError instanceof ApiError ? loadError.message : '会话消息刷新失败，请稍后重试。')
        }
      })()
    }, waitMs + STREAM_STALL_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [activeStream, conversation, conversationId, token])

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
    pendingExpectedMessageCountRef.current = expectedMessageCount

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

        activeStreamHandleRef.current = null
        pendingExpectedMessageCountRef.current = null
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
        activeStreamHandleRef.current = null
        pendingExpectedMessageCountRef.current = null
        setPendingQuestion(null)
        setShowPendingAssistant(false)
        setIsSending(false)
        setInput(question)
        setError(sendError instanceof ApiError ? sendError.message : '发送失败，请稍后重试。')
      })

    activeStreamHandleRef.current = handle
  }

  async function handleOpenChunkPreview(source: PreviewableChunk, options?: ChatChunkPreviewOptions) {
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

  return {
    conversationId,
    refs: {
      messageListRef,
    },
    data: {
      conversation,
      knowledgeBase: knowledgeBase ?? null,
      debugState,
      displayMessages,
      latestAssistantMessage,
      citedRetrievedChunks,
      topRetrievedChunk,
      selectedTraceItem,
      previewSegments,
      selectedPreviewSource,
      citationPreview,
      evidenceMode,
      isDebugOpen,
      isCitationPreviewOpen,
    },
    ui: {
      input,
      error,
      isLoading,
      isSending,
      activeRightPanel,
      selectedTraceNode,
      expandedCitationGroups,
      isContextExpanded,
      isPreviewLoading,
      previewError,
      showScrollToBottom,
      isGuardChunksExpanded,
    },
    actions: {
      setInput,
      setActiveRightPanel,
      setSelectedTraceNode,
      setExpandedCitationGroups,
      setIsContextExpanded,
      setIsGuardChunksExpanded,
      handleSend,
      handleOpenChunkPreview,
      openDebugWorkspace,
      scrollMessagesToBottom,
    },
  }
}
