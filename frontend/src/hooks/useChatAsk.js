import { useCallback } from 'react'
import { query } from '../api'
import { MODELS } from '../constants.js'
import { formatModelMissingMessage } from '../utils/formatModelMessage.js'

export function useChatAsk({
  question,
  setQuestion,
  setPendingQuestion,
  setAskError,
  setStatusMessage,
  activeSessionId,
  ingestPromiseRef,
  summaryBySession,
  setDataBySession,
  topK,
  model,
  embeddingModel,
}) {
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
  }, [
    question,
    activeSessionId,
    topK,
    model,
    embeddingModel,
    setQuestion,
    setPendingQuestion,
    setAskError,
    setStatusMessage,
    ingestPromiseRef,
    summaryBySession,
    setDataBySession,
  ])

  return { handleAsk }
}
