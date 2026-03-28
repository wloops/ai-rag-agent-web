"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Database,
  Library,
  MessageSquarePlus,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

import { useAuth } from "@/components/auth-provider";
import { ApiError, kbApi } from "@/lib/api";
import { notifyChatSessionsChanged } from "@/lib/chat";
import { startManagedChatStream } from "@/lib/chat-stream";
import type { KnowledgeBaseItem } from "@/lib/types";

const DEFAULT_TOP_K = 3;

export default function ChatEmptyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestions = [
    "总结一下最新产品规划的核心目标",
    "前端组件库的部署流程是什么？",
    "员工年假申请需要提前几天？",
    "解释一下微服务架构中的鉴权机制",
  ];

  useEffect(() => {
    const currentToken = token ?? "";
    if (!currentToken) {
      return;
    }

    let isMounted = true;

    async function loadKnowledgeBases() {
      setIsLoading(true);
      try {
        const items = await kbApi.list(currentToken);
        if (!isMounted) {
          return;
        }

        setKnowledgeBases(items);

        const queryKnowledgeBaseId = Number(searchParams.get("knowledgeBaseId"));
        if (
          !Number.isNaN(queryKnowledgeBaseId) &&
          items.some((item) => item.id === queryKnowledgeBaseId)
        ) {
          setSelectedKnowledgeBaseId(queryKnowledgeBaseId);
        } else {
          setSelectedKnowledgeBaseId(items[0]?.id ?? null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof ApiError ? loadError.message : "知识库加载失败，请稍后重试。",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadKnowledgeBases();

    return () => {
      isMounted = false;
    };
  }, [searchParams, token]);

  const selectedKnowledgeBase = useMemo(
    () =>
      knowledgeBases.find((knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId) ?? null,
    [knowledgeBases, selectedKnowledgeBaseId],
  );

  function handleSubmit() {
    const currentToken = token ?? "";
    const question = input.trim();
    if (!currentToken) {
      return;
    }
    if (!question) {
      setError("请输入问题内容。");
      return;
    }
    if (!selectedKnowledgeBaseId) {
      setError("请先选择一个知识库。");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const handle = startManagedChatStream({
      token: currentToken,
      payload: {
        knowledge_base_id: selectedKnowledgeBaseId,
        question,
        top_k: DEFAULT_TOP_K,
        debug: true,
      },
      onStart: (conversationId) => {
        notifyChatSessionsChanged();
        router.push(`/chat/${conversationId}`);
      },
      onError: (message) => {
        setError(message);
      },
    });

    void handle.promise
      .catch((submitError) => {
        setError(
          submitError instanceof ApiError ? submitError.message : "提问失败，请稍后重试。",
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  return (
    <div className="relative flex h-full flex-1 flex-col bg-white">
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
        <div className="mb-12 w-full max-w-2xl space-y-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">开始新的智能问答</h1>
            <p className="mx-auto max-w-lg text-lg text-slate-500">
              选择一个知识库并发起提问，系统会基于真实文档完成 RAG 检索与回答。
            </p>
          </div>

          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm">
                <Library className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">当前知识库</p>
                <p className="text-xs text-slate-500">提问前必须选择一个真实知识库</p>
              </div>
            </div>
            <select
              value={selectedKnowledgeBaseId ?? ""}
              onChange={(event) => setSelectedKnowledgeBaseId(Number(event.target.value))}
              disabled={isLoading || knowledgeBases.length === 0}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              {knowledgeBases.length === 0 ? <option value="">暂无知识库</option> : null}
              {knowledgeBases.map((knowledgeBase) => (
                <option key={knowledgeBase.id} value={knowledgeBase.id}>
                  {knowledgeBase.name}
                </option>
              ))}
            </select>
            {knowledgeBases.length === 0 && !isLoading ? (
              <div className="mt-3 text-sm text-slate-500">
                还没有知识库，先去{" "}
                <Link href="/kb" className="font-medium text-blue-600 hover:text-blue-700">
                  创建知识库
                </Link>
                。
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-slate-100 bg-white p-4">
        <div className="relative mx-auto max-w-4xl">
          <div className="scrollbar-hide mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            {suggestions.map((text) => (
              <button
                key={text}
                onClick={() => setInput(text)}
                className="flex-shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
              >
                <span className="flex items-center gap-1.5">
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  {text}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-[80px] w-full resize-none bg-transparent p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="输入你的问题，系统会基于知识库执行 RAG 检索..."
            />
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="flex items-center gap-1">
                <button className="flex items-center gap-1.5 rounded-lg p-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-800">
                  <Paperclip className="h-4 w-4" />
                  <span className="hidden sm:inline">单文件上传请前往知识库页</span>
                </button>
                <div className="mx-1 h-4 w-px bg-slate-300" />
                <div className="flex items-center gap-1.5 rounded-lg p-1.5 text-xs font-medium text-slate-500">
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {selectedKnowledgeBase?.name ?? "未选择知识库"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || !selectedKnowledgeBaseId || isSubmitting}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-all",
                  input.trim() && selectedKnowledgeBaseId && !isSubmitting
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "cursor-not-allowed bg-slate-200 text-slate-400",
                )}
              >
                {isSubmitting ? "发送中" : "发送"}
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {error ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="mt-2 text-center">
            <span className="text-[11px] text-slate-400">
              回答会尽量附带引用来源，请结合原文档核验。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
