/** Human-readable hint when Ollama reports a missing model name. */
export function formatModelMissingMessage(raw, fallbackModel) {
  const text = String(raw || '')
  const match = text.match(/model\s+['"]?([^'"]+)['"]?\s+not found/i)
  const missing = match?.[1] || fallbackModel
  if (!missing) return text
  return `Model "${missing}" is not installed locally. Run: ollama pull ${missing}`
}
