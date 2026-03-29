"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCcw,
  File,
  FileText,
  Filter,
  Loader2,
  Search,
  Settings,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

import { useAuth } from "@/components/auth-provider";
import { ApiError, documentsApi, kbApi } from "@/lib/api";
import { SHOW_AGENT_WORKBENCH } from "@/lib/features";
import { formatDateTime, formatDocumentStatus, formatFileType } from "@/lib/format";
import type { DocumentItem, KnowledgeBaseItem } from "@/lib/types";

interface KnowledgeBaseFormState {
  name: string;
  description: string;
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    success: {
      icon: CheckCircle2,
      text: formatDocumentStatus(status),
      classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    pending: {
      icon: Loader2,
      text: formatDocumentStatus(status),
      classes: "border-amber-200 bg-amber-50 text-amber-700",
    },
    processing: {
      icon: Loader2,
      text: formatDocumentStatus(status),
      classes: "border-blue-200 bg-blue-50 text-blue-700",
    },
    failed: {
      icon: XCircle,
      text: formatDocumentStatus(status),
      classes: "border-rose-200 bg-rose-50 text-rose-700",
    },
  }[status as "success" | "pending" | "processing" | "failed"];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
        config.classes,
      )}
    >
      <Icon
        className={clsx(
          "h-3.5 w-3.5",
          ["pending", "processing"].includes(status) && "animate-spin",
        )}
      />
      {config.text}
    </span>
  );
}

