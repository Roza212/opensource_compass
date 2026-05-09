import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, GitBranch, Loader2, Network, Home, Activity, AlertTriangle } from 'lucide-react';
import { sendChatMessage, fetchHealthReport, generateTour, fetchSessionMessages } from '../api/client';
import TreeDiagram from '../components/TreeDiagram';


export default function DashboardView({ repoName, onReset }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Welcome! I've analyzed **${repoName}**. Ask me anything about its architecture, code patterns, or how specific modules work.` },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  
  const [activeTab, setActiveTab] = useState('diagram');
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState('');
  
  const [showTourPanel, setShowTourPanel] = useState(true);
  const [tourSteps, setTourSteps] = useState(null);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [loadingTour, setLoadingTour] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(`compass_session_${repoName}`) || null);
  
  const messagesEndRef = useRef(null);

  // Load chat history from localStorage on mount/repo change
  useEffect(() => {
    const savedSession = localStorage.getItem(`compass_session_${repoName}`);
    setSessionId(savedSession || null);
    
    if (savedSession) {
      const getHistory = async () => {
        try {
          const history = await fetchSessionMessages(savedSession);
          if (history && history.length > 0) {
            setMessages([
              { role: 'ai', text: `Welcome back to the ${repoName} codebase!` },
              ...history
            ]);
            setShowTourPanel(false); // Hide tour if returning user
          }
        } catch (e) {
          console.error("Failed to fetch session history:", e);
        }
      };
      getHistory();
    } else {
      setMessages([{ role: 'ai', text: `Welcome to the ${repoName} codebase! I'm your AI Mentor. Ask me anything.` }]);
      setShowTourPanel(true);
    }
  }, [repoName]);

  // Auto-scroll to the bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch Health Report
  useEffect(() => {
    if (activeTab === 'health' && !healthData && !loadingHealth) {
      const getHealth = async () => {
        setLoadingHealth(true);
        try {
          const data = await fetchHealthReport(repoName);
          setHealthData(data);
        } catch (err) {
          console.error(err);
          setHealthError('Failed to load health report.');
        } finally {
          setLoadingHealth(false);
        }
      };
      getHealth();
    }
  }, [activeTab, repoName, healthData, loadingHealth]);

  // Health Report effect remains unchanged...

  const handleSourceClick = (src) => {
    // Porting source highlight to D3 Tree is a future enhancement
    console.log("Exploring file:", src);
  };


  const handleSend = async (manualMsg = null) => {
    const userMsg = manualMsg || input.trim();
    if (!userMsg || sending) return;

    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    if (!manualMsg) setInput('');
    setSending(true);

    try {
      const data = await sendChatMessage(repoName, userMsg, sessionId);
      setMessages((prev) => [...prev, { role: 'ai', text: data.answer, sources: data.sources }]);
      
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem(`compass_session_${repoName}`, data.session_id);
      }
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
        <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={20} className="icon" />
            <h2>AI Mentor Chat</h2>
          </div>
          {sessionId && (
            <button 
              onClick={() => {
                localStorage.removeItem(`compass_session_${repoName}`);
                setSessionId(null);
                setMessages([{ role: 'ai', text: `Welcome to the ${repoName} codebase! I'm your AI Mentor.` }]);
                setShowTourPanel(true);
              }}
              style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.borderColor = '#475569'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
            >
              New Chat
            </button>
          )}
        </div>

        <div className="chat-messages">
          {showTourPanel && !tourSteps && (
            <div style={{ padding: '1.5rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', marginBottom: '1rem', textAlign: 'center' }}>
              <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>Welcome to the codebase!</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Would you like a guided tour of the most critical files?</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                  onClick={async () => {
                    setLoadingTour(true);
                    try {
                      const steps = await generateTour(repoName);
                      setTourSteps(steps);
                      setCurrentTourStep(0);
                    } catch (e) {
                      setMessages(prev => [...prev, {role: 'ai', text: `Failed to load tour: ${e.message}`}]);
                      setShowTourPanel(false);
                    } finally {
                      setLoadingTour(false);
                    }
                  }}
                  disabled={loadingTour}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {loadingTour ? <Loader2 size={16} className="spinner" /> : null}
                  Start Tour
                </button>
                <button 
                  onClick={() => setShowTourPanel(false)}
                  disabled={loadingTour}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #475569', cursor: 'pointer' }}
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {showTourPanel && tourSteps && tourSteps.length > 0 && (
            <div style={{ padding: '1.5rem', backgroundColor: '#1e293b', border: '1px solid #8b5cf6', borderRadius: '12px', marginBottom: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step {currentTourStep + 1} of {tourSteps.length}</span>
                <button onClick={() => setShowTourPanel(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Close</button>
              </div>
              <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem', fontSize: '1.1rem' }}>{tourSteps[currentTourStep].title}</h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: '1.5' }}>{tourSteps[currentTourStep].explanation}</p>
              <div style={{ backgroundColor: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', color: '#93c5fd', marginBottom: '1.5rem', border: '1px solid #334155' }}>
                {tourSteps[currentTourStep].key_file}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button 
                  onClick={() => setCurrentTourStep(p => Math.max(0, p - 1))}
                  disabled={currentTourStep === 0}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', backgroundColor: currentTourStep === 0 ? 'transparent' : '#334155', color: currentTourStep === 0 ? '#475569' : '#f1f5f9', border: 'none', cursor: currentTourStep === 0 ? 'default' : 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
                >
                  Previous
                </button>
                {currentTourStep < tourSteps.length - 1 ? (
                  <button 
                    onClick={() => setCurrentTourStep(p => Math.min(tourSteps.length - 1, p + 1))}
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
                  >
                    Next
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowTourPanel(false)}
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', backgroundColor: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
                  >
                    Finish Tour
                  </button>
                )}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.text}
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {msg.sources.map((src, idx) => (
                    <span 
                      key={idx} 
                      onClick={() => handleSourceClick(src)}
                      style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.2rem 0.5rem', 
                        backgroundColor: '#334155', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#93c5fd',
                        border: '1px solid #475569',
                        transition: 'border-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = '#93c5fd'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = '#475569'}
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setActiveTab('diagram')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.8rem', borderRadius: '6px',
                  backgroundColor: activeTab === 'diagram' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'diagram' ? '#ffffff' : '#94a3b8',
                  border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <Network size={16} /> Architecture
              </button>
              <button 
                onClick={() => setActiveTab('health')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.8rem', borderRadius: '6px',
                  backgroundColor: activeTab === 'health' ? '#8b5cf6' : 'transparent',
                  color: activeTab === 'health' ? '#ffffff' : '#94a3b8',
                  border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <Activity size={16} /> Health
              </button>
            </div>
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

        <div className="canvas-body" style={{ flex: 1, position: 'relative' }}>
          {activeTab === 'diagram' ? (
            <TreeDiagram repoName={repoName} onAskAI={handleSend} />
          ) : (
            // Health Tab
            <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
              {loadingHealth ? (
                <div className="canvas-placeholder">
                  <Loader2 size={48} className="spinner" style={{ color: '#334155' }} />
                  <p style={{ marginTop: '1rem' }}>Analyzing codebase health...</p>
                </div>
              ) : healthError ? (
                <div className="canvas-placeholder">
                  <AlertTriangle size={64} className="icon" style={{ color: '#f87171' }} />
                  <p>{healthError}</p>
                </div>
              ) : healthData ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', color: '#f1f5f9', marginBottom: '0.5rem' }}>Overall Score</h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Weighted average of complexity, comments, and dependencies.</p>
                    </div>
                    <div style={{ 
                      fontSize: '3rem', fontWeight: 'bold', 
                      color: healthData.overall_health > 70 ? '#4ade80' : healthData.overall_health > 40 ? '#fbbf24' : '#f87171' 
                    }}>
                      {healthData.overall_health}
                    </div>
                  </div>

                  {healthData.top_issues && healthData.top_issues.length > 0 && (
                    <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '1.1rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <AlertTriangle size={20} /> Critical Issues Found
                      </h3>
                      <ul style={{ listStylePosition: 'inside', color: '#fcd34d', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {healthData.top_issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155' }}>
                          <th style={{ padding: '1rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>File Path</th>
                          <th style={{ padding: '1rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>LOC</th>
                          <th style={{ padding: '1rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Complexity</th>
                          <th style={{ padding: '1rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Health</th>
                        </tr>
                      </thead>
                      <tbody>
                        {healthData.files.map((f, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #334155', transition: 'background-color 0.2s' }}>
                            <td style={{ padding: '1rem', color: '#f1f5f9', fontSize: '0.9rem', fontFamily: 'monospace' }}>{f.path}</td>
                            <td style={{ padding: '1rem', color: '#cbd5e1', fontSize: '0.9rem' }}>{f.loc}</td>
                            <td style={{ padding: '1rem', color: '#cbd5e1', fontSize: '0.9rem' }}>{f.complexity}</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                                backgroundColor: f.health > 70 ? 'rgba(74, 222, 128, 0.2)' : f.health > 40 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                                color: f.health > 70 ? '#4ade80' : f.health > 40 ? '#fbbf24' : '#f87171'
                              }}>
                                {f.health}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
