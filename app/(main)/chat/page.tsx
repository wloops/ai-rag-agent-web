'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  MessageSquarePlus, 
  Sparkles, 
  Library, 
  ArrowRight,
  Send,
  Paperclip,
  Database,
  ChevronDown
} from 'lucide-react';
import clsx from 'clsx';

export default function ChatEmptyPage() {
  const [input, setInput] = useState('');

  const suggestions = [
    "总结一下 v2.0 产品规划的核心目标",
    "前端组件库的部署流程是什么？",
    "员工年假申请需要提前几天？",
    "解释一下微服务架构中的鉴权机制"
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-2xl w-full text-center space-y-8 mb-12">
          
          {/* Hero */}
          <div className="space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 border border-blue-100 shadow-sm">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">开始新的智能问答</h1>
            <p className="text-slate-500 text-lg max-w-lg mx-auto">
              选择一个知识库，或者直接提问，AI 将基于您的企业文档提供准确、可溯源的回答。
            </p>
          </div>

          {/* KB Selector */}
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm">
                <Library className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">选择知识库</p>
                <p className="text-xs text-slate-500">默认全局搜索</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>

        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto relative">
          {/* Quick Suggestions */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {suggestions.map((text, i) => (
              <button 
                key={i}
                onClick={() => setInput(text)}
                className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors flex items-center gap-1.5"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                {text}
              </button>
            ))}
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
                  <span className="hidden sm:inline">全局搜索</span>
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
              </div>
              <Link 
                href="/chat/s1"
                className={clsx(
                  "p-1.5 px-3 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-sm font-medium",
                  input.trim() 
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                发送
                <Send className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          <div className="text-center mt-2">
            <span className="text-[11px] text-slate-400">AI 可能会产生误导性信息，请核实引用来源。</span>
          </div>
        </div>
      </div>
    </div>
  );
}
