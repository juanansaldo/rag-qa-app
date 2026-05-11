import { useCallback, useEffect, useRef, useState } from 'react'
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
  activeSessionIdRef,
  ingestPromiseRef,
  summaryBySession,
  setDataBySession,
  topK,
  model,
  embeddingModel,
}) {
  const queueRef = useRef([])
  const pipelineBusyRef = useRef(false)
  const cancelPipelineRef = useRef(false)

  const modelRef = useRef(model)
  const embeddingModelRef = useRef(embeddingModel)
  const topKRef = useRef(topK)
  modelRef.current = model
  embeddingModelRef.current = embeddingModel
  topKRef.current = topK

  const [queuedCount, setQueuedCount] = useState(0)

  useEffect(() => {
    queueRef.current = []
    setQueuedCount(0)
    cancelPipelineRef.current = true
  }, [activeSessionId])

  const executeOne = useCallback(
    async (q, sid) => {
      setAskError(null)
      try {
        if (ingestPromiseRef.current) {
          await ingestPromiseRef.current
          setStatusMessage(summaryBySession.current[sid] || '')
        }
        const data = await query(sid, {
          question: q,
          topK: topKRef.current,
          model: MODELS.includes(modelRef.current) ? modelRef.current : undefined,
          embeddingModel: embeddingModelRef.current,
        })

        if (data.error) {
          const msg = String(data.error)
          setAskError(/not found/i.test(msg) ? formatModelMissingMessage(msg, modelRef.current) : msg)
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
        setStatusMessage(summaryBySession.current[sid] || '')
      } catch (err) {
        const msg = err.message ?? 'Request failed'
        setAskError(/not found/i.test(msg) ? formatModelMissingMessage(msg, modelRef.current) : msg)
        setStatusMessage('')
      }
    },
    [ingestPromiseRef, setAskError, setStatusMessage, summaryBySession, setDataBySession]
  )

  const processPipeline = useCallback(
    async (firstText) => {
      if (pipelineBusyRef.current) return
      pipelineBusyRef.current = true
      cancelPipelineRef.current = false

      let nextItem = {
        sessionId: activeSessionIdRef.current,
        text: firstText,
      }

      try {
        while (nextItem && !cancelPipelineRef.current) {
          const { sessionId: sid, text } = nextItem
          setQueuedCount(queueRef.current.length)
          setPendingQuestion(text)

          await executeOne(text, sid)

          if (cancelPipelineRef.current) break

          nextItem = queueRef.current.shift() ?? null
          setQueuedCount(queueRef.current.length)
        }
      } finally {
        setPendingQuestion('')
        pipelineBusyRef.current = false
        setQueuedCount(0)
      }
    },
    [activeSessionIdRef, executeOne, setPendingQuestion]
  )

  const handleAsk = useCallback(() => {
    const q = question.trim()
    if (!q) return

    setQuestion('')
    setAskError(null)

    const item = {
      sessionId: activeSessionIdRef.current,
      text: q,
    }

    if (pipelineBusyRef.current) {
      queueRef.current.push(item)
      setQueuedCount(queueRef.current.length)
      return
    }

    void processPipeline(q)
  }, [question, setQuestion, setAskError, processPipeline, activeSessionIdRef])

  return { handleAsk, queuedCount }
}
