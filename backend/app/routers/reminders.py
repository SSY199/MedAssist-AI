"""JWT-owned prescribed schedules and user-reported occurrence actions."""
from datetime import date, datetime, timedelta
from hashlib import sha256
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.db import db
from app.core.security import get_current_user
from app.services import reminders as service
from app.services.reminder_email import email_ready, verified_recipient
from app.services.reminder_schedule import ReminderInput, aware, next_preview, utcnow

router = APIRouter(prefix="/reminders", tags=["reminders"])


def identity(user):
    value = user.get("sub")
    if not isinstance(value, str) or not value:
        raise HTTPException(401, "Missing account identity")
    return value


class CreateReminder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    schedule: ReminderInput


class ChangeReminder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=1)
    schedule: ReminderInput | None = None
    state: Literal["active", "paused", "stopped"] | None = None


class OccurrenceAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=1)
    action: Literal["taken", "skipped", "snooze"]
    request_id: UUID


async def schedule_values(payload, user_id, now):
    preview = next_preview(payload.model_dump(mode="json"), now)
    if not preview:
        raise HTTPException(422, "Schedule must have a future occurrence")
    recipient = await verified_recipient(user_id) if payload.email_enabled else None
    if payload.email_enabled and (not recipient or not email_ready()):
        raise HTTPException(422, "Generic email needs a verified account email and an enabled Gmail sender")
    values = payload.model_dump(mode="json")
    values.pop("email_consent")
    values["consentEmail"] = service.email_fingerprint(recipient) if recipient else None
    values["consentAt"] = now if recipient else None
    values["consentVersion"] = 1 if recipient else None
    return values


@router.get("/status")
async def status(user: dict = Depends(get_current_user)):
    user_id = identity(user)
    heartbeat = await db["reminderWorkerState"].find_one({"_id": "heartbeat"})
    return {"email_ready": email_ready(), "recipient": await verified_recipient(user_id),
            "worker_online": bool(heartbeat and aware(heartbeat["at"]) > utcnow() - timedelta(seconds=90)),
            "generic_preview": "You have a scheduled reminder. Sign in to MedAssist to view it."}


@router.post("/preview")
async def preview(payload: ReminderInput, user: dict = Depends(get_current_user)):
    identity(user)
    return {"occurrences": next_preview(payload.model_dump(mode="json"), utcnow())}


@router.get("")
async def list_schedules(user: dict = Depends(get_current_user)):
    rows = await db["medicationReminders"].find({"userId": identity(user)}).sort("createdAt", -1).to_list(length=50)
    return {"schedules": [service.public_schedule(row) for row in rows]}


@router.post("")
async def create(payload: CreateReminder, user: dict = Depends(get_current_user)):
    user_id, now = identity(user), utcnow()
    key = sha256(f'{user_id}:{payload.request_id}'.encode()).hexdigest()
    request_hash = sha256(payload.schedule.model_dump_json().encode()).hexdigest()
    old = await db["medicationReminders"].find_one({"_id": key, "userId": user_id})
    if old:
        if old.get("requestHash") != request_hash:
            raise HTTPException(409, "This request was already saved with different values; refresh")
        return service.public_schedule(old)
    if await db["medicationReminders"].count_documents({"userId": user_id}) >= 50:
        raise HTTPException(422, "This prototype supports up to 50 schedules per account")
    values = await schedule_values(payload.schedule, user_id, now)
    doc = {"_id": key, "userId": user_id, **values, "state": "active", "version": 1,
           "createdAt": now, "updatedAt": now, "effectiveFrom": now, "requestHash": request_hash}
    try:
        await db["medicationReminders"].insert_one(doc)
    except DuplicateKeyError:
        return service.public_schedule(await service.owned_schedule(key, user_id))
    await service.materialize(doc, now)
    return service.public_schedule(doc)


