export default function ChatHistory({
  turns,
  pendingQuestion = '',
  emptyMessage = 'No messages yet. Upload documents and ask a question.',
}) {
  const hasPending = Boolean(pendingQuestion)

  if (!turns?.length && !hasPending) {
    return <p className="chat-empty">{emptyMessage}</p>
  }

  return (
    <div className="chat-history" aria-label="Messages">
      {turns.map((turn, i) => (
        <div key={i} className="chat-turn">
          <p className="chat-question">Q: {turn.question}</p>
          <div className="chat-answer">{turn.answer}</div>
          {turn.sources?.length > 0 && (
            <details className="chat-sources">
              <summary>Sources ({turn.sources.length})</summary>
              {turn.sources.map((src, j) => (
                <div key={j} className="chat-sources-detail">
                  <div className="source-meta">Source {j + 1}: {src?.metadata?.source ?? '-'}</div>
                  <div className="source-doc">{src?.document ?? ''}</div>
                </div>
              ))}
            </details>
          )}
        </div>
      ))}
      {hasPending ? (
        <div className="chat-turn chat-turn-pending" aria-live="polite">
          <p className="chat-question">Q: {pendingQuestion}</p>
          <div className="chat-answer chat-answer-pending">Getting answer...</div>
        </div>
      ) : null}
    </div>
  )
}
