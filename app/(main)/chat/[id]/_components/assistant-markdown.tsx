'use client'

import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function AssistantMarkdown({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold tracking-tight text-slate-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold tracking-tight text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-900">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-900">{children}</h4>,
          p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1 marker:text-slate-400">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">{children}</blockquote>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 hover:text-blue-700">
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className)
            if (isBlock) {
              return <code className={clsx('block overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-[13px] leading-6 text-slate-100', className)}>{children}</code>
            }

            return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">{children}</code>
          },
          pre: ({ children }) => <pre className="overflow-x-auto rounded-xl bg-slate-950">{children}</pre>,
          hr: () => <hr className="border-slate-200" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-600">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming ? <span className="inline-block h-4 w-2 animate-pulse rounded-sm bg-blue-500/70 align-middle" /> : null}
    </div>
  )
}
