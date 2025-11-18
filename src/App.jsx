import Composer from './components/Composer';
import Controls from './components/Controls';
import Message from './components/Message';
import Sidebar from './components/Sidebar';
import useChat from './hooks/useChat';
import './styles.css';

export default function App() {
  const chat = useChat();

  return (
    <div className="app">
      <Sidebar
        history={chat.history}
        activeSessionId={chat.activeSessionId}
        onNew={chat.newSession}
        onOpen={chat.openSession}
        onDelete={chat.deleteSession}
      />
      <div className="main">
        <header className="header">
          <div className="container inner">
            <div className="name">Ollama-based Chatbot</div>
            <div className="status">{chat.loading ? 'Responding…' : 'Idle'}</div>
          </div>
        </header>

        <div className="controls">
          <div className="container inner">
            <Controls
              systemPrompt={chat.systemPrompt}
              setSystemPrompt={chat.setSystemPrompt}
              temperature={chat.temperature}
              setTemperature={chat.setTemperature}
              model={chat.model}
              setModel={chat.setModel}
            />
          </div>
        </div>

        {chat.error && <div className="error">{chat.error}</div>}

        <main className="feed">
          <div className="feed-inner">
            <div className="feed-scroll">
              {chat.messages.length === 0 ? (
                <div className="empty">
                  <div className="h1">Hello!</div>
                  <div>Start a conversation powered by Llama 3 via Ollama.</div>
                </div>
              ) : (
                <>
                  {chat.messages.map((m, i) => {
                    const prev = chat.messages[i - 1];
                    const showDivider = m.role === 'assistant' && prev?.role === 'user';
                    return <Message key={i} m={m} showDivider={showDivider} />;
                  })}
                </>
              )}
            </div>
          </div>
        </main>
        <Composer onSend={chat.sendMessage} disabled={chat.loading} />
      </div>
    </div>
  );
}