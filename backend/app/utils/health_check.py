import os
import sys
import httpx
import dotenv
from supabase import create_client

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

dotenv.load_dotenv(os.path.join(os.getcwd(), "backend", ".env"))

def check_env():
    required = ["SUPABASE_URL", "SUPABASE_KEY", "GOOGLE_API_KEY", "REDIS_URL"]
    missing = [r for r in required if not os.environ.get(r)]
    if missing:
        return f"[FAIL] Missing env vars: {', '.join(missing)}"
    return "[OK] Environment variables loaded."

def check_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    try:
        client = create_client(url, key)
        # Check jobs table
        res = client.table("jobs").select("count", count="exact").limit(1).execute()
        return f"[OK] Supabase connected. 'jobs' table has {res.count} records."
    except Exception as e:
        return f"[FAIL] Supabase connection failed: {e}"

def check_backend_api():
    try:
        res = httpx.get("http://localhost:8000/health", timeout=5)
        if res.status_code == 200:
            return f"[OK] Backend API is alive: {res.json()}"
        return f"[WARN] Backend API returned {res.status_code}"
    except Exception:
        return "[FAIL] Backend API (port 8000) is unreachable. (Is uvicorn running?)"

def check_redis():
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    try:
        import redis
        r = redis.from_url(redis_url)
        r.ping()
        return "[OK] Redis is connected and responsive."
    except Exception as e:
        return f"[FAIL] Redis connection failed: {e}"

if __name__ == "__main__":
    print("--- OpenSource Compass System Health Report ---")
    print(check_env())
    print(check_backend_api())
    print(check_supabase())
    print(check_redis())
    print("-----------------------------------------------")
