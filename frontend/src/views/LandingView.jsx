import { useState } from 'react';
import { Loader2, Compass } from 'lucide-react';
import { ingestRepo, embedRepo } from '../api/client';

export default function LandingView({ onAnalyze }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  const handleIngest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');

    try {
      setStatusMsg('Cloning repository...');
      const ingestData = await ingestRepo(url);
      const repoName = ingestData.repo_name || url.trim().split('/').pop().replace('.git', '');

      setStatusMsg('Generating embeddings... (this may take a minute)');
      await embedRepo(repoName);

      setStatusMsg('');
      onAnalyze(repoName);
    } catch (err) {
      setError(err.message);
      setStatusMsg('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleIngest();
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
          onClick={handleIngest}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="spinner" />
              {statusMsg || 'Analyzing...'}
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
