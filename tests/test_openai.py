import os
from dotenv import load_dotenv
from openai import OpenAI

# Load the environment variables from your .env file
load_dotenv()

# Initialize the client. It automatically picks up the OPENAI_API_KEY from the environment
client = OpenAI()

try:
    # Try fetching the list of models as a simple test
    models = client.models.list()
    print("✅ Success! Your OpenAI API key is valid.")
    
    # Print the first 5 models to verify it's working
    print("Available models:", [model.id for model in models.data[:5]])
except Exception as e:
    print("❌ Error: There is an issue with your API key.")
    print("Details:", e)
