import json
from datetime import datetime, timezone
from typing import AsyncGenerator

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.db import db
from app.core.security import get_current_user
from app.core.vector_store import retrieve_context
from app.core.gemini_client import classify_urgency, stream_chat_response

router = APIRouter(prefix="/chat", tags=["chat"])

MAX_HISTORY_MESSAGES = 20  # capped context sent to Gemini per turn


class ConversationOut(BaseModel):
    id: str
    title: str
    updatedAt: str


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    urgencyScore: int | None = None


class SendMessageRequest(BaseModel):
    message: str


def _serialize_conversation(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", "New conversation"),
        "updatedAt": doc["updatedAt"].isoformat(),
    }


def _serialize_message(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "role": doc["role"],
        "content": doc["content"],
        "urgencyScore": doc.get("urgencyScore"),
    }


async def _get_owned_conversation(conversation_id: str, user_id: str):
    try:
        oid = ObjectId(conversation_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Conversation not found")
    convo = await db["conversations"].find_one({"_id": oid, "userId": user_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return convo


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(user: dict = Depends(get_current_user)):
    cursor = db["conversations"].find({"userId": user["sub"]}).sort("updatedAt", -1)
    return [_serialize_conversation(doc) async for doc in cursor]


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    result = await db["conversations"].insert_one(
        {
            "userId": user["sub"],
            "title": "New conversation",
            "createdAt": now,
            "updatedAt": now,
        }
    )
    doc = await db["conversations"].find_one({"_id": result.inserted_id})
    return _serialize_conversation(doc)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    convo = await _get_owned_conversation(conversation_id, user["sub"])
    await db["conversations"].delete_one({"_id": convo["_id"]})
    await db["messages"].delete_many({"conversationId": conversation_id})
    return {"deleted": True}


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    await _get_owned_conversation(conversation_id, user["sub"])
    cursor = db["messages"].find({"conversationId": conversation_id}).sort("createdAt", 1)
    return [_serialize_message(doc) async for doc in cursor]


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


@router.post("/conversations/{conversation_id}/message")
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    user: dict = Depends(get_current_user),
):
    convo = await _get_owned_conversation(conversation_id, user["sub"])
    now = datetime.now(timezone.utc)

    # Save the user's message immediately, before urgency is known.
    user_msg_result = await db["messages"].insert_one(
        {
            "conversationId": conversation_id,
            "userId": user["sub"],
            "role": "user",
            "content": body.message,
            "urgencyScore": None,
            "createdAt": now,
        }
    )

    # Auto-title a brand-new conversation from its first message.
    if convo.get("title") == "New conversation":
        new_title = body.message.strip()[:40] + ("..." if len(body.message) > 40 else "")
        await db["conversations"].update_one(
            {"_id": convo["_id"]}, {"$set": {"title": new_title, "updatedAt": now}}
        )
    else:
        await db["conversations"].update_one(
            {"_id": convo["_id"]}, {"$set": {"updatedAt": now}}
        )

    # Load recent history for context (capped, excludes the message just inserted).
    history_cursor = (
        db["messages"]
        .find({"conversationId": conversation_id, "_id": {"$ne": user_msg_result.inserted_id}})
        .sort("createdAt", -1)
        .limit(MAX_HISTORY_MESSAGES)
    )
    history_docs = [doc async for doc in history_cursor]
    history_docs.reverse()  # chronological order for the model

    history_for_model = [
        {"role": "model" if d["role"] == "assistant" else "user", "content": d["content"]}
        for d in history_docs
    ]
    history_text_for_classifier = "\n".join(
        f"{d['role']}: {d['content']}" for d in history_docs
    )

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

    async def event_stream() -> AsyncGenerator[str, None]:
        # Classify urgency BEFORE streaming a reply — lets us skip straight
        # to the Red Alert signal without generating a full response when
        # it isn't needed, and without streaming partial JSON (not valid JSON).
        urgency = classify_urgency(history_text_for_classifier, body.message)

        await db["messages"].update_one(
            {"_id": user_msg_result.inserted_id}, {"$set": {"urgencyScore": urgency}}
        )

        if urgency >= 4:
            yield _sse("urgent", {"urgencyScore": urgency})
            return

        retrieved_chunks = retrieve_context(body.message, k=3)
        retrieved_context = (
            "\n".join(retrieved_chunks) if retrieved_chunks else "No specific reference matched."
        )

        system_prompt = (
            "You are a health information assistant. You are NOT a doctor "
            "and must never diagnose. Recommend professional care for "
            "anything serious. Keep replies concise (2-4 sentences).\n\n"
            f"Patient context: {patient_context}\n\n"
            f"Relevant reference information:\n{retrieved_context}"
        )

        full_reply = ""
        try:
            async for chunk in stream_chat_response(system_prompt, history_for_model, body.message):
                full_reply += chunk
                yield _sse("chunk", {"text": chunk})
        except Exception as exc:
            yield _sse("error", {"message": str(exc)})
            return

        await db["messages"].insert_one(
            {
                "conversationId": conversation_id,
                "userId": user["sub"],
                "role": "assistant",
                "content": full_reply,
                "urgencyScore": urgency,
                "createdAt": datetime.now(timezone.utc),
            }
        )

        yield _sse("done", {})

    return StreamingResponse(event_stream(), media_type="text/event-stream")