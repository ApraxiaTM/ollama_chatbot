// Composer.jsx - Updated with SGU hint
import React from 'react';

export default function Composer({ onSend, disabled }) {
    const [text, setText] = React.useState('');

    const handleSend = () => {
        const t = text.trim();
        if (!t) return;
        onSend(t);
        setText('');
    };

    return (
        <div className="composer">
        <div className="composer-inner">
            <div className="textarea-wrap">
            <textarea
                className="textarea"
                placeholder="Ask about Swiss German University (SGU)..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
                }}
                disabled={disabled}
            />
            <button className="send-btn" onClick={handleSend} disabled={disabled}>
                Send
            </button>
            </div>
            <div className="help-hint">
            💡 I can only answer questions about Swiss German University (SGU) • Press Enter to send, Shift+Enter for newline
            </div>
        </div>
        </div>
    );
}