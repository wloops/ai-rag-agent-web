import type {
  AskChatResponse,
  ChatDebugState,
  ChatMessageViewModel,
  ConversationItem,
  KnowledgeBaseItem,
  MessageItem,
} from "@/lib/types";

const CHAT_DEBUG_PREFIX = "ai-rag-agent.chat-debug";
export const CHAT_SESSIONS_CHANGED_EVENT = "chat:sessions-changed";

export function mapMessagesToViewModel(messages: MessageItem[]): ChatMessageViewModel[] {
  return messages.map((message) => ({
    id: String(message.id),
    role: message.role,
    content: message.content,
    citations: message.citations_json ?? [],
    createdAt: message.created_at,
    status: "complete",
  }));
}

export function buildChatDebugState(params: {
  response: AskChatResponse;
  question: string;
  knowledgeBase: KnowledgeBaseItem | null;
  topK: number;
}): ChatDebugState {
  const { response, question, knowledgeBase, topK } = params;
  const fallbackChunks = (response.retrieved_chunks ?? []).map((item) => ({
    chunkId: item.chunk_id,
    documentId: item.document_id,
    filename: item.filename,
    chunkIndex: item.chunk_index,
    snippet: item.content,
    score: item.score,
    guardScore: item.guard_score ?? null,
    sourceChannels: item.source_channels ?? [],
    denseScore: item.dense_score ?? null,
    bm25Score: item.bm25_score ?? null,
    fusionScore: item.fusion_score ?? null,
    rerankScore: item.rerank_score ?? null,
    denseRank: item.dense_rank ?? null,
    bm25Rank: item.bm25_rank ?? null,
    fusionRank: item.fusion_rank ?? null,
    rerankRank: item.rerank_rank ?? null,
    startOffset: null,
    endOffset: null,
    whetherCited: false,
  }));

  return {
    conversationId: response.conversation_id,
    knowledgeBaseId: response.debug?.knowledge_base_id ?? knowledgeBase?.id ?? 0,
    knowledgeBaseName: knowledgeBase?.name ?? "未命名知识库",
    question: response.debug?.question ?? question,
    topK: response.debug?.top_k ?? topK,
    top1Score: response.debug?.top1_score ?? null,
    threshold: response.debug?.threshold ?? null,
    decision: response.debug?.decision ?? null,
    retrievalMs: response.debug?.retrieval_ms ?? null,
    llmMs: response.debug?.llm_ms ?? null,
    totalMs: response.debug?.total_ms ?? null,
    embeddingMs: response.debug?.embedding_ms ?? null,
    rerankEnabled: response.debug?.rerank_enabled ?? null,
    rejectReason: response.debug?.reject_reason ?? null,
    finalContextPreview: response.debug?.final_context_preview ?? null,
    graphTrace:
      response.debug?.graph_trace.map((item) => ({
        node: item.node,
        status: item.status,
        durationMs: item.duration_ms,
        detail: item.detail,
        usedHistory: item.used_history,
        rewrittenQuestion: item.rewritten_question,
        retrievalCount: item.retrieval_count,
        denseCandidatesCount: item.dense_candidates_count ?? null,
        bm25CandidatesCount: item.bm25_candidates_count ?? null,
        fusionCandidatesCount: item.fusion_candidates_count ?? null,
        rerankApplied: item.rerank_applied ?? null,
        top1Score: item.top1_score,
        threshold: item.threshold,
        decision: item.decision,
        rejectReason: item.reject_reason ?? null,
        citedCount: item.cited_count,
        usedFallbackCitations: item.used_fallback_citations,
      })) ?? [],
    retrievedChunks:
      response.debug?.retrieved_chunks.map((item) => ({
        chunkId: item.chunk_id,
        documentId: item.document_id,
        filename: item.filename,
        chunkIndex: item.chunk_index,
        snippet: item.snippet,
        score: item.score,
        guardScore: item.guard_score ?? null,
        sourceChannels: item.source_channels ?? [],
        denseScore: item.dense_score ?? null,
        bm25Score: item.bm25_score ?? null,
        fusionScore: item.fusion_score ?? null,
        rerankScore: item.rerank_score ?? null,
        denseRank: item.dense_rank ?? null,
        bm25Rank: item.bm25_rank ?? null,
        fusionRank: item.fusion_rank ?? null,
        rerankRank: item.rerank_rank ?? null,
        startOffset: item.start_offset,
        endOffset: item.end_offset,
        whetherCited: item.whether_cited,
      })) ?? fallbackChunks,
    savedAt: new Date().toISOString(),
  };
}

export function saveChatDebugState(debugState: ChatDebugState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    `${CHAT_DEBUG_PREFIX}.${debugState.conversationId}`,
    JSON.stringify(debugState),
  );
}

export function readChatDebugState(conversationId: number): ChatDebugState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(`${CHAT_DEBUG_PREFIX}.${conversationId}`);
  if (!rawValue) {
    return null;
  }

  try {
    return normalizeChatDebugState(JSON.parse(rawValue) as Partial<ChatDebugState>);
  } catch {
    return null;
  }
}

export function notifyChatSessionsChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHAT_SESSIONS_CHANGED_EVENT));
}

