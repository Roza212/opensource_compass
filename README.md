# OpenSource Compass 🧭

**OpenSource Compass** is an advanced, AI-powered codebase exploration and mentorship platform. It transforms complex open-source repositories into interactive, semantically-encoded visual maps, providing junior and senior developers alike with a "GPS" for unfamiliar codebases.

[![D3 Tree](https://img.shields.io/badge/Visualization-D3.js-orange)](https://d3js.org/)
[![AI Mentor](https://img.shields.io/badge/AI-Gemini_2.0_Flash-blue)](https://deepmind.google/technologies/gemini/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-green)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Vector_DB-Supabase-emerald)](https://supabase.com/)

---

## ✨ Key Features

### 🗺️ Interactive Architecture Explorer (D3.js)
- **Collapsible Hierarchical Tree**: Navigate deep file structures with a fluid, horizontal D3.js visualization.
- **Semantic Data Encoding**:
  - **Color-Coded**: Instantly identify languages (Python/Teal, JS/Amber, Go/Blue, etc.).
  - **Size-Mapped**: Node radius scales with **Lines of Code (LOC)**, highlighting major modules at a glance.
- **Bi-directional Navigation**: Explore "Dependencies" (imports) and "Depended on by" (incoming imports) via interactive chips.
- **Visual Depth Fade**: Hierarchical link styling guides the eye toward the system's entry points.

### 🤖 AI Mentorship & Onboarding
- **RAG-Powered Chat**: Chat with an AI mentor (Gemini 2.0 Flash) that has deep context of the entire repo.
- **Automated Guided Tours**: Generates a 5-step interactive onboarding tour for any repo, highlighting central modules using graph theory (Degree Centrality).
- **Context-Aware Explanations**: One-click "Explain with AI" buttons on every file node.
- **Source Citations**: AI responses include clickable file badges that highlight the relevant code in the diagram.

### 📊 Codebase Health & Analysis
- **Static Analysis Dashboard**: Real-time reports on Cyclomatic Complexity (Radon), Comment Density, and Dependency coupling.
- **Weighted Health Scoring**: Provides an overall "Compass Score" to evaluate codebase maintainability.

### ⚙️ High-Performance Engine
- **Async Ingestion Pipeline**: Powered by **Celery & Redis** for non-blocking cloning and embedding of large repositories.
- **Multi-Language AST Support**: Advanced parsing for Python, JavaScript, TypeScript, Go, Rust, Java, C/C++, and more via `tree-sitter`.
- **Reranked Retrieval**: Uses a **Cross-Encoder** reranker to ensure the most relevant code chunks reach the LLM.
- **SHA-Based Caching**: Skip re-indexing for unchanged repositories to save time and API quota.

---

## 🏗️ Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, Tailwind CSS v4, D3.js v7, Lucide Icons |
| **Backend API** | FastAPI, Uvicorn, SlowAPI (Rate Limiting) |
| **AI/ML** | Google Gemini 2.0 Flash, SentenceTransformers, Cross-Encoders |
| **Task Queue** | Celery, Redis |
| **Database** | Supabase Postgres (pgvector) |
| **Analysis** | Tree-Sitter (Multi-lang AST), Radon (Complexity) |

---

## 📁 Project Structure

```text
opensource_compass/
├── backend/
│   ├── main.py                  # API Entry Point & Middleware
│   ├── app/
│   │   ├── api/                 # Routers (Chat, Ingest, Diagram, Analyze, etc.)
│   │   ├── services/            # Logic (ChatEngine, VectorStore, GitService)
│   │   ├── utils/               # Helpers (Chunker, GraphBuilder, RadonAnalysis)
│   │   ├── core/                # Configs (Prompts, Rate Limiting)
│   │   └── worker.py            # Celery Task Definitions
│   └── requirements.txt         # Backend Dependencies
│
└── frontend/
    ├── src/
    │   ├── api/                 # Centralized API Client
    │   ├── components/          # Reusable UI (TreeDiagram, SidePanel)
    │   └── views/               # Page Layouts (Landing, Dashboard, About)
    ├── vite.config.js           # Tailwind v4 Integrated Config
    └── index.css                # Custom Design System
```

---

## 🛠️ Setup & Installation

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- **Redis Server** (Installed natively or via Docker)

### 2. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
# AI & Database
GOOGLE_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Infrastructure
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
```

### 3. Execution Order
1. **Start Redis**: Ensure the Redis service is running.
2. **Start Backend**: `uvicorn main:app --reload`
3. **Start Worker**: `celery -A app.worker.celery_app worker --loglevel=info --pool=solo`
4. **Start Frontend**: `npm run dev`

---

## 🔌 Core API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest` | Initiate async repo ingestion (returns Job ID) |
| `GET`  | `/jobs/{id}` | Poll ingestion status & progress |
| `GET`  | `/tree` | Fetch hierarchical D3 JSON for visualization |
| `GET`  | `/analyze` | Generate Codebase Health & Complexity report |
| `POST` | `/chat` | Contextual AI mentorship (with RAG & Reranking) |
| `POST` | `/tour` | Generate AI guided tour of top modules |

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Built to make open-source code accessible to everyone.*
