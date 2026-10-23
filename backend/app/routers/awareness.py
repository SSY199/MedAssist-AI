"""JWT-owned learning progress and bounded evidence-grounded explanations."""
import hashlib
import json
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError

from app.core.db import db
from app.core.security import get_current_user
from app.services.awareness_catalog import CATALOG, TOPICS, is_current
from app.services.awareness_answers import explain

router = APIRouter(prefix="/awareness", tags=["awareness"])


def identity(user):
    sub = user.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(401, "Missing account identity")
    return sub


def key(*parts):
    return hashlib.sha256(json.dumps(parts).encode()).hexdigest()


def topic_for(topic_id, version=None):
    topic = TOPICS.get(topic_id)
    if not topic:
        raise HTTPException(404, "Unknown awareness topic")
    if not is_current(topic):
        raise HTTPException(409, "This topic needs an editorial review; use the original sources")
    if version is not None and topic.version != version:
        raise HTTPException(409, "Content changed; reload the lesson")
    return topic


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=1)
    step_id: str = Field(max_length=60)
    choice_id: str = Field(max_length=60)


class Ask(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=1)
    language: Literal["en", "hi"]
    question_id: Literal["basics", "prevention"]


@router.get("/catalog")
async def catalog(user: dict = Depends(get_current_user)):
    identity(user)
    return CATALOG.model_dump(mode="json")


@router.get("/progress")
async def progress(user: dict = Depends(get_current_user)):
    rows = await db["awarenessProgress"].find({"userId": identity(user)}).to_list(length=100)
    return {"progress": [{"topic_id": r["topicId"], "version": r["version"], "answers": r["answers"]}
                         for r in rows if r.get("topicId") in TOPICS]}


@router.put("/progress/{topic_id}")
async def save(topic_id: str, payload: Answer, user: dict = Depends(get_current_user)):
    user_id = identity(user)
    topic = topic_for(topic_id, payload.version)
    step = next((s for s in topic.steps if s.id == payload.step_id), None)
    if not step or payload.choice_id not in {c.id for c in step.choices}:
        raise HTTPException(422, "Unknown learning choice")
    try:
        await db["awarenessProgress"].update_one(
            {"_id": key(user_id, topic_id, topic.version), "userId": user_id},
            {"$set": {"topicId": topic_id, "version": topic.version,
                      f"answers.{step.id}": payload.choice_id, "updatedAt": datetime.now(timezone.utc)},
             "$setOnInsert": {"userId": user_id}}, upsert=True,
        )
    except DuplicateKeyError:
        raise HTTPException(409, "Progress changed; reload and retry") from None
    return {"saved": True}


@router.delete("/progress")
async def reset(user: dict = Depends(get_current_user)):
    await db["awarenessProgress"].delete_many({"userId": identity(user)})
    return {"reset": True}


async def reserve(user_id, now):
    # Independent atomic counters. Partial reservations conservatively consume quota.
    for bucket, limit in [(now.strftime("%Y-%m-%dT%H:%M"), 5), (now.strftime("%Y-%m-%d"), 30)]:
        try:
            result = await db["awarenessUsage"].update_one(
                {"_id": key(user_id, bucket), "count": {"$lt": limit}},
                {"$inc": {"count": 1}, "$setOnInsert": {"bucket": bucket}}, upsert=True,
            )
        except DuplicateKeyError:
            raise HTTPException(429, "Explanation limit reached; authored learning remains available") from None
        if not result.matched_count and not result.upserted_id:
            raise HTTPException(429, "Explanation limit reached")


@router.post("/{topic_id}/explain")
async def explanation(topic_id: str, payload: Ask, user: dict = Depends(get_current_user)):
    user_id = identity(user)
    topic = topic_for(topic_id, payload.version)
    if payload.question_id not in topic.questionIds:
        raise HTTPException(422, "Unsupported prepared question")
    await reserve(user_id, datetime.now(timezone.utc))
    return await explain(topic, payload.language, payload.question_id)
