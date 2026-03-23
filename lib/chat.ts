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
  }));
}

export function buildChatDebugState(params: {
  response: AskChatResponse;
  question: string;
  knowledgeBase: KnowledgeBaseItem | null;
  topK: number;
}): ChatDebugState {
  const { response, question, knowledgeBase, topK } = params;

  return {
    conversationId: response.conversation_id,
    knowledgeBaseId: knowledgeBase?.id ?? 0,
    knowledgeBaseName: knowledgeBase?.name ?? "未命名知识库",
    question,
    topK,
    retrievedChunks: response.retrieved_chunks ?? [],
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
    return JSON.parse(rawValue) as ChatDebugState;
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
