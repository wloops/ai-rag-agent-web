"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BrainCircuit,
  LayoutDashboard,
  Library,
  Sparkles,
  MessageCircle,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";
import clsx from "clsx";

import { useAuth } from "@/components/auth-provider";
import { chatApi } from "@/lib/api";
import { CHAT_SESSIONS_CHANGED_EVENT } from "@/lib/chat";
import { SHOW_AGENT_WORKBENCH } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import type { ConversationItem } from "@/lib/types";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const [sessions, setSessions] = useState<ConversationItem[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const currentToken = token ?? "";
    if (!currentToken || !isAuthenticated) {
      setSessions([]);
      setIsSessionsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadSessions() {
      setIsSessionsLoading(true);
      try {
        const items = await chatApi.listConversations(currentToken);
        if (isMounted) {
          setSessions(items);
        }
      } catch {
        if (isMounted) {
          setSessions([]);
        }
      } finally {
        if (isMounted) {
          setIsSessionsLoading(false);
        }
      }
    }

    loadSessions();

    function handleConversationChanged() {
      loadSessions();
    }

    window.addEventListener(CHAT_SESSIONS_CHANGED_EVENT, handleConversationChanged);
    return () => {
      isMounted = false;
      window.removeEventListener(CHAT_SESSIONS_CHANGED_EVENT, handleConversationChanged);
    };
  }, [isAuthenticated, pathname, token]);

  const navItems = [
    { name: "工作台", href: "/dashboard", icon: LayoutDashboard },
    { name: "知识库", href: "/kb", icon: Library },
    ...(SHOW_AGENT_WORKBENCH ? [{ name: "Agent", href: "/agent", icon: Sparkles }] : []),
    { name: "智能问答", href: "/chat", icon: MessageSquare },
    { name: "设置", href: "/settings", icon: Settings },
  ];

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
          正在加载工作台...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Nexus AI</span>
          </Link>
        </div>

        <div className="space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <item.icon
                  className={clsx("h-4 w-4", isActive ? "text-slate-900" : "text-slate-500")}
                />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="mb-2 flex items-center justify-between px-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              最近会话
            </h3>
            <Link href="/chat" className="text-slate-400 transition-colors hover:text-slate-600">
              <Plus className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-0.5">
            {isSessionsLoading ? (
              <div className="rounded-xl px-3 py-3 text-xs text-slate-400">正在加载会话...</div>
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
                还没有会话，去新建一个提问吧。
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = pathname === `/chat/${session.id}`;
                return (
                  <Link
                    key={session.id}
                    href={`/chat/${session.id}`}
                    className={clsx(
                      "group flex flex-col gap-1 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageCircle
                        className={clsx(
                          "h-3.5 w-3.5 flex-shrink-0",
                          isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500",
                        )}
                      />
                      <span className="truncate font-medium">{session.title}</span>
                    </div>
                    <span
                      className={clsx(
                        "pl-6 text-[10px]",
                        isActive ? "text-blue-500/80" : "text-slate-400",
                      )}
                    >
                      {formatDateTime(session.updated_at)}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2">
            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500" />
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-slate-900">
                {user?.nickname ?? "未登录用户"}
              </span>
              <span className="truncate text-xs text-slate-500">{user?.email ?? "-"}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