export function findConversation(
  conversations: ConversationItem[],
  conversationId: number,
): ConversationItem | null {
  return conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

function normalizeChatDebugState(rawState: Partial<ChatDebugState>): ChatDebugState | null {
  if (!rawState.conversationId) {
    return null;
  }

  const normalizedChunks =
    rawState.retrievedChunks?.map((item) => {
      const legacyItem = item as typeof item & {
        chunk_id?: number;
        document_id?: number;
        chunk_index?: number;
        content?: string;
      };

      return {
        chunkId: item.chunkId ?? legacyItem.chunk_id ?? 0,
        documentId: item.documentId ?? legacyItem.document_id ?? 0,
        filename: item.filename,
        chunkIndex: item.chunkIndex ?? legacyItem.chunk_index ?? 0,
        snippet: item.snippet ?? legacyItem.content ?? "",
        score: item.score,
        guardScore: item.guardScore ?? null,
        sourceChannels: item.sourceChannels ?? [],
        denseScore: item.denseScore ?? null,
        bm25Score: item.bm25Score ?? null,
        fusionScore: item.fusionScore ?? null,
        rerankScore: item.rerankScore ?? null,
        denseRank: item.denseRank ?? null,
        bm25Rank: item.bm25Rank ?? null,
        fusionRank: item.fusionRank ?? null,
        rerankRank: item.rerankRank ?? null,
        startOffset: item.startOffset ?? null,
        endOffset: item.endOffset ?? null,
        whetherCited: item.whetherCited ?? false,
      };
    }) ?? [];

  const rawGraphTrace =
    rawState.graphTrace ??
    ((rawState as Partial<ChatDebugState> & {
      graph_trace?: Array<{
        node?: string;
        status?: "completed" | "skipped";
        duration_ms?: number;
        detail?: string;
        used_history?: boolean;
        rewritten_question?: string;
        retrieval_count?: number;
        dense_candidates_count?: number;
        bm25_candidates_count?: number;
        fusion_candidates_count?: number;
        rerank_applied?: boolean;
        top1_score?: number;
        threshold?: number;
        decision?: "answer" | "reject";
        reject_reason?: "no_candidate" | "low_confidence";
        cited_count?: number;
        used_fallback_citations?: boolean;
      }>;
    }).graph_trace ?? []);

  const normalizedGraphTrace = rawGraphTrace.map((item) => {
    const traceItem = item as {
      node?: string;
      status?: "completed" | "skipped";
      durationMs?: number;
      duration_ms?: number;
      detail?: string;
      usedHistory?: boolean;
      used_history?: boolean;
      rewrittenQuestion?: string;
      rewritten_question?: string;
      retrievalCount?: number;
      retrieval_count?: number;
      denseCandidatesCount?: number;
      dense_candidates_count?: number;
      bm25CandidatesCount?: number;
      bm25_candidates_count?: number;
      fusionCandidatesCount?: number;
      fusion_candidates_count?: number;
      rerankApplied?: boolean;
      rerank_applied?: boolean;
      top1Score?: number;
      top1_score?: number;
      threshold?: number;
      decision?: "answer" | "reject";
      rejectReason?: "no_candidate" | "low_confidence";
      reject_reason?: "no_candidate" | "low_confidence";
      citedCount?: number;
      cited_count?: number;
      usedFallbackCitations?: boolean;
      used_fallback_citations?: boolean;
    };

    return {
      node: traceItem.node ?? "",
      status: traceItem.status ?? "completed",
      durationMs: traceItem.durationMs ?? traceItem.duration_ms ?? 0,
      detail: traceItem.detail ?? "",
      usedHistory: traceItem.usedHistory ?? traceItem.used_history ?? null,
      rewrittenQuestion: traceItem.rewrittenQuestion ?? traceItem.rewritten_question ?? null,
      retrievalCount: traceItem.retrievalCount ?? traceItem.retrieval_count ?? null,
      denseCandidatesCount:
        traceItem.denseCandidatesCount ?? traceItem.dense_candidates_count ?? null,
      bm25CandidatesCount:
        traceItem.bm25CandidatesCount ?? traceItem.bm25_candidates_count ?? null,
      fusionCandidatesCount:
        traceItem.fusionCandidatesCount ?? traceItem.fusion_candidates_count ?? null,
      rerankApplied: traceItem.rerankApplied ?? traceItem.rerank_applied ?? null,
      top1Score: traceItem.top1Score ?? traceItem.top1_score ?? null,
      threshold: traceItem.threshold ?? null,
      decision: traceItem.decision ?? null,
      rejectReason: traceItem.rejectReason ?? traceItem.reject_reason ?? null,
      citedCount: traceItem.citedCount ?? traceItem.cited_count ?? null,
      usedFallbackCitations:
        traceItem.usedFallbackCitations ?? traceItem.used_fallback_citations ?? null,
    };
  });

  return {
    conversationId: rawState.conversationId,
    knowledgeBaseId: rawState.knowledgeBaseId ?? 0,
    knowledgeBaseName: rawState.knowledgeBaseName ?? "未命名知识库",
    question: rawState.question ?? "",
    topK: rawState.topK ?? 0,
    top1Score: rawState.top1Score ?? null,
    threshold: rawState.threshold ?? null,
    decision: rawState.decision ?? null,
    retrievalMs: rawState.retrievalMs ?? null,
    llmMs: rawState.llmMs ?? null,
    totalMs: rawState.totalMs ?? null,
    embeddingMs: rawState.embeddingMs ?? null,
    rerankEnabled: rawState.rerankEnabled ?? null,
    rejectReason: rawState.rejectReason ?? null,
    finalContextPreview: rawState.finalContextPreview ?? null,
    graphTrace: normalizedGraphTrace,
    retrievedChunks: normalizedChunks,
    savedAt: rawState.savedAt ?? new Date().toISOString(),
  };
}
