/** Chat LLM allowlist for filtering Ollama list response */
export const MODELS = ['mistral', 'llama3.2', 'llama3.1', 'phi3', 'gemma2']

/** Embedding model allowlist */
export const EMBEDDING_MODELS = ['nomic-embed-text', 'mxbai-embed-large', 'snowflake-arctic-embed']

/** Matches default chat titles like "Chat 1" for normalization */
export const AUTO_CHAT_TITLE_RE = /^Chat \d+$/