export default function KBDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const knowledgeBaseId = Number(params.id);

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formState, setFormState] = useState<KnowledgeBaseFormState>({
    name: "",
    description: "",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingDocumentId, setRetryingDocumentId] = useState<number | null>(null);

  useEffect(() => {
    const currentToken = token ?? "";
    if (!currentToken || Number.isNaN(knowledgeBaseId)) {
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError("");

      try {
        const [knowledgeBaseItem, documentItems] = await Promise.all([
          kbApi.get(currentToken, knowledgeBaseId),
          documentsApi.list(currentToken, knowledgeBaseId),
        ]);
        if (isMounted) {
          setKnowledgeBase(knowledgeBaseItem);
          setDocuments(documentItems);
          setFormState({
            name: knowledgeBaseItem.name,
            description: knowledgeBaseItem.description ?? "",
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof ApiError ? loadError.message : "知识库详情加载失败。");
          setKnowledgeBase(null);
          setDocuments([]);
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
  }, [knowledgeBaseId, token]);

  useEffect(() => {
    const currentToken = token ?? "";
    if (!currentToken || Number.isNaN(knowledgeBaseId)) {
      return;
    }

    const hasInFlightDocuments = documents.some((document) =>
      ["pending", "processing"].includes(document.status),
    );
    if (!hasInFlightDocuments) {
      return;
    }

    // 只在存在进行中文档时轮询，避免详情页常驻请求；
    // 这里的轮询职责仅限于同步异步建库状态，不承担其它数据刷新。
    const timer = window.setInterval(async () => {
      try {
        const [knowledgeBaseItem, documentItems] = await Promise.all([
          kbApi.get(currentToken, knowledgeBaseId),
          documentsApi.list(currentToken, knowledgeBaseId),
        ]);
        setKnowledgeBase(knowledgeBaseItem);
        setDocuments(documentItems);
      } catch {
        // Ignore polling errors and keep the last successful state.
      }
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [documents, knowledgeBaseId, token]);

  const filteredDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return documents;
    }

    return documents.filter((document) =>
      [
        document.filename,
        document.file_type,
        document.status,
        document.error_message ?? "",
      ].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [documents, query]);

  async function refreshDocuments(currentToken: string) {
    const updatedDocuments = await documentsApi.list(currentToken, knowledgeBaseId);
    setDocuments(updatedDocuments);
  }

  async function handleRetryDocument(documentId: number) {
    const currentToken = token ?? "";
    if (!currentToken) {
      return;
    }

    setRetryingDocumentId(documentId);
    setUploadError("");
    try {
      // 重试入口只负责重新入队失败文档，真正的解析/建库仍由后端异步链路处理，
      // 这样前端行为和首次上传保持一致，避免出现两套处理模型。
      await documentsApi.retry(currentToken, documentId);
      await refreshDocuments(currentToken);
    } catch (retryError) {
      setUploadError(
        retryError instanceof ApiError ? retryError.message : "重试失败，请稍后重试。",
      );
    } finally {
      setRetryingDocumentId(null);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const currentToken = token ?? "";
    if (!file || !currentToken) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      await documentsApi.upload(currentToken, knowledgeBaseId, file);
      await refreshDocuments(currentToken);
      const refreshedKnowledgeBase = await kbApi.get(currentToken, knowledgeBaseId);
      setKnowledgeBase(refreshedKnowledgeBase);
      setFormState({
        name: refreshedKnowledgeBase.name,
        description: refreshedKnowledgeBase.description ?? "",
      });
    } catch (uploadErrorValue) {
      setUploadError(
        uploadErrorValue instanceof ApiError
          ? uploadErrorValue.message
          : "上传失败，请稍后重试。",
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentToken = token ?? "";
    if (!currentToken || !knowledgeBase) {
      return;
    }

    setFormError("");
    setIsSaving(true);

    try {
      const updated = await kbApi.update(currentToken, knowledgeBase.id, {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
      });
      setKnowledgeBase(updated);
      setFormState({
        name: updated.name,
        description: updated.description ?? "",
      });
      setIsSettingsOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof ApiError ? saveError.message : "保存知识库失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteKnowledgeBase() {
    const currentToken = token ?? "";
    if (!currentToken || !knowledgeBase) {
      return;
    }

    setIsDeleting(true);
    try {
      await kbApi.delete(currentToken, knowledgeBase.id);
      router.push("/kb");
    } catch (deleteError) {
      setFormError(deleteError instanceof ApiError ? deleteError.message : "删除知识库失败。");
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-50">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept=".txt,.md,.pdf"
      />

      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-8 py-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/kb"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回知识库列表
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {knowledgeBase?.name ?? "知识库详情"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {knowledgeBase?.description ?? "管理文档上传、索引结果与问答入口。"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!SHOW_AGENT_WORKBENCH ? (
                <style jsx>{`
                  a[href^="/agent"] {
                    display: none;
                  }
                `}</style>
              ) : null}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" />
                设置
              </button>
              <Link
                href={`/chat?knowledgeBaseId=${knowledgeBaseId}`}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                开始问答
              </Link>
              <Link
                href={`/agent?knowledgeBaseId=${knowledgeBaseId}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Agent 工具
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-8">
          <button className="flex items-center gap-2 border-b-2 border-blue-600 px-1 py-4 text-sm font-medium text-blue-600">
            <FileText className="h-4 w-4" />
            文档管理
          </button>
          <button className="flex items-center gap-2 border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
            <Settings className="h-4 w-4" />
            检索配置
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {uploadError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {uploadError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || !knowledgeBase}
            className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center transition-all hover:border-blue-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-transform group-hover:scale-110">
              {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              {isUploading ? "正在上传并提交异步建库..." : "点击上传单个文档"}
            </h3>
            <p className="max-w-md text-sm text-slate-500">
              当前接口支持 TXT、Markdown、PDF。上传后会立即返回，后端会异步完成解析、切片与向量化。
            </p>
          </button>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                全部文档{" "}
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {documents.length}
                </span>
              </h3>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索文档..."
                    className="w-64 rounded-lg border border-slate-200 py-1.5 pl-9 pr-4 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                  <Filter className="h-4 w-4" />
                  本地筛选
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">正在加载文档...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">文件名</th>
                      <th className="px-6 py-3 font-medium">状态</th>
                      <th className="px-6 py-3 font-medium">类型</th>
                      <th className="px-6 py-3 font-medium">创建时间</th>
                      <th className="px-6 py-3 font-medium">备注</th>
                      <th className="px-6 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocuments.map((document) => (
                      <tr key={document.id} className="group transition-colors hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 shadow-sm">
                              <File className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-slate-900">{document.filename}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={document.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-500">{formatFileType(document.file_type)}</td>
                        <td className="px-6 py-4 text-slate-500">
                          {formatDateTime(document.created_at)}
                        </td>
                        <td className="max-w-xs px-6 py-4 text-slate-500">
                          <span className="block truncate" title={document.error_message ?? "索引成功"}>
                            {document.error_message ?? "索引成功"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {document.status === "failed" ? (
                            <button
                              type="button"
                              onClick={() => handleRetryDocument(document.id)}
                              disabled={retryingDocumentId === document.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {retryingDocumentId === document.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCcw className="h-3.5 w-3.5" />
                              )}
                              重试
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                          还没有匹配的文档。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSettingsOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">知识库设置</h2>
                <p className="mt-1 text-sm text-slate-500">
                  修改名称与描述，或执行软删除。删除后会隐藏文档和历史问答，但不会物理清理底层数据。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSaveSettings}>
              <div className="space-y-4">
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
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-rose-700">删除知识库</h3>
                    <p className="mt-1 text-sm leading-relaxed text-rose-600">
                      软删除后，这个知识库会从列表、文档管理和问答入口中隐藏，历史会话也不再显示。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </button>
                </div>
              </div>

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSaving ? "保存中..." : "保存修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isDeleteConfirmOpen && knowledgeBase ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">确认删除知识库</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                删除后将隐藏当前知识库、其关联文档和历史问答入口。底层数据会保留，不会物理清理。
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-medium text-slate-900">{knowledgeBase.name}</div>
              <div className="mt-1 text-xs text-slate-500">
                {knowledgeBase.description || "暂无描述"}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
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
