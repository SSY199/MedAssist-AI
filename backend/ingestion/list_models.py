"""
One-off diagnostic: lists every Gemini model your API key can access,
and which actions each one supports (generateContent, embedContent, etc).
Run from backend/: uv run python -m ingestion.list_models
"""

from google import genai
from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

for model in client.models.list():
    print(model.name, "->", model.supported_actions)