const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const ingestRepo = async (url) => {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_url: url.trim() }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to ingest repository.');
  }
  return res.json();
};

export const embedRepo = async (repoName) => {
  const res = await fetch(`${API_BASE}/embed/${repoName}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to embed repository.');
  }
  return res.json();
};

export const fetchDiagram = async (repoName) => {
  const res = await fetch(`${API_BASE}/diagram/${repoName}?raw=true`);
  if (!res.ok) {
    throw new Error('Failed to fetch diagram.');
  }
  return res.text();
};

export const sendChatMessage = async (repoName, question) => {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_name: repoName, question }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to get chat response.');
  }
  return data;
};
