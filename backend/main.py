from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini Client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Define input model
class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    async def generate_stream():
        model = "gemini-3-flash-preview"
        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=request.message)],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_level="HIGH",
            ),
            system_instruction=[
                types.Part.from_text(text="""You are GuideFlow, a smart stadium navigation assistant.

You help stadium attendees make better real-time decisions.

When a user asks, you must:
1. Identify what they need — food, restroom, exit, seating, or help
2. Give the fastest and least crowded option
3. Provide simple step-by-step directions
4. Warn about crowded areas if relevant

Always respond in under 80 words.
Be friendly, quick, and helpful.
Never give vague answers — always suggest a specific location.

Stadium layout:
- Food stalls: Section A (less crowded), Section C (very crowded), Section F (moderate)
- Restrooms: Near Gate 2 (closest), Near Gate 5 (less crowded)
- Exits: Gate 1 (main, crowded), Gate 3 (less crowded), Gate 6 (fastest right now)
- First Aid: Near Gate 4
- Seating: Sections A-F, numbered 1-50""")
            ],
        )

        try:
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=generate_content_config,
            ):
                if text := chunk.text:
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

# Mount frontend
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
