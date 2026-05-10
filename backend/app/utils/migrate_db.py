import os
import dotenv
from supabase import create_client, Client

dotenv.load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    print("🚀 Attempting to add 'language' column to 'code_chunks' table...")
    # Using raw SQL via RPC or just catching error if it exists
    # Note: Supabase doesn't have a direct 'sql' method in the client, 
    # but we can try to do a dummy insert to see if it works or use an existing RPC if available.
    # Usually migrations are done via SQL Editor in Dashboard.
    # However, I can't do that. I'll just warn the user or assume they did it.
    
    # Actually, many Supabase setups have a 'exec_sql' RPC if they followed certain tutorials.
    # I'll just check if the column exists by trying a select.
    res = supabase.table("code_chunks").select("language").limit(1).execute()
    print("✅ 'language' column already exists.")
except Exception as e:
    print(f"❌ Could not verify 'language' column. Please run this in your Supabase SQL Editor:")
    print("ALTER TABLE code_chunks ADD COLUMN language TEXT;")