@router.patch("/{schedule_id}")
async def change(schedule_id: str, payload: ChangeReminder, user: dict = Depends(get_current_user)):
    user_id, now = identity(user), utcnow()
    old = await service.owned_schedule(schedule_id, user_id)
    if (payload.schedule is None) == (payload.state is None):
        raise HTTPException(422, "Choose either schedule edit or state change")
    values = await schedule_values(payload.schedule, user_id, now) if payload.schedule else {"state": payload.state}
    if payload.state == "active" and not next_preview(old, now):
        raise HTTPException(422, "Schedule has no future occurrences; edit it before resuming")
    if payload.state == "active" and old["email_enabled"]:
        recipient = await verified_recipient(user_id)
        if not recipient or service.email_fingerprint(recipient) != old.get("consentEmail"):
            raise HTTPException(422, "Edit the schedule to confirm email consent again")
    values.update({"effectiveFrom": now, "updatedAt": now, "generatedUntil": None})
    doc = await db["medicationReminders"].find_one_and_update(
        {"_id": schedule_id, "userId": user_id, "version": payload.version},
        {"$set": values, "$inc": {"version": 1}}, return_document=ReturnDocument.AFTER)
    if not doc:
        raise HTTPException(409, "Schedule changed; refresh before editing")
    await db["reminderOccurrences"].update_many(
        {"reminderId": schedule_id, "version": {"$lt": doc["version"]}, "dueAt": {"$gt": now}, "status": "pending"},
        {"$set": {"status": "cancelled", "delivery": "suppressed", "reason": "schedule_changed"}})
    await service.materialize(doc, now)
    return service.public_schedule(doc)


@router.get("/occurrences")
async def occurrences(day: date, user: dict = Depends(get_current_user)):
    user_id, now = identity(user), utcnow()
    if not now.date() - timedelta(days=31) <= day <= now.date() + timedelta(days=2):
        raise HTTPException(422, "Choose a date in the last 30 days, today or tomorrow")
    await service.materialize_user(user_id, now)
    rows = await db["reminderOccurrences"].find({"userId": user_id, "localDate": day.isoformat()}).sort("dueAt", 1).to_list(length=500)
    return {"occurrences": [service.public_occurrence(row, now) for row in rows]}


@router.get("/summary")
async def summary(user: dict = Depends(get_current_user)):
    user_id, now = identity(user), utcnow()
    await service.materialize_user(user_id, now)
    count = await db["reminderOccurrences"].count_documents(
        {"userId": user_id, "status": "pending", "effectiveAt": {"$lte": now}, "dueAt": {"$gte": now - timedelta(days=30)}})
    return {"due_count": count}


@router.post("/occurrences/{occurrence_id}/action")
async def act(occurrence_id: str, payload: OccurrenceAction, user: dict = Depends(get_current_user)):
    user_id, now = identity(user), utcnow()
    events = db["reminderOccurrences"]
    old = await events.find_one({"_id": occurrence_id, "userId": user_id})
    if not old:
        raise HTTPException(404, "Occurrence not found")
    request_id = str(payload.request_id)
    if any(h.get("requestId") == request_id for h in old.get("history", [])):
        return service.public_occurrence(old, now)
    if aware(old["dueAt"]) > now or old["status"] in ("cancelled", "time_skipped"):
        raise HTTPException(422, "Only a due occurrence can be recorded")
    values = {"status": payload.action}
    if payload.action == "snooze":
        schedule = await service.owned_schedule(old["reminderId"], user_id)
        if old["snoozed"] or old["status"] != "pending" or schedule["state"] != "active" or schedule["version"] != old["version"]:
            raise HTTPException(422, "Snooze is available once on an active, unconfirmed occurrence")
        until = now + timedelta(minutes=10)
        following = next_preview(schedule, now, 1)
        if following and aware(datetime.fromisoformat(following[0]["due_at"])) <= until:
            raise HTTPException(422, "Snooze would overlap the next scheduled occurrence")
        values = {"snoozed": True, "effectiveAt": until, "delivery": "pending", "round": old["round"] + 1,
                  "attempts": 0, "reason": "", "retryAt": until}
    elif old["delivery"] in ("pending", "failed", "claimed"):
        values.update({"delivery": "suppressed", "reason": "user_recorded_action"})
    query = {"_id": occurrence_id, "userId": user_id, "actionVersion": payload.version}
    if payload.action == "snooze":
        query["delivery"] = {"$nin": ["claimed", "submitting"]}
    result = await events.find_one_and_update(query,
        {"$set": values, "$inc": {"actionVersion": 1}, "$push": {"history": {"$each": [
            {"action": payload.action, "at": now, "requestId": request_id}], "$slice": -20}}},
        return_document=ReturnDocument.AFTER)
    if not result:
        raise HTTPException(409, "Occurrence changed or email submission is in progress; refresh and retry")
    return service.public_occurrence(result, now)
