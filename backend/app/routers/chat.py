from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.db import db
from app.core.security import get_current_user
from app.core.vector_store import retrieve_context
from app.core.gemini_client import generate_chat_response

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    urgencyScore: int


SYSTEM_PROMPT_TEMPLATE = """You are a health information assistant. You are NOT a doctor and must never diagnose. Always recommend professional medical care for anything serious.

Respond ONLY with valid JSON in this exact shape:
{{"reply": "your response text", "urgencyScore": <integer 1-5>}}

Urgency scale:
1 = informational, general question
2 = mild, manageable at home
3 = moderate, worth seeing a doctor soon
4 = urgent, seek care today
5 = life-threatening (chest pain, stroke signs, difficulty breathing, severe bleeding, loss of consciousness)

Patient context:
{patient_context}

Relevant reference information:
{retrieved_context}

Keep replies concise (2-4 sentences) and always include a brief reminder that this is informational, not a diagnosis, when urgencyScore is 3 or higher.
"""


@router.post("/message", response_model=ChatResponse)
async def send_message(body: ChatRequest, user: dict = Depends(get_current_user)):
    profile = await db["patientProfiles"].find_one({"userId": user["sub"]})

    if profile:
        patient_context = (
            f"Age: {profile.get('age', 'unknown')}, "
            f"Gender: {profile.get('gender', 'unknown')}, "
            f"Chronic conditions: {', '.join(profile.get('chronicIllnesses', [])) or 'none recorded'}, "
            f"Allergies: {', '.join(profile.get('allergies', [])) or 'none recorded'}, "
            f"Current medications: {', '.join(profile.get('currentMedications', [])) or 'none recorded'}"
        )
    else:
        patient_context = "No profile on file yet."

    retrieved_chunks = retrieve_context(body.message, k=3)
    retrieved_context = "\n".join(retrieved_chunks) if retrieved_chunks else "No specific reference matched."

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        patient_context=patient_context,
        retrieved_context=retrieved_context,
    )

    result = generate_chat_response(system_prompt, body.message)
    return result