const STORAGE_KEY = 'rag-qa-workspaces-v1'

export function generateSessionId() {
  return crypto.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function nextChatTitle(sessions) {
  let max = 0
  for (const s of sessions) {
    const m = /^Chat (\d+)$/.exec((s.title || '').trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `Chat ${max + 1}`
}

function defaultWorkspace() {
  const id = generateSessionId()
  return {
    sessions: [{ id, title: 'Chat 1' }],
    activeSessionId: id,
    dataBySession: {
      [id]: { turns: [], uploadedFiles: [] },
    },
  }
}

export function loadWorkspaceState() {
  if (typeof localStorage === 'undefined') {
    return defaultWorkspace()
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultWorkspace()
    const p = JSON.parse(raw)
    if (!Array.isArray(p.sessions) || p.sessions.length === 0) {
      return defaultWorkspace()
    }
    const active =
      p.sessions.some((s) => s.id === p.activeSessionId) ? p.activeSessionId : p.sessions[0].id
    const dataBySession = { ...(p.dataBySession || {}) }
    for (const s of p.sessions) {
      if (!dataBySession[s.id]) {
        dataBySession[s.id] = { turns: [], uploadedFiles: [] }
      }
    }
    return {
      sessions: p.sessions.map((s) => ({
        id: s.id,
        title: s.title || 'Chat',
      })),
      activeSessionId: active,
      dataBySession,
    }
  } catch {
    return defaultWorkspace()
  }
}

export function saveWorkspaceState(state) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}
