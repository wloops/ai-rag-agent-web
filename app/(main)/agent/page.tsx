"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bot, Database, FileText, Loader2, Play, Sparkles, Wand2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { agentApi, ApiError, kbApi } from "@/lib/api";
import type { AgentRunResponse, AgentTaskType, KnowledgeBaseItem } from "@/lib/types";

const TASK_OPTIONS: Array<{
  value: AgentTaskType;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    value: "knowledge_base_qa",
    label: "知识库问答",
    description: "对当前知识库执行一次不进入聊天会话的快速问答。",
    placeholder: "输入一个明确问题，例如：这家公司为什么会重视 Agent 和 RAG？",
  },
  {
    value: "knowledge_base_summary",
    label: "知识库总结",
    description: "提炼知识库的核心主题、业务价值和技术亮点。",
    placeholder: "可选补充要求，例如：请更偏面试表达来总结。",
  },
  {
    value: "latest_documents_digest",
    label: "最新文档汇总",
    description: "对最近入库的文档做概览，适合快速复习。",
    placeholder: "可选补充要求，例如：突出产品和岗位关键词。",
  },
  {
    value: "interview_material",
    label: "面试材料生成",
    description: "围绕公司、岗位和你的项目，生成可直接复习的话术材料。",
    placeholder: "可选补充要求，例如：请按 3 分钟自我讲解风格输出。",
  },
];

function requiresQuery(taskType: AgentTaskType) {
  // 快速问答必须有明确问题，其它任务允许只靠默认任务意图生成结果。
  return taskType === "knowledge_base_qa";
}

export default function AgentPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const knowledgeBaseIdFromUrl = Number(searchParams.get("knowledgeBaseId"));

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number | "">("");
  const [taskType, setTaskType] = useState<AgentTaskType>("interview_material");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (!isMounted) {
          return;
        }
        setKnowledgeBases(items);
        // 如果是从知识库详情页跳过来，优先沿用 URL 里的 knowledgeBaseId，
        // 否则退回到第一个知识库，减少首次进入 Agent 页的额外选择成本。
        const matchedItem = items.find((item) => item.id === knowledgeBaseIdFromUrl);
        setSelectedKnowledgeBaseId(matchedItem?.id ?? items[0]?.id ?? "");
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : "知识库列表加载失败。");
        setKnowledgeBases([]);
        setSelectedKnowledgeBaseId("");
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
  }, [knowledgeBaseIdFromUrl, token]);

  const selectedTask = useMemo(
    () => TASK_OPTIONS.find((item) => item.value === taskType) ?? TASK_OPTIONS[0],
    [taskType],
  );
  const selectedKnowledgeBase = useMemo(
    () => knowledgeBases.find((item) => item.id === selectedKnowledgeBaseId) ?? null,
    [knowledgeBases, selectedKnowledgeBaseId],
  );

  async function handleRunAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentToken = token ?? "";
    if (!currentToken || !selectedKnowledgeBaseId) {
      return;
    }
    if (requiresQuery(taskType) && !query.trim()) {
      setError("当前任务需要输入明确问题。");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await agentApi.run(currentToken, {
        knowledge_base_id: Number(selectedKnowledgeBaseId),
        task_type: taskType,
        query: query.trim() || null,
        // 问答类更依赖召回覆盖，所以给稍小且稳定的 top_k；
        // 非问答类默认多拿一点上下文，让总结和材料生成更完整。
        top_k: taskType === "knowledge_base_qa" ? 5 : 6,
      });
      setResult(response);
    } catch (runError) {
      setError(runError instanceof ApiError ? runError.message : "Agent 执行失败，请稍后重试。");
      setResult(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-slate-50 px-8 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                Agent 工作台 MVP
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                把现有 RAG 底座包装成更像岗位目标的 Agent 入口
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-500">
                这里不做复杂多 Agent 编排，而是把知识库问答、知识库总结、最新文档汇总和面试材料生成统一成一个轻量任务入口，更适合明天直接演示。
              </p>
            </div>
            {selectedKnowledgeBase ? (
              <Link
                href={`/kb/${selectedKnowledgeBase.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Database className="h-4 w-4" />
                返回知识库详情
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <form onSubmit={handleRunAgent} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">知识库</label>
                <select
                  value={selectedKnowledgeBaseId}
                  onChange={(event) =>
                    setSelectedKnowledgeBaseId(event.target.value ? Number(event.target.value) : "")
                  }
                  className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                >
                  {!selectedKnowledgeBaseId ? <option value="">请选择知识库</option> : null}
                  {knowledgeBases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">任务类型</label>
                <div className="grid gap-3">
                  {TASK_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTaskType(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        taskType === option.value
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-900">{option.label}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {requiresQuery(taskType) ? "任务问题" : "补充要求"}
                </label>
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  rows={6}
                  placeholder={selectedTask.placeholder}
                  className="block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isLoading || isSubmitting || !selectedKnowledgeBaseId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isSubmitting ? "执行中..." : "运行 Agent"}
              </button>
            </form>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">建议演示路径</h2>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>1. 先上传“聚焦网络业务与产品资料库”这一组演示材料。</li>
                <li>2. 用“面试材料生成”演示非聊天型 Agent 入口。</li>
                <li>3. 再切到聊天页，追问同一主题并展示引用和调试面板。</li>
              </ol>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">任务结果</h2>
                  <p className="text-sm text-slate-500">
                    当前结果会展示答案、引用片段和执行轨迹，方便你面试时解释 Agent 并不是黑盒。
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {isLoading ? (
                  // 首屏先解决“有没有知识库可选”的问题，避免用户在空表单里误操作。
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    正在加载知识库列表...
                  </div>
                ) : result ? (
                  // 一旦拿到结果，优先展示答案本身，再补执行轨迹和引用，
                  // 保持页面先给结论、后给证据，符合演示时的阅读顺序。
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                          {TASK_OPTIONS.find((item) => item.value === result.task_type)?.label ?? result.task_type}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                          KB #{result.knowledge_base_id}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {result.answer}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-900">执行轨迹</div>
                        <div className="space-y-3">
                          {result.workflow_trace.map((item, index) => (
                            <div key={`${item.step}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-slate-800">{item.step}</div>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                    item.status === "completed"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-900">引用片段</div>
                        {result.citations.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                            当前结果没有可展示的引用。
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {result.citations.map((citation) => (
                              <div key={`${citation.document_id}-${citation.chunk_id}-${citation.chunk_index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <span className="truncate">{citation.filename}</span>
                                </div>
                                <div className="mt-2 text-xs text-slate-400">
                                  chunk {citation.chunk_index}
                                  {citation.start_offset !== null && citation.end_offset !== null
                                    ? ` | offset ${citation.start_offset}-${citation.end_offset}`
                                    : ""}
                                </div>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{citation.snippet ?? "暂无摘要"}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // 空状态不展示默认示例结果，避免让“Agent 已经运行过”产生误导。
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    选择知识库和任务后运行一次 Agent，这里会显示结果、引用和执行轨迹。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Wand2 className="h-4 w-4 text-blue-600" />
                面试表达建议
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                可以把这页描述成“在现有 RAG 问答之上，补了一层轻量任务编排，让系统既能聊天，也能完成结构化知识工作”，这样会比只讲检索问答更贴近 JD 里的 Agent 落地能力。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
