import { useState, useRef, useCallback } from 'react'
import { fetchDocumentPreview, getDocumentFileUrl } from '../api'

export default function DocumentsPanel({
  files = [],
  sessionId,
  ingestBusy,
  compact = true,
  onDeleteDocument,
}) {
  const [tip, setTip] = useState(null)
  const hideT = useRef(null)
  const loadingRef = useRef(null)

  const clearTipSoon = useCallback(() => {
    clearTimeout(hideT.current)
    hideT.current = setTimeout(() => setTip(null), 180)
  }, [])

  const onDocEnter = useCallback(
    async (name, e) => {
      clearTimeout(hideT.current)
      if (!sessionId) return
      const x = e.clientX + 12
      const y = e.clientY + 12
      setTip({ name, preview: '', loading: true, x, y })
      loadingRef.current = name
      try {
        const data = await fetchDocumentPreview(sessionId, name)
        if (loadingRef.current !== name) return
        setTip({
          name: data.name,
          preview: data.preview || '',
          loading: false,
          kind: data.kind,
          x,
          y,
        })
      } catch (err) {
        if (loadingRef.current !== name) return
        setTip({
          name,
          preview: err.message || 'Preview failed',
          loading: false,
          kind: 'error',
          x,
          y,
        })
      }
    },
    [sessionId]
  )

  const onDocMove = useCallback((e) => {
    setTip((t) =>
      t
        ? {
            ...t,
            x: e.clientX + 12,
            y: e.clientY + 12,
          }
        : null
    )
  }, [])

  const openFile = (name) => {
    if (!sessionId) return
    window.open(getDocumentFileUrl(sessionId, name), '_blank', 'noopener,noreferrer')
  }

  if (!compact) return null

  return (
    <>
      <div className="documents-compact" aria-label="Documents in context">
        <span className="documents-compact-label">Documents</span>
        {ingestBusy ? <span className="documents-compact-busy">Indexing…</span> : null}
        {files.length === 0 ? (
          <span className="documents-compact-empty">None — use + to upload</span>
        ) : (
          <span className="documents-compact-names">
            {files.map((name, i) => (
              <span key={name}>
                {i > 0 ? <span className="documents-compact-sep"> · </span> : null}
                <button
                  type="button"
                  className="documents-compact-link"
                  onMouseEnter={(e) => onDocEnter(name, e)}
                  onMouseMove={onDocMove}
                  onMouseLeave={() => {
                    loadingRef.current = null
                    clearTipSoon()
                  }}
                  onClick={() => openFile(name)}
                >
                  {name}
                </button>
                <button
                  type="button"
                  className="documents-compact-delete"
                  aria-label={`Delete ${name} from context`}
                  title={`Delete ${name} from context`}
                  onClick={() => onDeleteDocument?.(name)}
                >
                  ×
                </button>
              </span>
            ))}
          </span>
        )}
      </div>
      {tip ? (
        <div
          className="doc-preview-popover"
          style={{ left: tip.x, top: tip.y }}
          onMouseEnter={() => clearTimeout(hideT.current)}
          onMouseLeave={clearTipSoon}
        >
          <div className="doc-preview-popover-title">{tip.name}</div>
          {tip.loading ? (
            <div className="doc-preview-popover-body muted">Loading preview…</div>
          ) : (
            <pre className="doc-preview-popover-body">{tip.preview}</pre>
          )}
          <div className="doc-preview-popover-hint">Click name to open</div>
        </div>
      ) : null}
    </>
  )
}
