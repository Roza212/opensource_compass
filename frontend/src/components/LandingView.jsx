import { useState } from 'react';
import { Loader2, Compass } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function LandingView({ onAnalyze }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to ingest repository.');
      }

      const data = await res.json();
      const repoName = data.repo_name || url.trim().split('/').pop().replace('.git', '');
      onAnalyze(repoName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="landing-container">
      <Compass size={56} strokeWidth={1.5} style={{ color: '#8b5cf6', marginBottom: '1rem', position: 'relative', zIndex: 1 }} />
      <h1 className="landing-logo">OpenSource Compass</h1>
      <p className="landing-subtitle">
        Your AI-powered mentor for exploring and understanding any open-source codebase.
      </p>

      <div className="input-wrapper">
        <input
          className="glow-input"
          type="text"
          placeholder="Paste a GitHub Repository URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="analyze-btn"
          onClick={handleSubmit}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="spinner" />
              Analyzing...
            </>
          ) : (
            'Analyze Repository'
          )}
        </button>
        {error && (
          <p style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
