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
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ApiError, kbApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { KnowledgeBaseItem } from "@/lib/types";

type ModalMode = "create" | "edit";

interface KnowledgeBaseFormState {
  name: string;
  description: string;
}

const EMPTY_FORM: KnowledgeBaseFormState = {
  name: "",
  description: "",
};

export default function KBListPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [formState, setFormState] = useState<KnowledgeBaseFormState>(EMPTY_FORM);
  const [activeKnowledgeBase, setActiveKnowledgeBase] = useState<KnowledgeBaseItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [menuKnowledgeBaseId, setMenuKnowledgeBaseId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBaseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  function openCreateModal() {
    setModalMode("create");
    setActiveKnowledgeBase(null);
    setFormState(EMPTY_FORM);
    setFormError("");
    setIsModalOpen(true);
  }

  function openEditModal(kb: KnowledgeBaseItem) {
    setModalMode("edit");
    setActiveKnowledgeBase(kb);
    setFormState({
      name: kb.name,
      description: kb.description ?? "",
    });
    setFormError("");
    setIsModalOpen(true);
    setMenuKnowledgeBaseId(null);
  }

  function closeModal() {
    setIsModalOpen(false);
    setFormError("");
    setIsSubmitting(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentToken = token ?? "";
    if (!currentToken) {
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      if (modalMode === "create") {
        const created = await kbApi.create(currentToken, {
          name: formState.name.trim(),
          description: formState.description.trim() || null,
        });
        setKnowledgeBases((current) => [created, ...current]);
        closeModal();
        router.push(`/kb/${created.id}`);
        return;
      }

      if (!activeKnowledgeBase) {
        throw new Error("Knowledge base is required");
      }

      const updated = await kbApi.update(currentToken, activeKnowledgeBase.id, {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
      });
      setKnowledgeBases((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      closeModal();
    } catch (submitError) {
      setFormError(
        submitError instanceof ApiError
          ? submitError.message
          : modalMode === "create"
            ? "创建知识库失败，请稍后重试。"
            : "更新知识库失败，请稍后重试。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteKnowledgeBase() {
    const currentToken = token ?? "";
    if (!currentToken || !deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await kbApi.delete(currentToken, deleteTarget.id);
      setKnowledgeBases((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMenuKnowledgeBaseId(null);
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : "删除知识库失败。");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-50/50">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-8 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">知识库</h1>
            <p className="mt-1 text-sm text-slate-500">
              管理你的知识库集合，为 RAG 问答提供真实、可追溯的数据来源。
            </p>
          </div>
          <button
            onClick={openCreateModal}
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
                <div
                  key={kb.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm transition-transform group-hover:scale-105">
                      <Library className="h-6 w-6" />
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuKnowledgeBaseId((current) => (current === kb.id ? null : kb.id))
                        }
                        className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity group-hover:bg-slate-50 group-hover:text-slate-600 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuKnowledgeBaseId === kb.id ? (
                        <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                          <button
                            type="button"
                            onClick={() => openEditModal(kb)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <PencilLine className="h-4 w-4" />
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(kb);
                              setMenuKnowledgeBaseId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <Link href={`/kb/${kb.id}`} className="block">
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
                </div>
              ))}

              <button
                type="button"
                onClick={openCreateModal}
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

      {isModalOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {modalMode === "create" ? "创建知识库" : "编辑知识库"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {modalMode === "create"
                    ? "填写名称和描述，创建后即可开始上传文档。"
                    : "修改知识库名称和描述，变更会立即对列表和详情页生效。"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="kb-name" className="block text-sm font-medium text-slate-700">
                  名称
                </label>
                <input
                  id="kb-name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div>
                <label htmlFor="kb-description" className="block text-sm font-medium text-slate-700">
                  描述
                </label>
                <textarea
                  id="kb-description"
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={4}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmitting
                    ? modalMode === "create"
                      ? "创建中..."
                      : "保存中..."
                    : modalMode === "create"
                      ? "创建并进入"
                      : "保存修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">删除知识库</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                删除后，知识库会从列表、文档管理和问答入口中隐藏，关联历史问答也不再展示。
                这是软删除，不会物理清理底层文档、切片和上传文件。
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-medium text-slate-900">{deleteTarget.name}</div>
              <div className="mt-1 text-xs text-slate-500">
                {deleteTarget.description || "暂无描述"}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteKnowledgeBase}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
              >
                {isDeleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
