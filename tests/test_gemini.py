import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

# Load the .env file
load_dotenv()

def test_gemini():
    try:
        # Initialize Gemini via LangChain
        # It automatically picks up GOOGLE_API_KEY from the .env file
        llm = ChatGoogleGenerativeAI(model="gemini-3-flash-preview", max_retries=1)
        
        # Send a simple test message
        response = llm.invoke("Hello, Gemini! Can you hear me?")
        
        print("\n✅ Success! Your Gemini API key is working perfectly.")
        
        # gemini-3 models return content as a list of parts, so we extract the text
        if isinstance(response.content, list):
            output_text = "".join(part.get("text", "") for part in response.content if part.get("type") == "text")
        else:
            output_text = response.content
            
        print("Gemini says:", output_text)
    except Exception as e:
        print("\n❌ Error: There is an issue with your Gemini Setup.")
        print("Details:", e)

if __name__ == "__main__":
    test_gemini()
