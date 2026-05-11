import { useState, useCallback } from 'react'
import { ingestFiles } from '../api'
import { formatModelMissingMessage } from '../utils/formatModelMessage.js'

export function useRagIngest({
  activeSessionId,
  activeSessionIdRef,
  fingerprintBySession,
  summaryBySession,
  ingestSessionRef,
  ingestPromiseRef,
  setDataBySession,
  chunkSize,
  chunkOverlap,
  chunkByWords,
  embeddingModel,
  setStatusMessage,
  setAskError,
}) {
  const [ingestInProgress, setIngestInProgress] = useState(false)

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
    [
      activeSessionId,
      chunkSize,
      chunkOverlap,
      chunkByWords,
      embeddingModel,
      ingestInProgress,
      activeSessionIdRef,
      fingerprintBySession,
      summaryBySession,
      ingestSessionRef,
      ingestPromiseRef,
      setDataBySession,
      setStatusMessage,
      setAskError,
    ]
  )

  const ingestBusy = ingestInProgress && ingestSessionRef.current === activeSessionId

  return { runIngest, ingestInProgress, ingestBusy }
}
