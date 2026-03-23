"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  FileText,
  Filter,
  Library,
  MoreVertical,
  Plus,
  Search,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ApiError, kbApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { KnowledgeBaseItem } from "@/lib/types";

export default function KBListPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const currentToken = token ?? "";
    if (!currentToken) {
      return;
    }

    let isMounted = true;

    async function loadKnowledgeBases() {
      setIsLoading(true);
      setError("");
      try {
        const items = await kbApi.list(currentToken);
        if (isMounted) {
          setKnowledgeBases(items);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof ApiError ? loadError.message : "知识库加载失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadKnowledgeBases();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const filteredKnowledgeBases = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return knowledgeBases;
    }

    return knowledgeBases.filter((kb) =>
      [kb.name, kb.description ?? ""].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [knowledgeBases, query]);

  async function handleCreateKnowledgeBase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentToken = token ?? "";
    if (!currentToken) {
      return;
    }

    setCreateError("");
    setIsCreating(true);

    try {
      const created = await kbApi.create(currentToken, {
        name: createName.trim(),
        description: createDescription.trim() || null,
      });
      setKnowledgeBases((current) => [created, ...current]);
      setIsCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      router.push(`/kb/${created.id}`);
    } catch (createErrorValue) {
      setCreateError(
        createErrorValue instanceof ApiError
          ? createErrorValue.message
          : "创建知识库失败，请稍后重试。",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-50/50">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-8 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">知识库</h1>
            <p className="mt-1 text-sm text-slate-500">
              管理你的知识库集合，为 RAG 问答提供真实数据来源。
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            创建知识库
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-slate-200 bg-white/50 px-8 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索知识库..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            <Filter className="h-4 w-4" />
            本地筛选
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl">
          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              正在加载知识库...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredKnowledgeBases.map((kb) => (
                <Link
                  href={`/kb/${kb.id}`}
                  key={kb.id}
                  className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm transition-transform group-hover:scale-105">
                      <Library className="h-6 w-6" />
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity group-hover:bg-slate-50 group-hover:text-slate-600 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">{kb.name}</h3>
                  <p className="mb-6 line-clamp-2 h-10 text-sm leading-relaxed text-slate-500">
                    {kb.description || "暂无描述"}
                  </p>
                  <div className="flex items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="font-medium">{kb.document_count} 份文档</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>更新于 {formatDate(kb.updated_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}

              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition-all hover:border-blue-300 hover:bg-slate-50"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-all">
                  <Plus className="h-6 w-6" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-slate-900">创建新知识库</h3>
                <p className="text-center text-xs text-slate-500">
                  上传文档并开始构建专属 AI 检索知识库。
                </p>
              </button>
            </div>
          )}
        </div>
      </div>

      {isCreateOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">创建知识库</h2>
                <p className="mt-1 text-sm text-slate-500">最少填写名称，创建后即可开始上传文档。</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateKnowledgeBase}>
              <div>
                <label htmlFor="kb-name" className="block text-sm font-medium text-slate-700">
                  名称
                </label>
                <input
                  id="kb-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  required
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div>
                <label
                  htmlFor="kb-description"
                  className="block text-sm font-medium text-slate-700"
                >
                  描述
                </label>
                <textarea
                  id="kb-description"
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {createError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {createError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCreating ? "创建中..." : "创建并进入"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
