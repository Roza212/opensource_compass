import { useState, useRef, useEffect } from 'react';
import { Loader2, Compass } from 'lucide-react';
import { ingestRepo, embedRepo } from '../api/client';

export default function LandingView({ onAnalyze }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  
  const progressInterval = useRef(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  const handleIngest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setProgress(0);

    // Start logarithmic progress bar
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        const remaining = 95 - prev;
        return Math.min(prev + (remaining * 0.08), 95); 
      });
    }, 500);

    try {
      setStatusMsg('Cloning repository...');
      const ingestData = await ingestRepo(url);
      const repoName = ingestData.repo_name || url.trim().split('/').pop().replace('.git', '');

      setStatusMsg('Generating embeddings...');
      await embedRepo(repoName);

      if (progressInterval.current) clearInterval(progressInterval.current);
      setProgress(100);
      setStatusMsg('Ready!');
      
      // Wait a tiny beat so the user sees 100% completion before jumping
      setTimeout(() => {
        onAnalyze(repoName);
      }, 500);

    } catch (err) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setError(err.message);
      setStatusMsg('');
      setLoading(false);
      setProgress(0);
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
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: loading ? '#1e293b' : undefined,
            border: loading ? '1px solid #334155' : 'none'
          }}
        >
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              transition: 'width 0.5s ease-out',
              zIndex: 0
            }} />
          )}
          
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {loading ? (
              <>
                <Loader2 size={20} className="spinner" />
                {statusMsg || 'Analyzing...'}
              </>
            ) : (
              'Analyze Repository'
            )}
          </div>
        </button>
        


        {error && (
          <p style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
