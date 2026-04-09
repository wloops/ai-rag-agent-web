'use client'

import clsx from 'clsx'
import { Bot, ChevronDown, ChevronUp, Database, FileText, Layers, Send, User } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

import { formatDateTime } from '@/lib/format'
import type { ChatMessageViewModel } from '@/lib/types'

import { AssistantMarkdown } from './assistant-markdown'
import { EmptyState } from './empty-state'
import type { PreviewableChunk } from '../_lib/chat-session-view'

export function ChatConversationPane({
  messageListRef,
  error,
  isLoading,
  displayMessages,
  expandedCitationGroups,
  setExpandedCitationGroups,
  isCitationPreviewOpen,
  selectedPreviewSource,
  onOpenChunkPreview,
  showScrollToBottom,
  onScrollToBottom,
  input,
  setInput,
  knowledgeBaseName,
  onSend,
  isSending,
  canSend,
}: {
  messageListRef: RefObject<HTMLDivElement | null>
  error: string
  isLoading: boolean
  displayMessages: ChatMessageViewModel[]
  expandedCitationGroups: Record<string, boolean>
  setExpandedCitationGroups: Dispatch<SetStateAction<Record<string, boolean>>>
  isCitationPreviewOpen: boolean
  selectedPreviewSource: PreviewableChunk | null
  onOpenChunkPreview: (source: PreviewableChunk) => void
  showScrollToBottom: boolean
  onScrollToBottom: () => void
  input: string
  setInput: Dispatch<SetStateAction<string>>
  knowledgeBaseName: string
  onSend: () => void
  isSending: boolean
  canSend: boolean
}) {
  return (
    <>
      <div ref={messageListRef} className="flex-1 space-y-8 overflow-y-auto p-6">
        {error ? <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {isLoading ? (
          <EmptyState text="正在加载会话内容..." />
        ) : displayMessages.length === 0 ? (
          <EmptyState text="该会话还没有消息。" />
        ) : (
          displayMessages.map((message) => {
            const isUser = message.role === 'user'
            const isCitationGroupExpanded = Boolean(expandedCitationGroups[message.id])
            const assistantContent = message.content || (message.status === 'error' ? '回答中断，请重试。' : '正在生成...')
            return (
              <div key={message.id} className={clsx('mx-auto flex max-w-4xl gap-4', isUser && 'flex-row-reverse')}>
                <div
                  className={clsx(
                    'mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border shadow-sm',
                    isUser ? 'border-slate-200 bg-slate-100' : 'border-blue-700 bg-blue-600 text-white',
                  )}
                >
                  {isUser ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={clsx('flex max-w-[85%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
                  {isUser ? (
                    <div className="rounded-2xl rounded-tr-sm bg-slate-900 px-5 py-3.5 text-sm leading-relaxed text-white shadow-sm whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <div className="w-full overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white shadow-sm">
                      <div className="p-5">
                        <AssistantMarkdown content={assistantContent} isStreaming={message.status === 'streaming'} />
                      </div>
                      {message.citations.length > 0 ? (
                        <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-2">
                          <button
                            onClick={() => setExpandedCitationGroups((current) => ({ ...current, [message.id]: !current[message.id] }))}
                            className="mb-3 mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/60"
                          >
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-slate-400" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">引用来源 ({message.citations.length})</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>{isCitationGroupExpanded ? '收起' : '展开查看'}</span>
                              {isCitationGroupExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </button>
                          {isCitationGroupExpanded ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {message.citations.map((citation) => {
                                const isPreviewAvailable = Boolean(citation.chunk_id)
                                const isCurrentPreview =
                                  isCitationPreviewOpen &&
                                  selectedPreviewSource?.document_id === citation.document_id &&
                                  selectedPreviewSource?.chunk_id === citation.chunk_id &&
                                  selectedPreviewSource?.chunk_index === citation.chunk_index
                                return (
                                  <div
                                    key={`${message.id}-${citation.document_id}-${citation.chunk_id ?? citation.chunk_index}`}
                                    className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-blue-300 hover:shadow-sm"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                        <span className="truncate text-xs font-medium text-slate-700 transition-colors group-hover:text-blue-700">{citation.filename}</span>
                                      </div>
                                      <span className="flex-shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">chunk {citation.chunk_index}</span>
                                    </div>
                                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{citation.snippet ?? '暂无摘要'}</p>
                                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                                      <div className="text-[10px] text-slate-400">
                                        {citation.start_offset !== null && citation.end_offset !== null ? `offset ${citation.start_offset} - ${citation.end_offset}` : '未提供定位信息'}
                                      </div>
                                      <button
                                        onClick={() => onOpenChunkPreview({ ...citation, snippet: citation.snippet ?? null })}
                                        disabled={!isPreviewAvailable}
                                        className={clsx(
                                          'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                          isPreviewAvailable
                                            ? isCurrentPreview
                                              ? 'bg-blue-50 text-blue-700'
                                              : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                            : 'cursor-not-allowed text-slate-300',
                                        )}
                                      >
                                        {isPreviewAvailable ? '查看原文' : '原文不可用'}
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-400">
                        <span>{message.status === 'streaming' ? '生成中' : message.status === 'error' ? '生成中断' : message.createdAt ? formatDateTime(message.createdAt) : 'AI 响应'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div className="h-4" />
      </div>

      {showScrollToBottom && displayMessages.length > 0 ? (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2">
          <button
            onClick={onScrollToBottom}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-lg shadow-slate-200/70 transition-colors hover:border-blue-200 hover:text-blue-700"
          >
            <ChevronDown className="h-4 w-4" />
            回到底部
          </button>
        </div>
      ) : null}

      <div className="border-t border-slate-100 bg-white p-4">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-[80px] w-full resize-none bg-transparent p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="继续输入问题，系统将基于当前知识库继续检索回答..."
          />
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
            <div className="flex items-center gap-1.5 rounded-lg p-1.5 text-xs font-medium text-slate-500">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">{knowledgeBaseName}</span>
            </div>
            <button
              onClick={onSend}
              disabled={!canSend}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-all',
                canSend ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-slate-200 text-slate-400',
              )}
            >
              {isSending ? '发送中' : '发送'}
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
