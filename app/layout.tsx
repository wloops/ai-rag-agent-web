import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "AI RAG Agent",
  description: "企业知识库与 RAG 问答工作台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
