import { useState, useRef, useCallback, useEffect } from 'react'
import { ingestFiles, query, clearSession, listModels, deleteDocument } from './api'
import Header from './components/Header.jsx'
import ChatHistory from './components/ChatHistory.jsx'
import SessionBar from './components/SessionBar.jsx'
import DocumentsPanel from './components/DocumentsPanel.jsx'
import QueryBar from './components/QueryBar.jsx'
import Options from './components/Options.jsx'
import {
  loadWorkspaceState,
  saveWorkspaceState,
  generateSessionId,
  nextChatTitle,
} from './workspaceStorage.js'

const MODELS = ['mistral', 'llama3.2', 'llama3.1', 'phi3', 'gemma2']
const EMBEDDING_MODELS = ['nomic-embed-text', 'mxbai-embed-large', 'snowflake-arctic-embed']
const AUTO_CHAT_TITLE_RE = /^Chat \d+$/

export default function App() {
  const initial = loadWorkspaceState()
  const [sessions, setSessions] = useState(initial.sessions)
  const [activeSessionId, setActiveSessionId] = useState(initial.activeSessionId)
  const [dataBySession, setDataBySession] = useState(initial.dataBySession)

  const [question, setQuestion] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [chunkByWords, setChunkByWords] = useState(true)
  const [chunkSize, setChunkSize] = useState(100)
  const [chunkOverlap, setChunkOverlap] = useState(20)
  const [topK, setTopK] = useState(4)
  const [model, setModel] = useState('mistral')
  const [embeddingModel, setEmbeddingModel] = useState('nomic-embed-text')
  const [availableModels, setAvailableModels] = useState([])
  const [availableEmbeddingModels, setAvailableEmbeddingModels] = useState([])
  const [ingestInProgress, setIngestInProgress] = useState(false)
  const [askError, setAskError] = useState(null)

  const ingestPromiseRef = useRef(null)
  const fingerprintBySession = useRef({})
  const summaryBySession = useRef({})
  const ingestSessionRef = useRef(null)
  const activeSessionIdRef = useRef(activeSessionId)
  activeSessionIdRef.current = activeSessionId

  useEffect(() => {
    saveWorkspaceState({ sessions, activeSessionId, dataBySession })
  }, [sessions, activeSessionId, dataBySession])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const local = await listModels()
        if (!alive) return
        const filtered = local.filter((m) => MODELS.includes(m))
        const filteredEmbeddings = local.filter((m) => EMBEDDING_MODELS.includes(m))
        setAvailableModels(filtered)
        setAvailableEmbeddingModels(filteredEmbeddings)
        if (filtered.includes('mistral')) {
          setModel('mistral')
        } else if (filtered.length > 0 && !filtered.includes(model)) {
          setModel(filtered[0])
        }
        if (filteredEmbeddings.includes('nomic-embed-text')) {
          setEmbeddingModel('nomic-embed-text')
        } else if (filteredEmbeddings.length > 0 && !filteredEmbeddings.includes(embeddingModel)) {
          setEmbeddingModel(filteredEmbeddings[0])
        }
      } catch {
        if (!alive) return
        setAvailableModels([])
        setAvailableEmbeddingModels([])
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const chatHistory = dataBySession[activeSessionId]?.turns ?? []
  const uploadedFiles = dataBySession[activeSessionId]?.uploadedFiles ?? []

  const formatModelMissingMessage = useCallback((raw, fallbackModel) => {
    const text = String(raw || '')
    const match = text.match(/model\s+['"]?([^'"]+)['"]?\s+not found/i)
    const missing = match?.[1] || fallbackModel
    if (!missing) return text
    return `Model "${missing}" is not installed locally. Run: ollama pull ${missing}`
  }, [])

  const selectSession = useCallback(
    (id) => {
      if (id === activeSessionId) return
      setActiveSessionId(id)
      setQuestion('')
      setAskError(null)
      setPendingQuestion('')
      setStatusMessage(summaryBySession.current[id] || '')
    },
    [activeSessionId]
  )

  const handleNewChat = useCallback(() => {
    const id = generateSessionId()
    setSessions((prev) => {
      const title = nextChatTitle(prev)
      return [...prev, { id, title }]
    })
    setDataBySession((prev) => ({
      ...prev,
      [id]: { turns: [], uploadedFiles: [] },
    }))
    summaryBySession.current[id] = ''
    setActiveSessionId(id)
    setQuestion('')
    setAskError(null)
    setPendingQuestion('')
    setStatusMessage('')
    ingestPromiseRef.current = null
  }, [])

  const normalizeAutoTitles = useCallback((list) => {
    let autoIndex = 1
    return list.map((s) => {
      const title = (s.title || '').trim()
      if (!AUTO_CHAT_TITLE_RE.test(title)) return s
      const normalized = `Chat ${autoIndex}`
      autoIndex += 1
      return title === normalized ? s : { ...s, title: normalized }
    })
  }, [])

  const deleteSessionById = useCallback(async (sid) => {
    try {
      await clearSession(sid)
    } catch (_) {}

    delete fingerprintBySession.current[sid]
    delete summaryBySession.current[sid]

    const deletedActive = sid === activeSessionId

    setSessions((prev) => {
      const filtered = normalizeAutoTitles(prev.filter((s) => s.id !== sid))
      if (filtered.length === 0) {
        const nid = generateSessionId()
        setDataBySession({ [nid]: { turns: [], uploadedFiles: [] } })
        setActiveSessionId(nid)
        setStatusMessage('')
        setQuestion('')
        setAskError(null)
        setPendingQuestion('')
        return [{ id: nid, title: 'Chat 1' }]
      }
      setDataBySession((d) => {
        const c = { ...d }
        delete c[sid]
        return c
      })
      if (deletedActive) {
        const nextId = filtered[0].id
        setActiveSessionId(nextId)
        setStatusMessage(summaryBySession.current[nextId] || '')
        setQuestion('')
        setAskError(null)
        setPendingQuestion('')
      }
      return filtered
    })

    ingestPromiseRef.current = null
  }, [activeSessionId, normalizeAutoTitles])

  const handleRequestDeleteSession = useCallback(
    (sid) => {
      if (!window.confirm('Delete this chat and its documents?')) return
      void deleteSessionById(sid)
    },
    [deleteSessionById]
  )

  const handleRenameSession = useCallback((sid) => {
    const s = sessions.find((x) => x.id === sid)
    const current = s?.title ?? ''
    const next = window.prompt('Chat name', current)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === current) return
    setSessions((prev) => prev.map((x) => (x.id === sid ? { ...x, title: trimmed } : x)))
  }, [sessions])

  const handleDeleteDocument = useCallback(
    async (name) => {
      if (!activeSessionId || !name) return
      if (!window.confirm(`Delete "${name}" from this chat context?`)) return
      try {
        const res = await deleteDocument(activeSessionId, name)
        const removed = Number(res?.deleted_chunks || 0)
        setDataBySession((prev) => {
          const cur = prev[activeSessionId] ?? { turns: [], uploadedFiles: [] }
          return {
            ...prev,
            [activeSessionId]: {
              ...cur,
              uploadedFiles: (cur.uploadedFiles ?? []).filter((f) => f !== name),
            },
          }
        })
        setStatusMessage(`Removed ${removed} chunk(s) for ${name}.`)
      } catch (err) {
        setAskError(err.message ?? 'Could not delete document.')
      }
    },
    [activeSessionId]
  )

  const runIngest = useCallback(
    async (files) => {
      if (!files?.length) return
      const sid = activeSessionId
      const fingerprint = files
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => [f.name, f.size, embeddingModel, chunkByWords, chunkSize, chunkOverlap])
        .join(',')
      if (fingerprint === fingerprintBySession.current[sid] && !ingestInProgress) return
      fingerprintBySession.current[sid] = fingerprint
      setIngestInProgress(true)
      ingestSessionRef.current = sid
      setStatusMessage('Ingesting in background...')
      const promise = ingestFiles(sid, files, {
        chunkSize,
        chunkOverlap,
        chunkByWords,
        embeddingModel,
      })
      ingestPromiseRef.current = promise
      try {
        const data = await promise
        const total = data?.total_chunks ?? 0
        const nFiles = data?.files?.length ?? 0
        const failures = (data?.files ?? []).filter((f) => Boolean(f?.error))
        const summary = data?.ok ? `Ingested ${total} chunks from ${nFiles} file(s).` : ''
        summaryBySession.current[sid] = summary
        if (sid === activeSessionIdRef.current) {
          if (failures.length > 0) {
            setStatusMessage(`${summary} ${failures.length} file(s) failed.`.trim())
            const firstErr = String(failures[0]?.error || 'Ingest failed')
            const msg = /not found/i.test(firstErr)
              ? formatModelMissingMessage(firstErr, embeddingModel)
              : firstErr
            setAskError(msg)
          } else {
            setStatusMessage(summary)
            setAskError(null)
          }
        }
        if (data?.ok && data?.files?.length) {
          setDataBySession((prev) => {
            const cur = prev[sid] ?? { turns: [], uploadedFiles: [] }
            const existing = new Set(cur.uploadedFiles ?? [])
            for (const f of data.files) {
              const name = f.filename ?? f.name ?? 'File'
              existing.add(name)
            }
            return {
              ...prev,
              [sid]: {
                ...cur,
                uploadedFiles: Array.from(existing),
              },
            }
          })
        }
      } catch {
        fingerprintBySession.current[sid] = ''
        if (sid === activeSessionIdRef.current) {
          setStatusMessage('')
        }
      } finally {
        setIngestInProgress(false)
        ingestPromiseRef.current = null
        ingestSessionRef.current = null
      }
    },
    [activeSessionId, chunkSize, chunkOverlap, chunkByWords, embeddingModel, ingestInProgress]
  )

  const handleAsk = useCallback(async () => {
    const q = question.trim()
    if (!q) return

    const sid = activeSessionId
    setQuestion('')
    setPendingQuestion(q)
    setAskError(null)
    try {
      if (ingestPromiseRef.current) {
        await ingestPromiseRef.current
        setStatusMessage(summaryBySession.current[sid] || '')
      }
      const data = await query(sid, {
        question: q,
        topK,
        model: MODELS.includes(model) ? model : undefined,
        embeddingModel,
      })
      if (data.error) {
        const msg = String(data.error)
        setAskError(/not found/i.test(msg) ? formatModelMissingMessage(msg, model) : msg)
        setPendingQuestion('')
        setStatusMessage('')
        return
      }
      setDataBySession((prev) => {
        const cur = prev[sid] ?? { turns: [], uploadedFiles: [] }
        const turn = {
          question: q,
          answer: data.answer ?? '',
          sources: data.sources ?? [],
        }
        return {
          ...prev,
          [sid]: {
            ...cur,
            turns: [...(cur.turns ?? []), turn],
          },
        }
      })
      setPendingQuestion('')
      setStatusMessage(summaryBySession.current[sid] || '')
    } catch (err) {
      const msg = err.message ?? 'Request failed'
      setAskError(/not found/i.test(msg) ? formatModelMissingMessage(msg, model) : msg)
      setPendingQuestion('')
      setStatusMessage('')
    }
  }, [question, activeSessionId, topK, model, embeddingModel, formatModelMissingMessage])

  const handleChunkByWordsChange = (words) => {
    setChunkByWords(words)
    if (words) {
      setChunkSize(100)
      setChunkOverlap(20)
    } else {
      setChunkSize(512)
      setChunkOverlap(100)
    }
  }

  const displayStatus =
    statusMessage ||
    (ingestInProgress && ingestSessionRef.current === activeSessionId
      ? 'Ingesting in background...'
      : summaryBySession.current[activeSessionId] || '')

  const ingestBusy = ingestInProgress && ingestSessionRef.current === activeSessionId

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
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onNewChat={handleNewChat}
          onRequestDeleteSession={handleRequestDeleteSession}
          onRenameSession={handleRenameSession}
        />
      </aside>

      <div className="app-center">
        <header className="app-header-wrap">
          <Header />
        </header>
        <main className="app-main">
          <DocumentsPanel
            compact
            files={uploadedFiles}
            sessionId={activeSessionId}
            ingestBusy={ingestBusy}
            onDeleteDocument={handleDeleteDocument}
          />
          {askError && (
            <div className="alert alert-error" role="alert">
              {askError}
            </div>
          )}
          <div className="app-conversation">
            <ChatHistory turns={chatHistory} pendingQuestion={pendingQuestion} />
          </div>
        </main>
        <div className="query-bar-wrap">
          <QueryBar
            optionsSlot={optionsSlot}
            statusMessage={displayStatus}
            question={question}
            onQuestionChange={setQuestion}
            onAsk={handleAsk}
            ingestInProgress={ingestBusy}
            runIngest={runIngest}
          />
        </div>
      </div>
    </div>
  )
}
