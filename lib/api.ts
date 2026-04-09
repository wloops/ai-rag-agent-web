import type {
  AgentRunRequest,
  AgentRunResponse,
  AskChatRequest,
  AskChatResponse,
  ChatStreamDeltaPayload,
  ChatStreamErrorPayload,
  ChatStreamStartPayload,
  ChunkPreviewResponse,
  ConversationItem,
  DocumentItem,
  KnowledgeBaseItem,
  LoginRequest,
  MessageItem,
  RegisterRequest,
  TokenResponse,
  User,
} from "@/lib/types";

export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

const DEFAULT_API_BASE_URL = "http://localhost:8000";
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/$/, "");

interface RequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  headers?: HeadersInit;
  formData?: FormData;
}

interface ErrorPayload {
  detail?: string;
  message?: string;
}

interface ChatStreamHandlers {
  onStart?: (payload: ChatStreamStartPayload) => void;
  onDelta?: (payload: ChatStreamDeltaPayload) => void;
  onFinal?: (payload: AskChatResponse) => void;
  onError?: (payload: ChatStreamErrorPayload) => void;
}

interface ChatStreamOptions {
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function emitUnauthorized(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}

async function parseErrorPayload(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorPayload | string;
    if (typeof payload === "string") {
      return payload;
    }

    return payload.detail ?? payload.message ?? `请求失败 (${response.status})`;
  } catch {
    return `请求失败 (${response.status})`;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      emitUnauthorized();
    }
    throw new ApiError(response.status, await parseErrorPayload(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function consumeEventStream(
  response: Response,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response body is unavailable");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const rawEvent = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + 2);
      if (rawEvent) {
        handleEventStreamChunk(rawEvent, handlers);
      }
      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      const trailingEvent = buffer.trim();
      if (trailingEvent) {
        handleEventStreamChunk(trailingEvent, handlers);
      }
      break;
    }
  }
}

function handleEventStreamChunk(rawEvent: string, handlers: ChatStreamHandlers): void {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of rawEvent.split("\n")) {
    if (line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return;
  }

  const payload = JSON.parse(dataLines.join("\n")) as
    | ChatStreamStartPayload
    | ChatStreamDeltaPayload
    | ChatStreamErrorPayload
    | AskChatResponse;

  switch (eventName) {
    case "start":
      handlers.onStart?.(payload as ChatStreamStartPayload);
      break;
    case "delta":
      handlers.onDelta?.(payload as ChatStreamDeltaPayload);
      break;
    case "final":
      handlers.onFinal?.(payload as AskChatResponse);
      break;
    case "error":
      handlers.onError?.(payload as ChatStreamErrorPayload);
      break;
    default:
      break;
  }
}

export const authApi = {
  login(payload: LoginRequest) {
    return request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: payload,
    });
  },
  register(payload: RegisterRequest) {
    return request<User>("/api/auth/register", {
      method: "POST",
      body: payload,
    });
  },
  me(token: string) {
    return request<User>("/api/auth/me", {
      token,
    });
  },
};

export const kbApi = {
  list(token: string) {
    return request<KnowledgeBaseItem[]>("/api/kb", {
      token,
    });
  },
  get(token: string, id: number) {
    return request<KnowledgeBaseItem>(`/api/kb/${id}`, {
      token,
    });
  },
  create(
    token: string,
    payload: { name: string; description?: string | null },
  ) {
    return request<KnowledgeBaseItem>("/api/kb", {
      method: "POST",
      token,
      body: payload,
    });
  },
  update(
    token: string,
    id: number,
    payload: { name: string; description?: string | null },
  ) {
    return request<KnowledgeBaseItem>(`/api/kb/${id}`, {
      method: "PATCH",
      token,
      body: payload,
    });
  },
  delete(token: string, id: number) {
    return request<void>(`/api/kb/${id}`, {
      method: "DELETE",
      token,
    });
  },
};

export const documentsApi = {
  list(token: string, knowledgeBaseId: number) {
    return request<DocumentItem[]>(
      `/api/documents?knowledge_base_id=${knowledgeBaseId}`,
      {
        token,
      },
    );
  },
  upload(token: string, knowledgeBaseId: number, file: File) {
    const formData = new FormData();
    formData.append("knowledge_base_id", String(knowledgeBaseId));
    formData.append("file", file);

    return request<DocumentItem>("/api/documents/upload", {
      method: "POST",
      token,
      formData,
    });
  },
  getChunkPreview(token: string, documentId: number, chunkId: number) {
    return request<ChunkPreviewResponse>(
      `/api/documents/${documentId}/chunks/${chunkId}/preview`,
      {
        token,
      },
    );
  },
  retry(token: string, documentId: number) {
    return request<DocumentItem>(`/api/documents/${documentId}/retry`, {
      method: "POST",
      token,
    });
  },
  delete(token: string, documentId: number) {
    return request<void>(`/api/documents/${documentId}`, {
      method: "DELETE",
      token,
    });
  },
};

export const chatApi = {
  listConversations(token: string) {
    return request<ConversationItem[]>("/api/chat/conversations", {
      token,
    });
  },
  listMessages(token: string, conversationId: number) {
    return request<MessageItem[]>(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        token,
      },
    );
  },
  ask(token: string, payload: AskChatRequest) {
    return request<AskChatResponse>("/api/chat/ask", {
      method: "POST",
      token,
      body: payload,
    });
  },
  async askStream(
    token: string,
    payload: AskChatRequest,
    handlers: ChatStreamHandlers,
    options: ChatStreamOptions = {},
  ) {
    const response = await fetch(`${API_BASE_URL}/api/chat/ask/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: options.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        emitUnauthorized();
      }
      throw new ApiError(response.status, await parseErrorPayload(response));
    }

    await consumeEventStream(response, handlers);
  },
};

export const agentApi = {
  run(token: string, payload: AgentRunRequest) {
    return request<AgentRunResponse>("/api/agent/run", {
      method: "POST",
      token,
      body: payload,
    });
  },
};
