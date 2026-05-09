import { useRef } from 'react'

export default function QueryBar({
  statusMessage,
  question,
  onQuestionChange,
  onAsk,
  ingestInProgress,
  runIngest,
  optionsSlot,
}) {
  const fileInputRef = useRef(null)
  const canSubmit = Boolean(question?.trim())

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onAsk()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmit) onAsk()
    }
  }

  const handleFileChange = () => {
    const input = fileInputRef.current
    if (!input?.files?.length || !runIngest) return
    runIngest(Array.from(input.files))
    input.value = ''
  }

  const triggerFileInput = () => fileInputRef.current?.click()

  return (
    <div className="query-bar">
      <div className="query-main">
        <form onSubmit={handleSubmit}>
          <div className="query-row">
            <textarea
              className="query-input"
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Ask a question"
              rows={4}
            />
            <div className="query-actions">
              {optionsSlot ? <div className="query-options-slot">{optionsSlot}</div> : null}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.html,.csv,.docx"
                aria-label="Upload documents"
                onChange={handleFileChange}
                className="query-file-input"
              />
              <button
                type="button"
                className="btn btn-add"
                onClick={triggerFileInput}
                title="Upload documents"
                aria-label="Upload documents"
              >
                +
              </button>
              <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                Ask
              </button>
            </div>
          </div>
        </form>
        <div
          className={`query-status ${statusMessage === 'Ingesting in background...' ? 'loading' : ''}`}
        >
          {statusMessage || '\u00A0'}
        </div>
      </div>
    </div>
  )
}
