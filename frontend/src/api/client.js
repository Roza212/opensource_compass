const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/**
 * Central error handler for all API responses.
 * Detects 429 rate limit responses and returns a user-friendly message.
 */
const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = data.retry_after_seconds || 3600;
      const minutes = Math.ceil(retryAfter / 60);
      const waitStr = minutes <= 1 ? 'a moment' : `${minutes} minutes`;
      throw new Error(data.message || `You've sent too many requests. Please wait ${waitStr}.`);
    }
    throw new Error(data.detail || data.message || 'An unexpected error occurred.');
  }
  return data;
};

export const ingestRepo = async (url) => {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_url: url.trim() }),
  });
  return handleResponse(res);
};

export const fetchJobStatus = async (jobId) => {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  return handleResponse(res);
};

export const fetchDiagram = async (repoName) => {
  const res = await fetch(`${API_BASE}/diagram/${repoName}?raw=true`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      const retryAfter = data.retry_after_seconds || 1800;
      throw new Error(data.message || `Rate limit reached. Please wait ${Math.ceil(retryAfter / 60)} minutes.`);
    }
    throw new Error(data.detail || 'Failed to fetch diagram.');
  }
  return res.text();
};

export const sendChatMessage = async (repoName, question, sessionId = null) => {
  const payload = { repo_name: repoName, question };
  if (sessionId) {
    payload.session_id = sessionId;
  }
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const fetchHealthReport = async (repoName) => {
  const res = await fetch(`${API_BASE}/analyze/${repoName}`);
  return handleResponse(res);
};

export const generateTour = async (repoName) => {
  const res = await fetch(`${API_BASE}/tour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_name: repoName })
  });
  return handleResponse(res);
};

export const fetchSessionMessages = async (sessionId) => {
  const res = await fetch(`${API_BASE}/sessions/messages/${sessionId}`);
  return handleResponse(res);
};

export const fetchTree = async (repoName) => {
  const res = await fetch(`${API_BASE}/tree?repo_name=${repoName}`);
  return handleResponse(res);
};
