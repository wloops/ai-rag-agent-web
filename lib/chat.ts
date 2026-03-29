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
    finalContextPreview: response.debug?.final_context_preview ?? null,
    graphTrace:
      response.debug?.graph_trace.map((item) => ({
        node: item.node,
        status: item.status,
        durationMs: item.duration_ms,
        detail: item.detail,
      })) ?? [],
    retrievedChunks:
      response.debug?.retrieved_chunks.map((item) => ({
        chunkId: item.chunk_id,
        documentId: item.document_id,
        filename: item.filename,
        chunkIndex: item.chunk_index,
        snippet: item.snippet,
        score: item.score,
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
      }>;
    }).graph_trace ?? []);

  const normalizedGraphTrace = rawGraphTrace.map((item) => {
    const traceItem = item as {
      node?: string;
      status?: "completed" | "skipped";
      durationMs?: number;
      duration_ms?: number;
      detail?: string;
    };

    return {
      node: traceItem.node ?? "",
      status: traceItem.status ?? "completed",
      durationMs: traceItem.durationMs ?? traceItem.duration_ms ?? 0,
      detail: traceItem.detail ?? "",
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
    finalContextPreview: rawState.finalContextPreview ?? null,
    graphTrace: normalizedGraphTrace,
    retrievedChunks: normalizedChunks,
    savedAt: rawState.savedAt ?? new Date().toISOString(),
  };
}
