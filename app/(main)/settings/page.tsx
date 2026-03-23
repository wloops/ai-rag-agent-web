export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">系统设置</h1>
          <p className="mt-1 text-sm text-slate-500">管理您的账户、API 密钥及系统偏好。</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">模型配置</h2>
            <p className="text-sm text-slate-500 mt-1">配置用于 RAG 问答的大语言模型和 Embedding 模型。</p>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">默认对话模型</label>
              <select className="w-full md:w-1/2 block rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 bg-white shadow-sm">
                <option>gemini-3.1-pro-preview</option>
                <option>gemini-3.0-flash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Embedding 模型</label>
              <select className="w-full md:w-1/2 block rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 bg-white shadow-sm">
                <option>text-embedding-004</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
              <input 
                type="password" 
                defaultValue="************************"
                className="w-full md:w-1/2 block rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 bg-white shadow-sm"
              />
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 shadow-sm transition-colors">
              保存更改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
