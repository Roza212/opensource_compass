import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, GitBranch, Loader2, Network } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function DashboardView({ repoName }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Welcome! I've analyzed **${repoName}**. Ask me anything about its architecture, code patterns, or how specific modules work.` },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');
  const [loadingDiagram, setLoadingDiagram] = useState(true);
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch Mermaid diagram on mount
  useEffect(() => {
    const fetchDiagram = async () => {
      try {
        const res = await fetch(`${API_BASE}/diagram/${repoName}?raw=true`);
        if (res.ok) {
          const text = await res.text();
          setMermaidCode(text);
        }
      } catch (err) {
        console.error('Failed to fetch diagram:', err);
      } finally {
        setLoadingDiagram(false);
      }
    };
    fetchDiagram();
  }, [repoName]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repoName, question: userMsg }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'ai', text: data.answer }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: `⚠️ Error: ${data.detail}` }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', text: `⚠️ Network error: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="dashboard">
      {/* Left Panel: Mentor Chat */}
      <div className="chat-panel">
        <div className="chat-header">
          <MessageSquare size={20} className="icon" />
          <h2>AI Mentor Chat</h2>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.text}
            </div>
          ))}
          {sending && (
            <div className="message ai" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 size={16} className="spinner" />
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            type="text"
            placeholder="Ask about this codebase..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button className="send-btn" onClick={handleSend} disabled={sending || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Right Panel: The Canvas */}
      <div className="canvas-panel">
        <div className="canvas-header">
          <h2>
            <Network size={20} className="icon" />
            System Architecture
          </h2>
          <span className="repo-badge">
            <GitBranch size={14} />
            {repoName}
          </span>
        </div>

        <div className="canvas-body">
          {loadingDiagram ? (
            <div className="canvas-placeholder">
              <Loader2 size={48} className="spinner" style={{ color: '#334155' }} />
              <p style={{ marginTop: '1rem' }}>Loading architecture diagram...</p>
            </div>
          ) : mermaidCode ? (
            <pre style={{
              padding: '2rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
              overflow: 'auto',
              maxHeight: '100%',
              width: '100%',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              zIndex: 1,
            }}>
              {mermaidCode}
            </pre>
          ) : (
            <div className="canvas-placeholder">
              <Network size={64} className="icon" />
              <p>Architecture diagram will render here.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Mermaid.js integration coming soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
