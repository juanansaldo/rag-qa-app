import { useState, useEffect } from 'react'

export default function SessionBar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRequestDeleteSession,
  onRenameSession,
  layout = 'horizontal',
}) {
  const sidebar = layout === 'sidebar'
  const [openMenuId, setOpenMenuId] = useState(null)

  useEffect(() => {
    if (!openMenuId) return
    const onDown = (e) => {
      if (e.target.closest?.('.session-tab-dropdown')) return
      if (e.target.closest?.('.session-tab-kebab')) return
      setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openMenuId])

  return (
    <div
      className={`session-bar ${sidebar ? 'session-bar--sidebar' : ''}`}
      role="tablist"
      aria-label="Chats"
    >
      <div className="session-bar-scroll">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-tab-shell ${s.id === activeSessionId ? 'session-tab-shell-active' : ''}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={s.id === activeSessionId}
              className="session-tab session-tab-main"
              onClick={() => onSelectSession(s.id)}
            >
              <span className="session-tab-label">{s.title}</span>
            </button>
            <button
              type="button"
              className={`session-tab-kebab ${openMenuId === s.id ? 'session-tab-kebab-open' : ''}`}
              aria-label={`More actions for ${s.title}`}
              aria-expanded={openMenuId === s.id}
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenuId((id) => (id === s.id ? null : s.id))
              }}
            >
              <span className="session-tab-kebab-icon" aria-hidden>
                ⋮
              </span>
            </button>
            {openMenuId === s.id ? (
              <div
                className="session-tab-dropdown"
                role="menu"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="session-tab-dropdown-item"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(null)
                    onRenameSession(s.id)
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="session-tab-dropdown-item session-tab-dropdown-item-danger"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(null)
                    onRequestDeleteSession(s.id)
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
        <button type="button" className="session-tab session-tab-new" onClick={onNewChat}>
          + New chat
        </button>
      </div>
    </div>
  )
}
