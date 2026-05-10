# OpenSource Compass 🧭

**OpenSource Compass** is an advanced, AI-powered codebase exploration and mentorship platform. It transforms complex open-source repositories into interactive, semantically-encoded visual maps, providing junior and senior developers alike with a "GPS" for unfamiliar codebases.

[![D3 Tree](https://img.shields.io/badge/Visualization-D3.js-orange)](https://d3js.org/)
[![AI Mentor](https://img.shields.io/badge/AI-Gemini_1.5_Pro-blue)](https://deepmind.google/technologies/gemini/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-green)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Vector_DB-Supabase-emerald)](https://supabase.com/)

---

## ✨ Key Features

### 🗺️ Interactive Architecture Explorer (D3.js)
- **Collapsible Hierarchical Tree**: Navigate deep file structures with a fluid, horizontal D3.js visualization.
- **Semantic Data Encoding**: Color-coded by language and sized by LOC.
- **Minimap Navigation**: Easily navigate massive codebases with a real-time overview window.
- **Explain with AI**: Instant module-level explanations using RAG-powered Gemini Pro.

### 🤖 AI Mentorship & Onboarding
- **RAG-Powered Chat**: Chat with an AI mentor that has deep context of the entire repo.
- **Automated Guided Tours**: Generates interactive onboarding tours for any repo.
- **Context-Aware Citations**: AI responses link directly to specific nodes in the architecture tree.

### 📊 Multi-Dimensional Health & Analysis
- **Advanced Health Engine**: Real-time reports across 4 dimensions: **Complexity** (Radon/Density), **Coupling** (Import Graphs), **Size** (LOC), and **Understandability** (Docs).
- **Interactive Issue Tracking**: Expandable issue lists per file with actionable refactoring advice.
- **Top Risks Dashboard**: Instantly identifies the 5 most problematic files based on multi-dimensional scoring.
- **Cross-Navigation**: Seamlessly jump from a health issue directly to the file's location in the architecture tree.

### ⚙️ High-Performance Engine
- **Async Ingestion Pipeline**: Powered by **Celery & Redis** for non-blocking cloning and embedding.
- **Multi-Language AST Support**: Advanced parsing for 14+ languages (Python, JS, TS, Go, Rust, Java, C++, etc.).
- **Intelligent Caching**: Commit SHA-aware caching for analysis results to ensure instant sub-second responses.

---

## 🏗️ Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, Tailwind CSS v4, D3.js v7, Lucide Icons |
| **Backend API** | FastAPI, Uvicorn, SlowAPI (Rate Limiting) |
| **AI/ML** | Google Gemini 1.5 Pro, SentenceTransformers (MiniLM-L6) |
| **Task Queue** | Celery, Redis |
| **Database** | Supabase Postgres (pgvector) |
| **Graph Logic** | NetworkX (Dependency Analysis) |

---

## 📁 Project Structure

```text
opensource_compass/
├── .temp_repos/                 # Persistent storage for analyzed repositories
├── backend/
│   ├── main.py                  # API Entry Point
│   ├── app/
│   │   ├── api/                 # Routers (Chat, Ingest, Diagram, Analyze)
│   │   ├── services/            # Logic (VectorStore, GitService, ChatEngine)
│   │   ├── utils/               # Helpers (Chunker, GraphBuilder, Radon)
│   │   └── worker.py            # Celery Background Tasks
│   └── requirements.txt         # Backend Dependencies
│
└── frontend/
    ├── src/
    │   ├── api/                 # Centralized API Client
    │   ├── components/          # UI Components (TreeDiagram, SidePanel)
    │   └── views/               # Page Layouts (Dashboard, Landing)
```

---

## 🛠️ Setup & Installation

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- **Redis Server** (Installed natively or via Docker)
- **Supabase Account** with pgvector enabled

### 2. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
GOOGLE_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
```

### 3. Database Setup
Run the SQL script found in `PROJECT_DOCUMENTATION.md` inside your Supabase SQL Editor to create the necessary tables and functions.

### 4. Execution Order
1. **Start Redis**: `redis-server`
2. **Start Backend**: `uvicorn main:app --reload`
3. **Start Worker**: `celery -A app.worker.celery_app worker --loglevel=info --pool=solo`
4. **Start Frontend**: `npm run dev`

---

## 🔌 Core API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest` | Initiate async repo ingestion |
| `GET`  | `/status/{repo}` | Poll ingestion status |
| `GET`  | `/tree/{repo}` | Fetch hierarchical D3 JSON |
| `GET`  | `/analyze/{repo}` | Generate 4-dimension Health report |
| `POST` | `/chat` | Contextual AI mentorship |

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Built to make open-source code accessible to everyone.*
