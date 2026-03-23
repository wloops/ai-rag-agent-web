"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  File,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Search,
  Settings,
  UploadCloud,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

import { useAuth } from "@/components/auth-provider";
import { ApiError, documentsApi, kbApi } from "@/lib/api";
import { formatDateTime, formatDocumentStatus, formatFileType } from "@/lib/format";
import type { DocumentItem, KnowledgeBaseItem } from "@/lib/types";

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
    failed: {
      icon: XCircle,
      text: formatDocumentStatus(status),
      classes: "border-rose-200 bg-rose-50 text-rose-700",
    },
  }[status as "success" | "pending" | "failed"];

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
      <Icon className={clsx("h-3.5 w-3.5", status === "pending" && "animate-spin")} />
      {config.text}
    </span>
  );
}

export default function KBDetailPage() {
  const params = useParams();
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const knowledgeBaseId = Number(params.id);

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
        const [kbItems, documentItems] = await Promise.all([
          kbApi.list(currentToken),
          documentsApi.list(currentToken, knowledgeBaseId),
        ]);
        if (isMounted) {
          setKnowledgeBases(kbItems);
          setDocuments(documentItems);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof ApiError ? loadError.message : "知识库详情加载失败。");
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

  const knowledgeBase = useMemo(
    () => knowledgeBases.find((item) => item.id === knowledgeBaseId) ?? null,
    [knowledgeBaseId, knowledgeBases],
  );

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
      const updatedDocuments = await documentsApi.list(currentToken, knowledgeBaseId);
      setDocuments(updatedDocuments);
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
              <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                <Settings className="h-4 w-4" />
                设置
              </button>
              <Link
                href={`/chat?knowledgeBaseId=${knowledgeBaseId}`}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                开始问答
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
            disabled={isUploading}
            className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center transition-all hover:border-blue-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-transform group-hover:scale-110">
              {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              {isUploading ? "正在上传与解析文档..." : "点击上传单个文档"}
            </h3>
            <p className="max-w-md text-sm text-slate-500">
              当前接口支持 TXT、Markdown、PDF。上传后会同步完成解析、切片与向量化。
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
                      <th className="px-6 py-3 text-right font-medium">操作</th>
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
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-400 opacity-0 transition-all hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
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
    </div>
  );
}
