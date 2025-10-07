
export default function Controls({ systemPrompt, setSystemPrompt, temperature, setTemperature, model, setModel }) {
    return (
        <div className="controls">
        <div className="control">
            <label style={{ color: 'var(--text-dim)', fontSize: 13 }}>Model</label>
            <select className="select" value={model} onChange={e => setModel(e.target.value)}>
            <option value="llama3">llama3</option>
            <option value="llama3:8b">llama3:8b</option>
            <option value="llama3:70b">llama3:70b</option>
            <option value="llama3.1">llama3.1</option>
            </select>
        </div>
        <div className="control" style={{ minWidth: 220 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 13 }}>Temperature</label>
            <input
            className="range"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            />
            <span style={{ width: 40, textAlign: 'right', color: 'var(--text)' }}>{temperature.toFixed(2)}</span>
        </div>
        <div className="control" style={{ flex: 1 }}>
            <input
            className="input"
            placeholder="System prompt"
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            />
        </div>
        </div>
    );
}