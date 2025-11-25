export default function Sidebar({ history, activeSessionId, onNew, onOpen, onDelete }) {
    // Provide safe defaults for all props
    const safeHistory = history || [];
    const safeActiveSessionId = activeSessionId || null;
    const safeOnNew = onNew || (() => console.log('New session'));
    const safeOnOpen = onOpen || (() => console.log('Open session'));
    const safeOnDelete = onDelete || (() => console.log('Delete session'));

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="title">Gemini-like Chat</div>
                <div className="subtitle">Ollama + Llama 3</div>
            </div>
            <div className="row">
                <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Sessions</div>
                <button className="btn primary" onClick={safeOnNew}>New</button>
            </div>
            <div className="session-list">
                {safeHistory.length === 0 && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '8px 12px' }}>
                        No sessions yet. Start a new chat.
                    </div>
                )}
                {safeHistory.map(s => (
                    <div
                        key={s.id}
                        className={`session-item ${safeActiveSessionId === s.id ? 'active' : ''}`}
                    >
                        <div className="title" onClick={() => safeOnOpen(s.id)}>
                            {s.title || 'Untitled Chat'}
                        </div>
                        <button className="btn danger" onClick={() => safeOnDelete(s.id)}>
                            Delete
                        </button>
                    </div>
                ))}
            </div>
            <div className="sidebar-footer">Powered by Ollama + Llama 3</div>
        </aside>
    );
}

// Add PropTypes for better development
Sidebar.defaultProps = {
    history: [],
    activeSessionId: null,
    onNew: () => {},
    onOpen: () => {},
    onDelete: () => {}
};