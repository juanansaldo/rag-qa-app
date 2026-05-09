import { useState } from 'react'

export default function Options({
  compact = false,
  open,
  onToggle,
  chunkByWords,
  onChunkByWordsChange,
  chunkSize,
  onChunkSizeChange,
  chunkOverlap,
  onChunkOverlapChange,
  topK,
  onTopKChange,
  model,
  onModelChange,
  availableModels = [],
  embeddingModel,
  onEmbeddingModelChange,
  availableEmbeddingModels = [],
}) {
  const MODEL_INFO = {
    mistral: {
      note: 'Balanced quality/speed. Great default for local RAG.',
    },
    'llama3.2': {
      note: 'Fast and lightweight. Good instruction following for short answers.',
    },
    'llama3.1': {
      note: 'Usually stronger reasoning but heavier.',
    },
    phi3: {
      note: 'Very fast, lower-resource option.',
    },
    gemma2: {
      note: 'Strong quality; speed depends on quantization.',
    },
  }
  const EMBEDDING_INFO = {
    'nomic-embed-text': {
      note: 'Great default for local RAG. Fast and reliable retrieval quality.',
    },
    'mxbai-embed-large': {
      note: 'Higher retrieval quality, usually slower than nomic.',
    },
    'snowflake-arctic-embed': {
      note: 'Strong semantic matching; good alternative for long academic text.',
    },
  }

  const maxOverlap = Math.max(0, chunkSize - 1)
  const triggerText = compact ? (open ? '⚙' : '⚙') : open ? 'Options ▼' : 'Options ▶'
  const triggerTitle = compact ? 'Options' : undefined
  const [hoverModel, setHoverModel] = useState('')
  const [hoverEmbeddingModel, setHoverEmbeddingModel] = useState('')
  const modelChoices = availableModels.length > 0 ? availableModels : Object.keys(MODEL_INFO)
  const activeModel = hoverModel || model
  const activeInfo = MODEL_INFO[activeModel] || { note: '' }
  const embeddingChoices =
    availableEmbeddingModels.length > 0 ? availableEmbeddingModels : Object.keys(EMBEDDING_INFO)
  const activeEmbeddingModel = hoverEmbeddingModel || embeddingModel
  const activeEmbeddingInfo = EMBEDDING_INFO[activeEmbeddingModel] || { note: '' }

  return (
    <div className={`query-options-row ${compact ? 'query-options-row-compact' : ''}`}>
      <button
        type="button"
        className="options-trigger"
        onClick={onToggle}
        aria-expanded={open}
        title={triggerTitle}
      >
        {triggerText}
      </button>
      {open && (
        <div className="options-panel">
          <div className="options-row options-chunk-by-row">
            <label className="options-field-label">Chunk by</label>
            <div className="options-chunk-by" role="group" aria-label="Chunk by">
              <label className={`options-chunk-by-option ${!chunkByWords ? 'options-chunk-by-selected' : ''}`}>
                <input
                  type="radio"
                  name="chunkBy"
                  checked={!chunkByWords}
                  onChange={() => onChunkByWordsChange(false)}
                />
                Characters
              </label>
              <label className={`options-chunk-by-option ${chunkByWords ? 'options-chunk-by-selected' : ''}`}>
                <input
                  type="radio"
                  name="chunkBy"
                  checked={chunkByWords}
                  onChange={() => onChunkByWordsChange(true)}
                />
                Words
              </label>
            </div>
          </div>
          <div>
            <label>Chunk size</label>
            <input
              type="number"
              min={chunkByWords ? 10 : 64}
              max={chunkByWords ? 500 : 4096}
              value={chunkSize}
              onChange={(e) => onChunkSizeChange(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Chunk overlap</label>
            <input
              type="number"
              min={0}
              max={maxOverlap}
              value={chunkOverlap}
              onChange={(e) => onChunkOverlapChange(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Top K (results per query)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => onTopKChange(Number(e.target.value))}
            />
          </div>
          <div>
            <label>LLM model</label>
            <div
              className="model-hover-list"
              role="list"
              aria-label="Model descriptions"
              onMouseLeave={() => setHoverModel('')}
            >
              {modelChoices.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="listitem"
                  className={`model-hover-item ${m === model ? 'model-hover-item-active' : ''}`}
                  onMouseEnter={() => setHoverModel(m)}
                  onFocus={() => setHoverModel(m)}
                  onBlur={() => setHoverModel('')}
                  onClick={() => onModelChange(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="model-hover-info" aria-live="polite">
              <div className="model-hover-title">{activeModel}</div>
              <div className="model-hover-note">{activeInfo.note}</div>
            </div>
          </div>
          <div>
            <label>Embedding model</label>
            <div
              className="model-hover-list"
              role="list"
              aria-label="Embedding model descriptions"
              onMouseLeave={() => setHoverEmbeddingModel('')}
            >
              {embeddingChoices.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="listitem"
                  className={`model-hover-item ${m === embeddingModel ? 'model-hover-item-active' : ''}`}
                  onMouseEnter={() => setHoverEmbeddingModel(m)}
                  onFocus={() => setHoverEmbeddingModel(m)}
                  onBlur={() => setHoverEmbeddingModel('')}
                  onClick={() => onEmbeddingModelChange(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="model-hover-info" aria-live="polite">
              <div className="model-hover-title">{activeEmbeddingModel}</div>
              <div className="model-hover-note">{activeEmbeddingInfo.note}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
