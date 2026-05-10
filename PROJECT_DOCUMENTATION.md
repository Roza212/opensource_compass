# 🧭 OpenSource Compass: Project Documentation

OpenSource Compass is a polyglot codebase analysis and visualization platform. It helps developers understand complex software architectures through interactive D3.js diagrams, AI-powered insights, and multi-language health metrics.

---

## 🏗️ System Architecture

- **Frontend**: React + Tailwind CSS + D3.js.
- **Backend**: FastAPI (Python) + Celery (Background Tasks).
- **Database**: Supabase (PostgreSQL + pgvector).
- **Storage**: Persistent `.temp_repos` directory for high-speed local analysis.
- **AI**: Gemini Pro (via Google Generative AI) + SentenceTransformers (local embeddings).

---

## 📡 API Reference (Backend Endpoints)

### 1. Ingestion & Repository Management
| Endpoint | Method | Function | Description |
| :--- | :--- | :--- | :--- |
| `/ingest` | `POST` | `ingest_repository` | Clones a GitHub repo, triggers background chunking and embedding. |
| `/status/{repo_name}`| `GET` | `get_status` | Checks if a repository is currently being processed by Celery. |

### 2. Analysis & Health
| Endpoint | Method | Function | Description |
| :--- | :--- | :--- | :--- |
| `/analyze/{repo}` | `GET` | `analyze_repo` | **Core Engine.** Calculates Complexity, Coupling, Size, and Docs using a 4-dimension health model. |
| `/tree/{repo}` | `GET` | `get_tree_data` | Generates the hierarchical JSON structure for the D3 tree visualization. |

### 3. AI & Chat
| Endpoint | Method | Function | Description |
| :--- | :--- | :--- | :--- |
| `/chat` | `POST` | `chat_with_repo` | RAG-powered chat. Searches vector store for code context before answering using Gemini Pro. |
| `/tour/{repo}` | `GET` | `generate_tour` | Uses AI to generate a "Getting Started" guide based on the top-level files. |

---

## 🧩 Module Breakdown

### 📂 `backend/app/api/`
- **`analyze.py`**:
  - `get_python_metrics(source)`: Uses AST and `radon` to calculate Python-specific health.
  - `get_generic_metrics(source, ext)`: Uses keyword density for polyglot complexity (JS, Go, Rust, etc.).
  - `analyze_repo(repo_name)`: Orchestrates the 4-dimension health report and handles Supabase caching.
- **`chat.py`**:
  - `chat_with_repo(request)`: Interfaces with Gemini Pro and the vector store to provide contextual answers.
- **`diagram.py`**:
  - `get_tree_data(repo_name)`: Maps the local file system to a D3-compatible node-link structure.

### 📂 `backend/app/services/`
- **`vector_store.py`**:
  - `store_chunks_in_supabase(repo_name, chunks)`: Encodes code into vectors and saves to pgvector.
  - `search_code(query)`: Performs similarity search to find relevant code snippets for AI.
- **`git_service.py`**:
  - `clone_repo(url)`: Handles safe cloning and path resolution in the persistent `.temp_repos` dir.

### 📂 `backend/app/utils/`
- **`chunker.py`**:
  - `chunk_code(content, path)`: Polyglot parser that splits code into functional units (functions, classes) for embedding.
- **`graph_builder.py`**:
  - `build_repo_graph(path)`: Uses regex and AST to build an import dependency graph (NetworkX). Used for coupling metrics.

---

## ⚙️ Background Workers (Celery)
Located in `backend/app/worker.py`:
- **`process_repository_task`**: The primary long-running task. It:
  1. Clones the code from GitHub.
  2. Parses every file into chunks based on language-specific logic.
  3. Generates 384-dimensional embeddings using `all-MiniLM-L6-v2`.
  4. Stores everything in Supabase `code_chunks` table.
  5. Updates the repository status to `COMPLETED`.

---

## 🎨 Frontend Architecture

- **`DashboardView.jsx`**: The main interface. Manages navigation and global state for analysis data.
- **`TreeDiagram.jsx`**: A custom D3 implementation.
  - Features a **Minimap** for navigation and **semantic highlighting** (colors by language).
  - Implements **Semantic Zoom** and **Panning**.
  - Handles **Drill-down**: Clicking a node opens a detailed side panel with imports/dependents.
- **`HealthBoard` (in DashboardView)**:
  - Visualizes median scores using responsive CSS progress bars.
  - Highlights **Top Risks** (the 5 most problematic files in the repo).
  - Provides a sortable table with expandable issue details.

---

## 💾 Database Schema (Supabase)
1. **`repos`**: Tracks repository names, clone URLs, and status.
2. **`code_chunks`**: Stores `chunk_text`, `file_path`, and the `embedding` vector.
3. **`analysis_cache`**: Caches the 4-dimension health results per Commit SHA to avoid re-analysis.

---

## 🚀 How to Run
1. **Backend**: `uvicorn main:app --reload`
2. **Worker**: `celery -A app.worker.celery_app worker --loglevel=info --pool=solo`
3. **Frontend**: `npm run dev` (inside `/frontend`)
