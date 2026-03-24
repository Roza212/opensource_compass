import os
from dotenv import load_dotenv
from supabase import create_client, Client

# 1. Explicitly load the .env file from the current folder
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, '.env')
load_dotenv(dotenv_path=env_path, override=True)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

print("\n--- 🔌 DATABASE PING TEST ---")
print(f"URL: {url}")
print(f"Key: {'Loaded (Hidden)' if key else 'MISSING'}")

if not url or not key:
    print("❌ FAILED: Python still cannot read your .env file.")
    exit()

try:
    # 2. Try to connect to Supabase
    supabase: Client = create_client(url, key)
    
    # 3. Try to read from the table we created in the SQL editor
    # We ask for just 1 row to see if the table exists and accepts our keys
    response = supabase.table("code_chunks").select("id").limit(1).execute()
    
    print("\n✅ SUCCESS! Your URL and Key are 100% correct.")
    print("✅ SUCCESS! The 'code_chunks' table exists and is accessible.")
    print("------------------------------\n")
    
except Exception as e:
    print("\n❌ CONNECTION FAILED!")
    print(f"Error Details: {e}")
    print("------------------------------\n")