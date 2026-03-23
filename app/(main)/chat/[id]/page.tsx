'use client';

import { useState } from 'react';
import { 
  Send, 
  Paperclip, 
  User, 
  Bot, 
  FileText, 
  ChevronDown,
  Terminal,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Database,
  X,
  Layers,
  Search,
  Zap,
  Clock
} from 'lucide-react';
import { MOCK_MESSAGES } from '@/lib/mock';
import clsx from 'clsx';

export default function ChatSessionPage() {
  const [input, setInput] = useState('');
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden relative">
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        {/* Header */}
        <div className="flex-shrink-0 h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">关于 v2.0 产品规划的疑问</h2>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
              <Database className="w-3 h-3" />
              产品需求文档
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsDebugOpen(!isDebugOpen)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                isDebugOpen 
                  ? "bg-blue-50 text-blue-700 border-blue-200" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              调试面板
            </button>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          {MOCK_MESSAGES.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={clsx("flex gap-4 max-w-4xl mx-auto", isUser ? "flex-row-reverse" : "")}>
                {/* Avatar */}
                <div className={clsx(
                  "w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center border shadow-sm mt-1",
                  isUser ? "bg-slate-100 border-slate-200" : "bg-blue-600 border-blue-700 text-white"
                )}>
                  {isUser ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Content */}
                <div className={clsx("flex flex-col gap-2 max-w-[85%]", isUser ? "items-end" : "items-start")}>
                  {isUser ? (
                    <div className="px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm bg-slate-900 text-white rounded-tr-sm">
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ) : (
                    <div className="w-full bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
                      {/* AI Response Text */}
                      <div className="p-5">
                        <div className="text-sm text-slate-800 leading-relaxed 
                          [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mt-5 [&>h3]:mb-2 [&>h3]:text-slate-900 [&>h3:first-child]:mt-0
                          [&>p]:mb-3 [&>p:last-child]:mb-0
                          [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ul>li]:mb-1.5 [&>ul>li::marker]:text-slate-400
                          [&>ul>li>strong]:text-slate-900 [&>ul>li>strong]:font-semibold
                          [&_code]:bg-slate-100 [&_code]:text-pink-600 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[13px] [&_code]:font-mono"
                          dangerouslySetInnerHTML={{ __html: msg.content }}
                        />
                      </div>

                      {/* Citations */}
                      {msg.citations && (
                        <div className="px-5 pb-5 pt-2 bg-slate-50/50 border-t border-slate-100">
                          <div className="flex items-center gap-2 mb-3 mt-2">
                            <Layers className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">引用来源 ({msg.citations.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {msg.citations.map(c => (
                              <div key={c.id} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all group">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    <span className="text-xs font-medium text-slate-700 truncate group-hover:text-blue-700 transition-colors">{c.filename}</span>
                                  </div>
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                    {(c.score * 100).toFixed(0)}% 相关
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                  "{c.snippet}"
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                    {c.chunkId}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-md transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                          <div className="w-px h-3 bg-slate-300 mx-1" />
                          <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"><ThumbsUp className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><ThumbsDown className="w-3.5 h-3.5" /></button>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">AI 生成内容，请注意甄别</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="h-4" />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto relative">
            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              <button className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                什么是混合检索？
              </button>
              <button className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                如何配置文档权限？
              </button>
              <button className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                总结 v2.0 的核心优势
              </button>
            </div>

            <div className="relative border border-slate-300 rounded-2xl shadow-sm bg-white focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all overflow-hidden flex flex-col">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full max-h-64 min-h-[80px] p-4 bg-transparent resize-none outline-none text-sm text-slate-900 placeholder-slate-400"
                placeholder="输入您的问题，基于知识库进行 RAG 问答..."
              />
              <div className="flex items-center justify-between bg-slate-50/50 px-3 py-2 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium">
                    <Paperclip className="w-4 h-4" />
                    <span className="hidden sm:inline">上传附件</span>
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-1" />
                  <button className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium">
                    <Database className="w-4 h-4" />
                    <span className="hidden sm:inline">产品需求文档</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                </div>
                <button 
                  className={clsx(
                    "p-1.5 px-3 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-sm font-medium",
                    input.trim() 
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  发送
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Debug Panel */}
      {isDebugOpen && (
        <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col flex-shrink-0 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20">
          <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white flex-shrink-0">
            <div className="flex items-center gap-2 text-slate-800 font-medium text-sm">
              <Terminal className="w-4 h-4 text-blue-600" />
              检索诊断 (Debug)
            </div>
            <button onClick={() => setIsDebugOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Query Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> 检索配置
              </h4>
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-sm">
                <div>
                  <div className="text-[10px] text-slate-400 mb-0.5">重写后 Query</div>
                  <div className="text-xs font-medium text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-100">
                    {MOCK_MESSAGES[1].debugInfo?.query}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">知识库</div>
                    <div className="text-xs text-slate-700 truncate" title={MOCK_MESSAGES[1].debugInfo?.knowledgeBase}>
                      {MOCK_MESSAGES[1].debugInfo?.knowledgeBase}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Top K</div>
                    <div className="text-xs text-slate-700">{MOCK_MESSAGES[1].debugInfo?.topK}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Embedding 模型</div>
                    <div className="text-xs text-slate-700 truncate" title={MOCK_MESSAGES[1].debugInfo?.embeddingModel}>
                      {MOCK_MESSAGES[1].debugInfo?.embeddingModel}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Reranker 模型</div>
                    <div className="text-xs text-slate-700 truncate" title={MOCK_MESSAGES[1].debugInfo?.reranker}>
                      {MOCK_MESSAGES[1].debugInfo?.reranker}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> 执行耗时
              </h4>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-medium text-slate-700">总延迟</span>
                  <span className="text-xs font-bold text-emerald-600">{MOCK_MESSAGES[1].debugInfo?.latency}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Query Rewrite</span>
                    <span className="text-slate-700 font-mono">120ms</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Vector Search</span>
                    <span className="text-slate-700 font-mono">350ms</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Reranking</span>
                    <span className="text-slate-700 font-mono">280ms</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">LLM Generation</span>
                    <span className="text-slate-700 font-mono">490ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Retrieved Chunks */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> 召回片段 ({MOCK_MESSAGES[1].debugInfo?.retrievedChunks})
              </h4>
              <div className="space-y-2">
                {MOCK_MESSAGES[1].debugInfo?.similarityScores.map((score: number, i: number) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-xs text-slate-600 truncate">chunk-{String(42 + i).padStart(3, '0')}</span>
                    </div>
                    <span className={clsx(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                      score > 0.85 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      score > 0.75 ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-slate-50 text-slate-600 border-slate-200"
                    )}>
                      {score.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
