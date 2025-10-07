
export default function Sidebar({ history, activeSessionId, onNew, onOpen, onDelete }) {
    return (
        <aside className="sidebar">
        <div className="brand">
            <div className="title">Gemini-like Chat</div>
            <div className="subtitle">Ollama + Llama 3</div>
        </div>
        <div className="row">
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Sessions</div>
            <button className="btn primary" onClick={onNew}>New</button>
        </div>
        <div className="session-list">
            {history.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '8px 12px' }}>
                No sessions yet. Start a new chat.
            </div>
            )}
            {history.map(s => (
            <div
                key={s.id}
                className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
            >
                <div className="title" onClick={() => onOpen(s.id)}>{s.title}</div>
                <button className="btn danger" onClick={() => onDelete(s.id)}>Delete</button>
            </div>
            ))}
        </div>
        <div className="sidebar-footer">Powered by Ollama + Llama 3</div>
        </aside>
    );
}