import { useState, useRef, useEffect } from 'react';
import { Loader2, Compass } from 'lucide-react';
import { ingestRepo, fetchJobStatus } from '../api/client';

// Maps job status to a human-readable message and a progress percentage
const STATUS_MAP = {
  queued:    { msg: 'Preparing analysis pipeline...', progress: 8 },
  running:   { msg: 'Indexing & analyzing codebase...', progress: 55 },
  completed: { msg: 'Analysis complete!',              progress: 100 },
  failed:    { msg: 'Analysis failed.',                progress: 0 },
};

export default function LandingView({ onAnalyze, onNavigateAbout }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const pollInterval = useRef(null);
  const animInterval = useRef(null);

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (animInterval.current) clearInterval(animInterval.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
    if (animInterval.current) { clearInterval(animInterval.current); animInterval.current = null; }
  };

  // Slowly animate the progress bar while the job is "running" (so it doesn't look stuck)
  const startRunningAnimation = (currentProgress) => {
    if (animInterval.current) clearInterval(animInterval.current);
    animInterval.current = setInterval(() => {
      setProgress((prev) => {
        const remaining = 95 - prev;
        return Math.min(prev + remaining * 0.04, 95);
      });
    }, 600);
  };

  const handleIngest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setProgress(5);
    setStatusMsg('Initializing...');

    try {
      // 1. Queue the job — returns immediately with { job_id, repo_name }
      const { job_id, repo_name } = await ingestRepo(url);

      setStatusMsg(STATUS_MAP.queued.msg);
      setProgress(STATUS_MAP.queued.progress);

      // 2. Poll every 2 seconds for status changes
      pollInterval.current = setInterval(async () => {
        try {
          const job = await fetchJobStatus(job_id);
          const mapped = STATUS_MAP[job.status] || STATUS_MAP.queued;

          setStatusMsg(mapped.msg);

          if (job.status === 'running') {
            // Only kick off the animation once
            if (!animInterval.current) startRunningAnimation();
          }

          if (job.status === 'completed') {
            stopPolling();
            setProgress(100);
            setStatusMsg('Ready!');
            setTimeout(() => onAnalyze(job.repo_name || repo_name), 600);
          }

          if (job.status === 'failed') {
            stopPolling();
            setProgress(0);
            setError(job.error || 'Ingestion failed. Check the worker logs.');
            setStatusMsg('');
            setLoading(false);
          }
        } catch (pollErr) {
          // Network hiccup — keep polling, don't abort
          console.warn('Poll error (will retry):', pollErr.message);
        }
      }, 2000);

    } catch (err) {
      stopPolling();
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
      <button
        onClick={onNavigateAbout}
        style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '1rem',
          transition: 'color 0.3s',
          zIndex: 10
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-purple)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        About
      </button>
      <Compass size={56} strokeWidth={1.5} style={{ color: 'var(--neon-purple)', marginBottom: '1rem', position: 'relative', zIndex: 1 }} />
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
            background: loading ? 'var(--bg-surface)' : undefined,
            border: loading ? '1px solid var(--border-main)' : 'none'
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
              transition: 'width 0.6s ease-out',
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
