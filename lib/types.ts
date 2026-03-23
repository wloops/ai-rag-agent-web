export interface User {
  id: number;
  email: string;
  nickname: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  nickname: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface KnowledgeBaseItem {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
  document_count: number;
  updated_at: string;
}

export interface DocumentItem {
  id: number;
  knowledge_base_id: number;
  filename: string;
  file_type: string;
  storage_path: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface ConversationItem {
  id: number;
  knowledge_base_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatCitationItem {
  document_id: number;
  filename: string;
  chunk_index: number;
  snippet: string | null;
}

export interface RetrievedChunkDebugItem {
  chunk_id: number;
  document_id: number;
  filename: string;
  chunk_index: number;
  content: string;
  score: number;
}

export interface AskChatRequest {
  knowledge_base_id: number;
  question: string;
  top_k?: number;
  debug?: boolean;
  conversation_id?: number;
}

export interface AskChatResponse {
  conversation_id: number;
  answer: string;
  citations: ChatCitationItem[];
  retrieved_chunks: RetrievedChunkDebugItem[] | null;
}

export interface MessageItem {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  citations_json: ChatCitationItem[] | null;
  created_at: string;
}

export interface ChatMessageViewModel {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitationItem[];
  createdAt?: string;
}

export interface ChatDebugState {
  conversationId: number;
  knowledgeBaseId: number;
  knowledgeBaseName: string;
  question: string;
  topK: number;
  retrievedChunks: RetrievedChunkDebugItem[];
  savedAt: string;
}
