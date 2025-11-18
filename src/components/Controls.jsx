export default function Controls({ systemPrompt, setSystemPrompt, temperature, setTemperature, model, setModel }) {
    return (
        <div className="controls">
        <div className="control">
            <label style={{ color: 'var(--text-dim)', fontSize: 13 }}>Model</label>
            <select className="select" value={model} onChange={e => setModel(e.target.value)}>
            <option value="gpt-oss:120b-cloud">gpt-oss</option>
            <option value="qwen3-vl:235b-cloud">qwen3-vl</option>
            <option value="qwen3-coder:480b-cloud">qwen3-coder</option>
            <option value="glm-4.6:cloud">glm-4.6</option>
            <option value="deepseek-v3.1:671b-cloud">deepseek-v3.1</option>
            <option value="minimax-m2:cloud">minimax-m2</option>
            <option value="kimi-k2:1t-cloud">kimi-k2</option>
            <option value="kimi-k2-thinking:cloud">kimi-k2-thinking</option>
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
            <span style={{ width: 40, textAlign: 'right', color: 'var(--text)' }}>
            {temperature.toFixed(2)}
            </span>
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