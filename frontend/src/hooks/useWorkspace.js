import { useState, useRef, useCallback, useEffect } from 'react'
import { clearSession, deleteDocument } from '../api'
import {
  loadWorkspaceState,
  saveWorkspaceState,
  generateSessionId,
  nextChatTitle,
} from '../workspaceStorage.js'
import { AUTO_CHAT_TITLE_RE } from '../constants.js'

export function useWorkspace() {
  const initial = loadWorkspaceState()
  const [sessions, setSessions] = useState(initial.sessions)
  const [activeSessionId, setActiveSessionId] = useState(initial.activeSessionId)
  const [dataBySession, setDataBySession] = useState(initial.dataBySession)

  const [question, setQuestion] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [askError, setAskError] = useState(null)

  const fingerprintBySession = useRef({})
  const summaryBySession = useRef({})
  const ingestPromiseRef = useRef(null)
  const ingestSessionRef = useRef(null)
  const activeSessionIdRef = useRef(activeSessionId)
  activeSessionIdRef.current = activeSessionId

  useEffect(() => {
    saveWorkspaceState({ sessions, activeSessionId, dataBySession })
  }, [sessions, activeSessionId, dataBySession])

  const chatHistory = dataBySession[activeSessionId]?.turns ?? []
  const uploadedFiles = dataBySession[activeSessionId]?.uploadedFiles ?? []

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

  return {
    sessions,
    activeSessionId,
    dataBySession,
    setDataBySession,
    chatHistory,
    uploadedFiles,
    question,
    setQuestion,
    statusMessage,
    setStatusMessage,
    pendingQuestion,
    setPendingQuestion,
    askError,
    setAskError,
    fingerprintBySession,
    summaryBySession,
    ingestPromiseRef,
    ingestSessionRef,
    activeSessionIdRef,
    selectSession,
    handleNewChat,
    handleRequestDeleteSession,
    handleRenameSession,
    handleDeleteDocument,
  }
}
