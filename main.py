# To run this code you need to install the following dependencies:
# pip install google-genai

import os
from google import genai
from google.genai import types


def generate():
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-3-flash-preview"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text="""INSERT_INPUT_HERE"""),
            ],
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
- Seating: Sections A-F, numbered 1-50"""),
        ],
    )

    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if text := chunk.text:
            print(text, end="")

if __name__ == "__main__":
    generate()
