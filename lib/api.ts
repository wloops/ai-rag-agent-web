import type {
  AskChatRequest,
  AskChatResponse,
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
};
