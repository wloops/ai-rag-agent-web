"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bot,
  Copy,
  Database,
  FileText,
  Layers,
  MoreHorizontal,
  Search,
  Send,
  Terminal,
  User,
  X,
  Zap,
} from "lucide-react";
import clsx from "clsx";

import { useAuth } from "@/components/auth-provider";
import { ApiError, chatApi, kbApi } from "@/lib/api";
import {
  buildChatDebugState,
  findConversation,
  mapMessagesToViewModel,
  notifyChatSessionsChanged,
  readChatDebugState,
  saveChatDebugState,
} from "@/lib/chat";
import { formatDateTime } from "@/lib/format";
import type {
  ChatDebugState,
  ChatMessageViewModel,
  ConversationItem,
  KnowledgeBaseItem,
} from "@/lib/types";

const DEFAULT_TOP_K = 3;

export default function ChatSessionPage() {
  const params = useParams();
  const conversationId = Number(params.id);
  const { token } = useAuth();

  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [messages, setMessages] = useState<ChatMessageViewModel[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugState, setDebugState] = useState<ChatDebugState | null>(null);

  useEffect(() => {
    const currentToken = token ?? "";
    if (!currentToken || Number.isNaN(conversationId)) {
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError("");

      try {
        const [conversationItems, knowledgeBaseItems] = await Promise.all([
          chatApi.listConversations(currentToken),
          kbApi.list(currentToken),
        ]);

        const currentConversation = findConversation(conversationItems, conversationId);
        if (!currentConversation) {
          throw new Error("会话不存在或已删除。");
        }

        const messageItems = await chatApi.listMessages(currentToken, conversationId);
        if (isMounted) {
          setConversation(currentConversation);
          setKnowledgeBases(knowledgeBaseItems);
          setMessages(mapMessagesToViewModel(messageItems));
          setDebugState(readChatDebugState(conversationId));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof ApiError ? loadError.message : "会话加载失败。");
          setConversation(null);
          setMessages([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [conversationId, token]);

  const knowledgeBase = useMemo(() => {
    if (!conversation) {
      return null;
    }
    return knowledgeBases.find((item) => item.id === conversation.knowledge_base_id) ?? null;
  }, [conversation, knowledgeBases]);

  async function refreshMessages(currentToken: string, currentConversationId: number) {
    const messageItems = await chatApi.listMessages(currentToken, currentConversationId);
    setMessages(mapMessagesToViewModel(messageItems));
  }

  async function handleSend() {
    const currentToken = token ?? "";
    if (!currentToken || !conversation) {
      return;
    }
    if (!input.trim()) {
      setError("请输入问题内容。");
      return;
    }

    setError("");
    setIsSending(true);

    try {
      const response = await chatApi.ask(currentToken, {
        knowledge_base_id: conversation.knowledge_base_id,
        conversation_id: conversation.id,
        question: input.trim(),
        top_k: DEFAULT_TOP_K,
        debug: true,
      });

      saveChatDebugState(
        buildChatDebugState({
          response,
          question: input.trim(),
          knowledgeBase,
          topK: DEFAULT_TOP_K,
        }),
      );
      setDebugState(readChatDebugState(conversation.id));
      setInput("");
      await refreshMessages(currentToken, conversation.id);
      notifyChatSessionsChanged();
    } catch (sendError) {
      setError(sendError instanceof ApiError ? sendError.message : "发送失败，请稍后重试。");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="relative flex h-full flex-1 overflow-hidden bg-white">
      <div className="relative flex min-w-0 flex-1 flex-col bg-white">
        <div className="z-10 flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {conversation?.title ?? "会话详情"}
            </h2>
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
              <Database className="h-3 w-3" />
              {knowledgeBase?.name ?? "未匹配知识库"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDebugOpen((current) => !current)}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                isDebugOpen
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
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

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {error ? (
            <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              正在加载会话内容...
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              该会话还没有消息。
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={clsx(
                    "mx-auto flex max-w-4xl gap-4",
                    isUser ? "flex-row-reverse" : "",
                  )}
                >
                  <div
                    className={clsx(
                      "mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border shadow-sm",
                      isUser
                        ? "border-slate-200 bg-slate-100"
                        : "border-blue-700 bg-blue-600 text-white",
                    )}
                  >
                    {isUser ? (
                      <User className="h-4 w-4 text-slate-600" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  <div
                    className={clsx(
                      "flex max-w-[85%] flex-col gap-2",
                      isUser ? "items-end" : "items-start",
                    )}
                  >
                    {isUser ? (
                      <div className="rounded-2xl rounded-tr-sm bg-slate-900 px-5 py-3.5 text-sm leading-relaxed text-white shadow-sm">
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                    ) : (
                      <div className="w-full overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white shadow-sm">
                        <div className="p-5">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                            {message.content}
                          </div>
                        </div>

                        {message.citations.length > 0 ? (
                          <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-2">
                            <div className="mb-3 mt-2 flex items-center gap-2">
                              <Layers className="h-4 w-4 text-slate-400" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                引用来源 ({message.citations.length})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {message.citations.map((citation) => (
                                <div
                                  key={`${message.id}-${citation.document_id}-${citation.chunk_index}`}
                                  className="group flex cursor-default flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-blue-300 hover:shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                      <span className="truncate text-xs font-medium text-slate-700 transition-colors group-hover:text-blue-700">
                                        {citation.filename}
                                      </span>
                                    </div>
                                    <span className="flex-shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                                      chunk {citation.chunk_index}
                                    </span>
                                  </div>
                                  <p className="line-clamp-3 text-xs leading-relaxed text-slate-500">
                                    {citation.snippet ?? "暂无摘要"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200/50 hover:text-slate-600">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400">
                            {message.createdAt ? formatDateTime(message.createdAt) : "AI 响应"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div className="h-4" />
        </div>

        <div className="flex-shrink-0 border-t border-slate-100 bg-white p-4">
          <div className="relative mx-auto max-w-4xl">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-[80px] w-full resize-none bg-transparent p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="继续输入问题，系统将基于当前知识库继续检索回答..."
              />
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5 rounded-lg p-1.5 text-xs font-medium text-slate-500">
                    <Database className="h-4 w-4" />
                    <span className="hidden sm:inline">{knowledgeBase?.name ?? "未匹配知识库"}</span>
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending || !conversation}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-all",
                    input.trim() && !isSending && conversation
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "cursor-not-allowed bg-slate-200 text-slate-400",
                  )}
                >
                  {isSending ? "发送中" : "发送"}
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDebugOpen ? (
        <div className="z-20 flex w-80 flex-shrink-0 flex-col border-l border-slate-200 bg-slate-50 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
          <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <Terminal className="h-4 w-4 text-blue-600" />
              检索调试
            </div>
            <button
              onClick={() => setIsDebugOpen(false)}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {debugState ? (
              <>
                <div className="space-y-3">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <Search className="h-3.5 w-3.5" />
                    本次请求
                  </h4>
                  <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div>
                      <div className="mb-0.5 text-[10px] text-slate-400">问题</div>
                      <div className="rounded border border-slate-100 bg-slate-50 p-1.5 text-xs font-medium text-slate-800">
                        {debugState.question}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="mb-0.5 text-[10px] text-slate-400">知识库</div>
                        <div className="truncate text-xs text-slate-700" title={debugState.knowledgeBaseName}>
                          {debugState.knowledgeBaseName}
                        </div>
                      </div>
                      <div>
                        <div className="mb-0.5 text-[10px] text-slate-400">Top K</div>
                        <div className="text-xs text-slate-700">{debugState.topK}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <Zap className="h-3.5 w-3.5" />
                    召回片段 ({debugState.retrievedChunks.length})
                  </h4>
                  <div className="space-y-2">
                    {debugState.retrievedChunks.map((item, index) => (
                      <div
                        key={`${item.chunk_id}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-slate-800">
                              {item.filename}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              chunk {item.chunk_index} / id {item.chunk_id}
                            </div>
                          </div>
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            {item.score.toFixed(3)}
                          </span>
                        </div>
                        <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">
                          {item.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                还没有可展示的调试数据。发送一条新问题后，这里会显示本次召回的片段与分数。
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
