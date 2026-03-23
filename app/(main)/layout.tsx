'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Library, 
  MessageSquare, 
  Settings, 
  BrainCircuit,
  Plus,
  MessageCircle
} from 'lucide-react';
import clsx from 'clsx';
import { MOCK_SESSIONS } from '@/lib/mock';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: '工作台', href: '/dashboard', icon: LayoutDashboard },
    { name: '知识库', href: '/kb', icon: Library },
    { name: '智能问答', href: '/chat', icon: MessageSquare },
    { name: '设置', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-slate-900">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Nexus AI</span>
          </Link>
        </div>

        {/* Main Nav */}
        <div className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-slate-100 text-slate-900" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className={clsx("w-4 h-4", isActive ? "text-slate-900" : "text-slate-500")} />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Recent Sessions */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">最近会话</h3>
            <Link href="/chat" className="text-slate-400 hover:text-slate-600 transition-colors">
              <Plus className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-0.5">
            {MOCK_SESSIONS.map((session) => {
              const isActive = pathname === `/chat/${session.id}`;
              return (
                <Link
                  key={session.id}
                  href={`/chat/${session.id}`}
                  className={clsx(
                    "flex flex-col gap-1 px-3 py-2.5 rounded-xl text-sm transition-colors group",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <MessageCircle className={clsx("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500")} />
                    <span className="truncate font-medium">{session.title}</span>
                  </div>
                  <span className={clsx("text-[10px] pl-6", isActive ? "text-blue-500/80" : "text-slate-400")}>
                    {session.updatedAt}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex-shrink-0" />
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-slate-900 truncate">Admin User</span>
              <span className="text-xs text-slate-500 truncate">admin@example.com</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
