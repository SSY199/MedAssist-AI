from google import genai
from google.genai import types

from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Confirmed against this key's actual available models via
# ingestion/list_models.py — don't guess these again, re-run that script
# if either of these ever 404s in the future (models get deprecated).
CHAT_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"


def embed_text(text: str) -> list[float]:
    """Embeds a single string. Used both when indexing the knowledge base
    and when embedding an incoming user question for retrieval."""
    result = client.models.embed_content(model=EMBEDDING_MODEL, contents=text)
    return result.embeddings[0].values


def generate_chat_response(system_prompt: str, user_message: str) -> dict:
    """
    Calls Gemini asking for a JSON response shaped like:
    {"reply": "...", "urgencyScore": 1-5}
    Falls back to a safe default if the model doesn't return valid JSON.
    """
    response = client.models.generate_content(
        model=CHAT_MODEL,
        contents=f"{system_prompt}\n\nPatient message: {user_message}",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    import json

    try:
        parsed = json.loads(response.text)
        return {
            "reply": parsed.get("reply", "I'm not sure how to respond to that."),
            "urgencyScore": int(parsed.get("urgencyScore", 2)),
        }
    except (json.JSONDecodeError, ValueError, AttributeError):
        return {
            "reply": response.text or "Something went wrong generating a response.",
            "urgencyScore": 2,
        }