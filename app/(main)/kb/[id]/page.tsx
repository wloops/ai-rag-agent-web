'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  UploadCloud, 
  Search, 
  Filter, 
  File, 
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  XCircle,
  Settings,
  FileText
} from 'lucide-react';
import { MOCK_KBS, MOCK_DOCS } from '@/lib/mock';
import clsx from 'clsx';

function StatusBadge({ status }: { status: string }) {
  const config = {
    success: { icon: CheckCircle2, text: '已索引', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending: { icon: Loader2, text: '处理中', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    failed: { icon: XCircle, text: '解析失败', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  }[status as 'success' | 'pending' | 'failed'];

  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border", config.classes)}>
      <Icon className={clsx("w-3.5 h-3.5", status === 'pending' && "animate-spin")} />
      {config.text}
    </span>
  );
}

export default function KBDetailPage() {
  const params = useParams();
  const kbId = params.id as string;
  const kb = MOCK_KBS.find(k => k.id === kbId) || MOCK_KBS[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 px-8 py-6 border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <Link href="/kb" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回知识库列表
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{kb.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{kb.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
                <Settings className="w-4 h-4" />
                设置
              </button>
              <Link href="/chat" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
                开始问答
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-8 border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex items-center gap-8">
          <button className="px-1 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            文档管理
          </button>
          <button className="px-1 py-4 text-sm font-medium text-slate-500 hover:text-slate-900 border-b-2 border-transparent transition-colors flex items-center gap-2">
            <Settings className="w-4 h-4" />
            检索配置
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Upload Area */}
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">点击或拖拽文件到此处上传</h3>
            <p className="text-sm text-slate-500 max-w-md">
              支持 PDF, Word, Excel, Markdown, TXT 等格式。单文件最大支持 50MB。
              系统将自动进行文本解析、分块 (Chunking) 和向量化索引。
            </p>
          </div>

          {/* Doc List */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                全部文档 <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{MOCK_DOCS.length}</span>
              </h3>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="搜索文档..." className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64" />
                </div>
                <button className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-700 shadow-sm transition-colors">
                  <Filter className="w-4 h-4" />
                  筛选
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">文件名</th>
                    <th className="px-6 py-3 font-medium">状态</th>
                    <th className="px-6 py-3 font-medium">大小</th>
                    <th className="px-6 py-3 font-medium">类型/页数</th>
                    <th className="px-6 py-3 font-medium">更新时间</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_DOCS.map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shadow-sm">
                            <File className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-900">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-6 py-4 text-slate-500">{doc.size}</td>
                      <td className="px-6 py-4 text-slate-500">{doc.type} · {doc.pages} 页</td>
                      <td className="px-6 py-4 text-slate-500">{doc.updatedAt}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-all">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
