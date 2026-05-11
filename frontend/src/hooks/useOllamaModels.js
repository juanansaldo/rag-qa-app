import { useState, useEffect } from 'react'
import { listModels } from '../api'
import { EMBEDDING_MODELS, MODELS } from '../constants'

/**
 * On mount, loads Ollama models and filters to known chat + embedding ids.
 * Adjusts selected model / embedding when defaults are unavailable (same behavior as before).
 */
export function useOllamaModels(model, embeddingModel, setModel, setEmbeddingModel) {
  const [availableModels, setAvailableModels] = useState([])
  const [availableEmbeddingModels, setAvailableEmbeddingModels] = useState([])

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
    // Intentionally mount-only: align with server once; avoid resetting user picks on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { availableModels, availableEmbeddingModels }
}
