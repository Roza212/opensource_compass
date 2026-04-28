import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, GitBranch, Loader2, Network, Home } from 'lucide-react';
import mermaid from 'mermaid';
import { fetchDiagram, sendChatMessage } from '../api/client';

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#8b5cf6',
    primaryTextColor: '#f1f5f9',
    primaryBorderColor: '#6d28d9',
    lineColor: '#3b82f6',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    background: '#0f172a',
    mainBkg: '#1e293b',
    nodeBorder: '#6d28d9',
    clusterBkg: '#1e293b',
    titleColor: '#f1f5f9',
    edgeLabelBackground: '#1e293b',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
  securityLevel: 'loose',
});

export default function DashboardView({ repoName, onReset }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Welcome! I've analyzed **${repoName}**. Ask me anything about its architecture, code patterns, or how specific modules work.` },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');
  const [loadingDiagram, setLoadingDiagram] = useState(true);
  const [diagramError, setDiagramError] = useState('');
  const messagesEndRef = useRef(null);
  const mermaidRef = useRef(null);

  // Auto-scroll to the bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch Mermaid diagram on mount
  useEffect(() => {
    const getDiagram = async () => {
      try {
        const text = await fetchDiagram(repoName);
        setMermaidCode(text);
      } catch (err) {
        console.error('Failed to fetch diagram:', err);
        setDiagramError('Failed to fetch diagram.');
      } finally {
        setLoadingDiagram(false);
      }
    };
    getDiagram();
  }, [repoName]);

  // Render mermaid diagram when code is available
  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidCode || !mermaidRef.current) return;

      try {
        mermaidRef.current.innerHTML = '';
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        mermaidRef.current.innerHTML = svg;
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `<pre style="padding:2rem;font-size:0.75rem;color:#94a3b8;white-space:pre-wrap;">${mermaidCode}</pre>`;
        }
      }
    };
    renderDiagram();
  }, [mermaidCode]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setSending(true);

    try {
      const data = await sendChatMessage(repoName, userMsg);
      setMessages((prev) => [...prev, { role: 'ai', text: data.answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', text: `⚠️ Error: ${err.message}` }]);
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
        <div className="canvas-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2>
              <Network size={20} className="icon" />
              System Architecture
            </h2>
            <span className="repo-badge">
              <GitBranch size={14} />
              {repoName}
            </span>
          </div>
          <button 
            onClick={onReset}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.8rem', borderRadius: '6px',
              backgroundColor: '#1e293b', color: '#f1f5f9',
              border: '1px solid #334155', cursor: 'pointer',
              fontSize: '0.875rem', transition: 'background-color 0.2s',
              fontWeight: 500
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#334155'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
          >
            <Home size={16} />
            New Repository
          </button>
        </div>

        <div className="canvas-body">
          {loadingDiagram ? (
            <div className="canvas-placeholder">
              <Loader2 size={48} className="spinner" style={{ color: '#334155' }} />
              <p style={{ marginTop: '1rem' }}>Loading architecture diagram...</p>
            </div>
          ) : mermaidCode ? (
            <div
              ref={mermaidRef}
              style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                padding: '1rem',
                zIndex: 1,
                position: 'relative',
              }}
            />
          ) : (
            <div className="canvas-placeholder">
              <Network size={64} className="icon" />
              <p>{diagramError || 'No architecture data available for this repository.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
