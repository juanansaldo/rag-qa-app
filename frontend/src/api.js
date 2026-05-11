const getApiBase = () => import.meta.env.VITE_API_URL ?? ''

const headers = (sessionId) => ({ 'X-Session-ID': sessionId })

export async function ingestFiles(
  sessionId,
  files,
  { chunkSize, chunkOverlap, chunkByWords, embeddingModel }
) {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  form.append('chunk_size', String(chunkSize))
  form.append('chunk_overlap', String(chunkOverlap))
  form.append('chunk_by_words', chunkByWords ? 'true' : 'false')
  if (embeddingModel) form.append('embedding_model', embeddingModel)

  const res = await fetch(`${getApiBase()}/api/ingest/files`, {
    method: 'POST',
    headers: headers(sessionId),
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e) => e.msg || String(e)).join('; ')
          : `Ingest failed: ${res.status}`
    throw new Error(msg)
  }
  return data
}

export async function query(sessionId, { question, topK, model, embeddingModel }) {
  const res = await fetch(`${getApiBase()}/api/query`, {
    method: 'POST',
    headers: { ...headers(sessionId), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      top_k: topK,
      model: model || undefined,
      embedding_model: embeddingModel || undefined,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.error || `Request failed: ${res.status}`)
  return data
}

export async function clearSession(sessionId) {
  await fetch(`${getApiBase()}/api/session`, {
    method: 'DELETE',
    headers: headers(sessionId),
  })
}

export async function deleteDocument(sessionId, filename) {
  const q = new URLSearchParams({ name: filename }).toString()
  const res = await fetch(`${getApiBase()}/api/document?${q}`, {
    method: 'DELETE',
    headers: headers(sessionId),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.error || `Delete failed: ${res.status}`)
  return data
}

export async function listModels() {
  const res = await fetch(`${getApiBase()}/api/models`)
  if (!res.ok) throw new Error(`Models request failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.models) ? data.models : []
}

export function getDocumentFileUrl(sessionId, filename) {
  const q = new URLSearchParams({ name: filename, session_id: sessionId }).toString()
  return `${getApiBase()}/api/document/file?${q}`
}

export async function fetchDocumentPreview(sessionId, filename) {
  const q = new URLSearchParams({ name: filename }).toString()
  const res = await fetch(`${getApiBase()}/api/document/preview?${q}`, {
    headers: headers(sessionId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Preview failed: ${res.status}`)
  }
  return res.json()
}
