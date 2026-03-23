import Link from 'next/link';
import { 
  Library, 
  FileText, 
  MessageSquare, 
  Activity,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { MOCK_KBS, MOCK_SESSIONS, MOCK_DOCS } from '@/lib/mock';

export default function DashboardPage() {
  const stats = [
    { name: '总知识库', value: '12', icon: Library, trend: '+2 本月' },
    { name: '已索引文档', value: '1,248', icon: FileText, trend: '+156 本周' },
    { name: '问答调用次数', value: '8,492', icon: MessageSquare, trend: '+12% 环比' },
    { name: '系统健康度', value: '99.9%', icon: Activity, trend: '正常运行' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">工作台</h1>
          <p className="mt-1 text-sm text-slate-500">欢迎回来，查看您的知识库运行状态。</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100">
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                  {stat.trend}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</span>
                <span className="text-sm font-medium text-slate-500 mt-1">{stat.name}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent KBs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">活跃知识库</h2>
              <Link href="/kb" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                全部 <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_KBS.slice(0, 4).map((kb) => (
                <Link key={kb.id} href={`/kb/${kb.id}`} className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                        <Library className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-slate-900">{kb.name}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">{kb.description}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {kb.docCount} 篇文档</span>
                    <span>更新于 {kb.updatedAt}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">最近上传</h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {MOCK_DOCS.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span>{doc.size}</span>
                        <span>·</span>
                        <span className={doc.status === 'success' ? 'text-emerald-600' : doc.status === 'pending' ? 'text-amber-600' : 'text-rose-600'}>
                          {doc.status === 'success' ? '已索引' : doc.status === 'pending' ? '处理中' : '失败'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                <Link href="/kb" className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center justify-center w-full">
                  查看所有文档
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
