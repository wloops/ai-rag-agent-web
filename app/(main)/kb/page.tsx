import Link from 'next/link';
import { 
  Library, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical,
  FileText,
  Clock
} from 'lucide-react';
import { MOCK_KBS } from '@/lib/mock';

export default function KBListPage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* Header */}
      <div className="flex-shrink-0 px-8 py-6 border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">知识库</h1>
            <p className="mt-1 text-sm text-slate-500">管理您的所有文档集合，为 AI 提供上下文。</p>
          </div>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            创建知识库
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-8 py-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="relative w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索知识库..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors">
              <Filter className="w-4 h-4" />
              筛选
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_KBS.map(kb => (
              <Link href={`/kb/${kb.id}`} key={kb.id} className="group block bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform shadow-sm">
                    <Library className="w-6 h-6" />
                  </div>
                  <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{kb.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-6 h-10 leading-relaxed">{kb.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-medium">{kb.docCount} 篇文档</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>更新于 {kb.updatedAt}</span>
                  </div>
                </div>
              </Link>
            ))}
            
            {/* Empty State / Create New Card */}
            <button className="group flex flex-col items-center justify-center bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-2xl p-6 hover:bg-slate-50 hover:border-blue-300 transition-all cursor-pointer min-h-[240px]">
              <div className="w-12 h-12 rounded-full bg-white text-slate-400 flex items-center justify-center border border-slate-200 group-hover:text-blue-600 group-hover:border-blue-200 group-hover:shadow-sm transition-all mb-4">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">创建新知识库</h3>
              <p className="text-xs text-slate-500 text-center">上传文档并开始构建您的专属 AI 知识库</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
