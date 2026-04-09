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

export type AgentTaskType =
  | "knowledge_base_qa"
  | "knowledge_base_summary"
  | "latest_documents_digest"
  | "interview_material";

export interface ConversationItem {
  id: number;
  knowledge_base_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatCitationItem {
  chunk_id: number | null;
  document_id: number;
  filename: string;
  chunk_index: number;
  start_offset: number | null;
  end_offset: number | null;
  snippet: string | null;
}

export interface ChunkPreviewResponse {
  document_id: number;
  chunk_id: number;
  filename: string;
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  preview_text: string;
  highlight_start_offset: number;
  highlight_end_offset: number;
}

export interface RetrievedChunkDebugItem {
  chunk_id: number;
  document_id: number;
  filename: string;
  chunk_index: number;
  content: string;
  score: number;
  guard_score?: number | null;
  source_channels?: string[];
  dense_score?: number | null;
  bm25_score?: number | null;
  fusion_score?: number | null;
  rerank_score?: number | null;
  dense_rank?: number | null;
  bm25_rank?: number | null;
  fusion_rank?: number | null;
  rerank_rank?: number | null;
}

export interface ChatAskDebugRetrievedChunkItem {
  chunk_id: number;
  document_id: number;
  filename: string;
  chunk_index: number;
  snippet: string;
  score: number;
  guard_score?: number | null;
  source_channels?: string[];
  dense_score?: number | null;
  bm25_score?: number | null;
  fusion_score?: number | null;
  rerank_score?: number | null;
  dense_rank?: number | null;
  bm25_rank?: number | null;
  fusion_rank?: number | null;
  rerank_rank?: number | null;
  start_offset: number | null;
  end_offset: number | null;
  whether_cited: boolean;
}

export interface ChatAskDebugGraphTraceItem {
  node: string;
  status: "completed" | "skipped";
  duration_ms: number;
  detail: string;
  used_history: boolean | null;
  rewritten_question: string | null;
  retrieval_count: number | null;
  dense_candidates_count?: number | null;
  bm25_candidates_count?: number | null;
  fusion_candidates_count?: number | null;
  rerank_applied?: boolean | null;
  top1_score: number | null;
  threshold: number | null;
  decision: "answer" | "reject" | null;
  reject_reason?: "no_candidate" | "low_confidence" | null;
  cited_count: number | null;
  used_fallback_citations: boolean | null;
}

export interface ChatAskDebugInfo {
  question: string;
  knowledge_base_id: number;
  top_k: number;
  top1_score: number | null;
  threshold: number;
  decision: "answer" | "reject";
  retrieval_ms: number;
  llm_ms: number;
  total_ms: number;
  embedding_ms: number | null;
  rerank_enabled?: boolean | null;
  reject_reason?: "no_candidate" | "low_confidence" | null;
  final_context_preview: string | null;
  retrieved_chunks: ChatAskDebugRetrievedChunkItem[];
  graph_trace: ChatAskDebugGraphTraceItem[];
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
  debug: ChatAskDebugInfo | null;
}

export interface AgentWorkflowTraceItem {
  step: string;
  status: "completed" | "skipped";
  detail: string;
}

export interface AgentRunRequest {
  knowledge_base_id: number;
  task_type: AgentTaskType;
  query?: string | null;
  top_k?: number;
}

export interface AgentRunResponse {
  knowledge_base_id: number;
  task_type: AgentTaskType;
  answer: string;
  citations: ChatCitationItem[];
  workflow_trace: AgentWorkflowTraceItem[];
}

export interface ChatStreamStartPayload {
  conversation_id: number;
}

export interface ChatStreamDeltaPayload {
  content: string;
}

export interface ChatStreamErrorPayload {
  detail: string;
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
  status?: "streaming" | "error" | "complete";
}

export interface ChatDebugState {
  conversationId: number;
  knowledgeBaseId: number;
  knowledgeBaseName: string;
  question: string;
  topK: number;
  top1Score: number | null;
  threshold: number | null;
  decision: "answer" | "reject" | null;
  retrievalMs: number | null;
  llmMs: number | null;
  totalMs: number | null;
  embeddingMs: number | null;
  rerankEnabled?: boolean | null;
  rejectReason?: "no_candidate" | "low_confidence" | null;
  finalContextPreview: string | null;
  graphTrace: Array<{
    node: string;
    status: "completed" | "skipped";
    durationMs: number;
    detail: string;
    usedHistory: boolean | null;
    rewrittenQuestion: string | null;
    retrievalCount: number | null;
    denseCandidatesCount?: number | null;
    bm25CandidatesCount?: number | null;
    fusionCandidatesCount?: number | null;
    rerankApplied?: boolean | null;
    top1Score: number | null;
    threshold: number | null;
    decision: "answer" | "reject" | null;
    rejectReason?: "no_candidate" | "low_confidence" | null;
    citedCount: number | null;
    usedFallbackCitations: boolean | null;
  }>;
  retrievedChunks: Array<{
    chunkId: number;
    documentId: number;
    filename: string;
    chunkIndex: number;
    snippet: string;
    score: number;
    guardScore?: number | null;
    sourceChannels?: string[];
    denseScore?: number | null;
    bm25Score?: number | null;
    fusionScore?: number | null;
    rerankScore?: number | null;
    denseRank?: number | null;
    bm25Rank?: number | null;
    fusionRank?: number | null;
    rerankRank?: number | null;
    startOffset: number | null;
    endOffset: number | null;
    whetherCited: boolean;
  }>;
  savedAt: string;
}
