"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BrainCircuit } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [nickname, setNickname] = useState("管理员");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/kb");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password, nickname });
      }
      router.replace("/kb");
    } catch (submissionError) {
      if (submissionError instanceof ApiError) {
        setError(submissionError.message);
      } else {
        setError("请求失败，请稍后重试。");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
          正在检查登录状态...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            连接你的知识库系统
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            使用真实账号登录或注册后，即可开始知识库管理与 RAG 问答。
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-xl px-3 py-2 font-medium transition-colors ${
              mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-xl px-3 py-2 font-medium transition-colors ${
              mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            注册
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-slate-700">
                昵称
              </label>
              <input
                id="nickname"
                name="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                required
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting
              ? mode === "login"
                ? "登录中..."
                : "注册中..."
              : mode === "login"
                ? "登录"
                : "注册并登录"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
