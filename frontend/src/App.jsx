import { useState, useCallback } from 'react'
import Header from './components/Header.jsx'
import ChatHistory from './components/ChatHistory.jsx'
import SessionBar from './components/SessionBar.jsx'
import DocumentsPanel from './components/DocumentsPanel.jsx'
import QueryBar from './components/QueryBar.jsx'
import Options from './components/Options.jsx'
import { useOllamaModels } from './hooks/useOllamaModels.js'
import { useWorkspace } from './hooks/useWorkspace.js'
import { useRagIngest } from './hooks/useRagIngest.js'
import { useChatAsk } from './hooks/useChatAsk.js'

export default function App() {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [chunkByWords, setChunkByWords] = useState(true)
  const [chunkSize, setChunkSize] = useState(100)
  const [chunkOverlap, setChunkOverlap] = useState(20)
  const [topK, setTopK] = useState(4)
  const [model, setModel] = useState('mistral')
  const [embeddingModel, setEmbeddingModel] = useState('nomic-embed-text')

  const { availableModels, availableEmbeddingModels } = useOllamaModels(
    model,
    embeddingModel,
    setModel,
    setEmbeddingModel
  )

  const ws = useWorkspace()

  const { runIngest, ingestBusy } = useRagIngest({
    activeSessionId: ws.activeSessionId,
    activeSessionIdRef: ws.activeSessionIdRef,
    fingerprintBySession: ws.fingerprintBySession,
    summaryBySession: ws.summaryBySession,
    ingestSessionRef: ws.ingestSessionRef,
    ingestPromiseRef: ws.ingestPromiseRef,
    setDataBySession: ws.setDataBySession,
    chunkSize,
    chunkOverlap,
    chunkByWords,
    embeddingModel,
    setStatusMessage: ws.setStatusMessage,
    setAskError: ws.setAskError,
  })

  const { handleAsk } = useChatAsk({
    question: ws.question,
    setQuestion: ws.setQuestion,
    setPendingQuestion: ws.setPendingQuestion,
    setAskError: ws.setAskError,
    setStatusMessage: ws.setStatusMessage,
    activeSessionId: ws.activeSessionId,
    ingestPromiseRef: ws.ingestPromiseRef,
    summaryBySession: ws.summaryBySession,
    setDataBySession: ws.setDataBySession,
    topK,
    model,
    embeddingModel,
  })

  const handleChunkByWordsChange = useCallback((words) => {
    setChunkByWords(words)
    if (words) {
      setChunkSize(100)
      setChunkOverlap(20)
    } else {
      setChunkSize(512)
      setChunkOverlap(100)
    }
  }, [])

  const displayStatus =
    ws.statusMessage ||
    (ingestBusy ? 'Ingesting in background...' : ws.summaryBySession.current[ws.activeSessionId] || '')

  const optionsSlot = (
    <Options
      compact
      open={optionsOpen}
      onToggle={() => setOptionsOpen((o) => !o)}
      chunkByWords={chunkByWords}
      onChunkByWordsChange={handleChunkByWordsChange}
      chunkSize={chunkSize}
      onChunkSizeChange={setChunkSize}
      chunkOverlap={chunkOverlap}
      onChunkOverlapChange={setChunkOverlap}
      topK={topK}
      onTopKChange={setTopK}
      model={model}
      onModelChange={setModel}
      embeddingModel={embeddingModel}
      onEmbeddingModelChange={setEmbeddingModel}
      availableModels={availableModels}
      availableEmbeddingModels={availableEmbeddingModels}
    />
  )

  return (
    <div className="app-layout">
      <aside className="app-col app-col-chats">
        <h3 className="col-label">Chats</h3>
        <SessionBar
          layout="sidebar"
          sessions={ws.sessions}
          activeSessionId={ws.activeSessionId}
          onSelectSession={ws.selectSession}
          onNewChat={ws.handleNewChat}
          onRequestDeleteSession={ws.handleRequestDeleteSession}
          onRenameSession={ws.handleRenameSession}
        />
      </aside>

      <div className="app-center">
        <header className="app-header-wrap">
          <Header />
        </header>
        <main className="app-main">
          <DocumentsPanel
            compact
            files={ws.uploadedFiles}
            sessionId={ws.activeSessionId}
            ingestBusy={ingestBusy}
            onDeleteDocument={ws.handleDeleteDocument}
          />
          {ws.askError && (
            <div className="alert alert-error" role="alert">
              {ws.askError}
            </div>
          )}
          <div className="app-conversation">
            <ChatHistory turns={ws.chatHistory} pendingQuestion={ws.pendingQuestion} />
          </div>
        </main>
        <div className="query-bar-wrap">
          <QueryBar
            optionsSlot={optionsSlot}
            statusMessage={displayStatus}
            question={ws.question}
            onQuestionChange={ws.setQuestion}
            onAsk={handleAsk}
            ingestInProgress={ingestBusy}
            runIngest={runIngest}
          />
        </div>
      </div>
    </div>
  )
}
