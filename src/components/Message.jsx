// Message.jsx - Updated with refusal styling
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import React from 'react';

export default function Message({ m, showDivider = false }) {
    const isUser = m.role === 'user';
    const avatar = isUser ? '👤' : '🤖';

    // Detect if this is a refusal message
    const isRefusal = !isUser && (
        m.content?.includes('I can only assist with Swiss German University') ||
        m.content?.includes('I can only accept information from official SGU sources')
    );

    const html = React.useMemo(() => {
        const raw = marked.parse(m.content || '');
        return { __html: DOMPurify.sanitize(raw) };
    }, [m.content]);

    return (
        <div className={`${isUser ? 'items-end' : 'items-start'} my-3`} style={{ display: "flex" }}>
        {/* Bubble */}
        <div
            className={isUser ? 'bg-[#233044]' : isRefusal ? 'bg-[#3d1a1a]' : 'bg-[#0b1118]'}
            style={isRefusal ? { borderLeft: '3px solid #ff6b6b', paddingLeft: '8px' } : {}}
        >
            {isUser && (<div>{avatar}</div>)}
            {!isUser && (<div>{avatar}</div>)}
            <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={html} />
            {m.streaming && (<span>▊</span>)}
            {isUser && (<hr />)}
            {!isUser && (<hr />)}
        </div>
        </div>
    );
}