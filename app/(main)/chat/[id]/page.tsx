'use client'

import { ChatConversationPane } from './_components/chat-conversation-pane'
import { ChatDebugWorkspace } from './_components/chat-debug-workspace'
import { ChatSessionHeader } from './_components/chat-session-header'
import { ChatSideOverlay } from './_components/chat-side-overlay'
import { useChatSessionController } from './_hooks/use-chat-session-controller'

export default function ChatSessionPage() {
  const controller = useChatSessionController()
  const { conversation, knowledgeBase, debugState, displayMessages, latestAssistantMessage, citedRetrievedChunks, topRetrievedChunk, selectedTraceItem, previewSegments, selectedPreviewSource, citationPreview, evidenceMode, isDebugOpen, isCitationPreviewOpen } = controller.data
  const { input, error, isLoading, isSending, activeRightPanel, selectedTraceNode, expandedCitationGroups, isContextExpanded, isPreviewLoading, previewError, showScrollToBottom, isGuardChunksExpanded } = controller.ui
  const { setInput, setActiveRightPanel, setSelectedTraceNode, setExpandedCitationGroups, setIsContextExpanded, setIsGuardChunksExpanded, handleSend, handleOpenChunkPreview, openDebugWorkspace, scrollMessagesToBottom } = controller.actions
  const { messageListRef } = controller.refs

  return (
    <div className="relative flex h-full flex-1 overflow-hidden bg-white">
      <div className="relative flex min-w-0 flex-1 flex-col bg-white">
        <ChatSessionHeader
          title={conversation?.title ?? '会话详情'}
          knowledgeBaseName={knowledgeBase?.name ?? '未匹配知识库'}
          isDebugOpen={isDebugOpen}
          onToggleDebug={() => {
            if (isDebugOpen) {
              setActiveRightPanel(null)
              return
            }
            openDebugWorkspace()
          }}
        />

        <ChatConversationPane
          messageListRef={messageListRef}
          error={error}
          isLoading={isLoading}
          displayMessages={displayMessages}
          expandedCitationGroups={expandedCitationGroups}
          setExpandedCitationGroups={setExpandedCitationGroups}
          isCitationPreviewOpen={isCitationPreviewOpen}
          selectedPreviewSource={selectedPreviewSource}
          onOpenChunkPreview={(source) => void handleOpenChunkPreview(source)}
          showScrollToBottom={showScrollToBottom}
          onScrollToBottom={() => scrollMessagesToBottom('smooth')}
          input={input}
          setInput={setInput}
          knowledgeBaseName={knowledgeBase?.name ?? '未匹配知识库'}
          onSend={handleSend}
          isSending={isSending}
          canSend={Boolean(input.trim()) && !isSending && Boolean(conversation)}
        />
      </div>

      <ChatSideOverlay
        activeRightPanel={activeRightPanel}
        title={isDebugOpen ? 'RAG 调试工作区' : '原文预览'}
        subtitle={conversation?.title ?? debugState?.question ?? '当前会话'}
        selectedPreviewSource={selectedPreviewSource}
        citationPreview={citationPreview}
        previewSegments={previewSegments}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
        onClose={() => setActiveRightPanel(null)}
        debugWorkspace={
          <ChatDebugWorkspace
            conversation={conversation}
            debugState={debugState}
            selectedTraceNode={selectedTraceNode}
            setSelectedTraceNode={setSelectedTraceNode}
            selectedTraceItem={selectedTraceItem}
            evidenceMode={evidenceMode}
            selectedPreviewSource={selectedPreviewSource}
            citationPreview={citationPreview}
            previewSegments={previewSegments}
            isContextExpanded={isContextExpanded}
            setIsContextExpanded={setIsContextExpanded}
            isPreviewLoading={isPreviewLoading}
            previewError={previewError}
            latestAssistantMessage={latestAssistantMessage}
            citedRetrievedChunks={citedRetrievedChunks}
            topRetrievedChunk={topRetrievedChunk}
            handleOpenChunkPreview={handleOpenChunkPreview}
            isGuardChunksExpanded={isGuardChunksExpanded}
            setIsGuardChunksExpanded={setIsGuardChunksExpanded}
          />
        }
      />
    </div>
  )
}
