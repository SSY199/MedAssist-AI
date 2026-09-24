import json
from typing import AsyncGenerator

from google import genai
from google.genai import types

from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Confirmed against this project's actual available models via
# ingestion/list_models.py — re-run that script if either ever 404s.
CHAT_MODEL = "gemini-2.5-flash"
CLASSIFIER_MODEL = "gemini-2.5-flash-lite"  # fast + cheap, just for urgency scoring
EMBEDDING_MODEL = "gemini-embedding-001"


def embed_text(text: str) -> list[float]:
    result = client.models.embed_content(model=EMBEDDING_MODEL, contents=text)
    return result.embeddings[0].values


def classify_urgency(history_text: str, message: str) -> int:
    """
    Fast, non-streaming call to score urgency BEFORE we commit to streaming
    a full reply. This runs separately from the conversational response
    because we can't cleanly stream partial JSON — the reply needs to be
    plain text once we know it's safe to generate one.
    Fails safe to 2 (mild) if the model doesn't return valid JSON — worth
    knowing this is a real tradeoff, not a guarantee of correctness.
    """
    prompt = (
        "You are a medical urgency classifier. Based on the conversation "
        "so far and the newest patient message, output ONLY JSON: "
        '{"urgencyScore": <integer 1-5>}\n\n'
        "1 = informational, 2 = mild, 3 = moderate, "
        "4 = urgent (seek care today), "
        "5 = life-threatening (chest pain, stroke signs, can't breathe, "
        "severe bleeding, unconscious)\n\n"
        f"Conversation so far:\n{history_text}\n\n"
        f"Newest message: {message}"
    )
    response = client.models.generate_content(
        model=CLASSIFIER_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    try:
        return int(json.loads(response.text).get("urgencyScore", 2))
    except (json.JSONDecodeError, ValueError, AttributeError, TypeError):
        return 2


async def stream_chat_response(
    system_prompt: str, history: list[dict], message: str
) -> AsyncGenerator[str, None]:
    """
    Yields plain-text chunks as they arrive from Gemini.
    NOTE: `client.aio.models.generate_content_stream` is the async streaming
    surface of the SDK as of my knowledge — this is one of the areas most
    likely to have shifted. If this throws an AttributeError or similar,
    check ai.google.dev's current Python SDK docs for the streaming method.
    `history` entries use role "user" or "model" (Gemini's own naming for
    its past turns, not "assistant").
    """
    contents = [
        types.Content(role=h["role"], parts=[types.Part(text=h["content"])])
        for h in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    stream = await client.aio.models.generate_content_stream(
        model=CHAT_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
    )
    async for chunk in stream:
        if chunk.text:
            yield chunk.text