import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, GitBranch, Loader2, Network, Home, Activity, AlertTriangle } from 'lucide-react';
import { sendChatMessage, fetchHealthReport, generateTour, fetchSessionMessages } from '../api/client';
import TreeDiagram from '../components/TreeDiagram';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

function FileRow({ file, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const { scores, issues, path, language } = file;

  const getScoreColor = (s) => s > 70 ? '#4ade80' : s > 40 ? '#fbbf24' : '#f87171';

  return (
    <>
      <tr 
        onClick={() => setExpanded(!expanded)}
        style={{ borderBottom: '1px solid var(--border-main)', cursor: 'pointer', transition: 'background-color 0.2s' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.3)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <td style={{ padding: '1rem', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {path.split('/').pop()}
          </div>
        </td>
        <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{language}</td>
        {['complexity', 'coupling', 'size', 'docs'].map(dim => (
          <td key={dim} style={{ padding: '1rem', textAlign: 'center' }}>
            <span style={{ 
              color: getScoreColor(scores[dim]), 
              fontWeight: 700, fontSize: '0.85rem' 
            }}>
              {scores[dim]}
            </span>
          </td>
        ))}
      </tr>
      {expanded && (
        <tr style={{ backgroundColor: 'var(--bg-main)' }}>
          <td colSpan="6" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-main)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h5 style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Issues & Suggestions</h5>
                {issues && issues.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {issues.map((issue, i) => (
                      <li key={i} style={{ color: 'var(--text-primary)', fontSize: '0.8rem', marginBottom: '0.3rem', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ color: '#f87171' }}>•</span> {issue}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--border-light)', fontSize: '0.8rem', italic: 'true' }}>No critical issues detected.</p>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onNavigate(); }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.4rem', 
                  backgroundColor: 'var(--border-main)', color: 'var(--text-primary)', border: 'none', 
                  padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.7rem', 
                  cursor: 'pointer', transition: 'background-color 0.2s' 
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--border-main)'}
              >
                <ExternalLink size={12} /> View in Tree
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
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
              style={{ background: 'none', border: '1px solid var(--border-main)', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-light)'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-main)'; }}
            >
              New Chat
            </button>
          )}
        </div>

        <div className="chat-messages">
          {showTourPanel && !tourSteps && (
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '12px', marginBottom: '1rem', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Welcome to the codebase!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Would you like a guided tour of the most critical files?</p>
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
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: 'var(--neon-purple)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {loadingTour ? <Loader2 size={16} className="spinner" /> : null}
                  Start Tour
                </button>
                <button 
                  onClick={() => setShowTourPanel(false)}
                  disabled={loadingTour}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {showTourPanel && tourSteps && tourSteps.length > 0 && (
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--neon-purple)', borderRadius: '12px', marginBottom: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--neon-purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step {currentTourStep + 1} of {tourSteps.length}</span>
                <button onClick={() => setShowTourPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Close</button>
              </div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>{tourSteps[currentTourStep].title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: '1.5' }}>{tourSteps[currentTourStep].explanation}</p>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.5rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', color: '#93c5fd', marginBottom: '1.5rem', border: '1px solid var(--border-main)' }}>
                {tourSteps[currentTourStep].key_file}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button 
                  onClick={() => setCurrentTourStep(p => Math.max(0, p - 1))}
                  disabled={currentTourStep === 0}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', backgroundColor: currentTourStep === 0 ? 'transparent' : 'var(--border-main)', color: currentTourStep === 0 ? 'var(--border-light)' : 'var(--text-primary)', border: 'none', cursor: currentTourStep === 0 ? 'default' : 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
                >
                  Previous
                </button>
                {currentTourStep < tourSteps.length - 1 ? (
                  <button 
                    onClick={() => setCurrentTourStep(p => Math.min(tourSteps.length - 1, p + 1))}
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', backgroundColor: 'var(--neon-purple)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
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
                        backgroundColor: 'var(--border-main)', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#93c5fd',
                        border: '1px solid var(--border-light)',
                        transition: 'border-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = '#93c5fd'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
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
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-main)', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setActiveTab('diagram')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.8rem', borderRadius: '6px',
                  backgroundColor: activeTab === 'diagram' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'diagram' ? '#ffffff' : 'var(--text-secondary)',
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
                  backgroundColor: activeTab === 'health' ? 'var(--neon-purple)' : 'transparent',
                  color: activeTab === 'health' ? '#ffffff' : 'var(--text-secondary)',
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
              backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
              border: '1px solid var(--border-main)', cursor: 'pointer',
              fontSize: '0.875rem', transition: 'background-color 0.2s',
              fontWeight: 500
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--border-main)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
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
            <div style={{ 
              padding: '2rem', 
              width: '100%', 
              height: '100%', 
              overflowY: 'auto', 
              backgroundColor: 'var(--dark-bg)',
              position: 'absolute',
              top: 0, left: 0
            }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {loadingHealth ? (
                  <div className="canvas-placeholder">
                    <Loader2 size={48} className="spinner" style={{ color: 'var(--border-main)' }} />
                    <p style={{ marginTop: '1rem' }}>Analyzing codebase health...</p>
                  </div>
                ) : healthError ? (
                  <div className="canvas-placeholder">
                    <AlertTriangle size={64} className="icon" style={{ color: '#f87171' }} />
                    <p>{healthError}</p>
                  </div>
                ) : healthData ? (
                  <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                      {Object.entries(healthData.summary || {}).map(([dim, score]) => (
                        <div key={dim} style={{ padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-main)' }}>
                          <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>{dim} Score</h4>
                          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: score > 70 ? '#4ade80' : score > 40 ? '#fbbf24' : '#f87171', marginBottom: '1rem' }}>
                            {score}
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${score}%`, height: '100%', 
                              backgroundColor: score > 70 ? '#4ade80' : score > 40 ? '#fbbf24' : '#f87171',
                              transition: 'width 1s ease-out'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Top Risks */}
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} color="#fbbf24" /> Top Risks
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
                      {(healthData.top_risks || []).map((risk, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setActiveTab('diagram');
                            setTimeout(() => {
                              if (window.navigateToNode) window.navigateToNode(risk.path);
                            }, 100);
                          }}
                          style={{ padding: '1rem', backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid rgba(248, 113, 113, 0.2)', cursor: 'pointer', transition: 'transform 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                        >
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {risk.path.split('/').pop()}
                          </div>
                          <div style={{ 
                            display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', 
                            backgroundColor: 'rgba(248, 113, 113, 0.1)', color: '#f87171', marginBottom: '0.5rem' 
                          }}>
                            {risk.dimension}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{risk.reason}</div>
                        </div>
                      ))}
                    </div>

                    {/* File Table */}
                    <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-main)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-main)' }}>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>File</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Lang</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', textAlign: 'center' }}>Cmplx</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', textAlign: 'center' }}>Cplng</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', textAlign: 'center' }}>Size</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', textAlign: 'center' }}>Docs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(healthData.files || []).map((f, idx) => (
                            <FileRow key={idx} file={f} onNavigate={() => {
                              setActiveTab('diagram');
                              setTimeout(() => {
                                if (window.navigateToNode) window.navigateToNode(f.path);
                              }, 100);
                            }} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
