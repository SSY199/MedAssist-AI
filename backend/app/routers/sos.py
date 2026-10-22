"""Authenticated, user-activated SOS. One latest incident per account.

Atomic Mongo claims prevent duplicate submissions across workers. A crashed
sender becomes unknown, never automatically re-sent. No health/message snapshot
is persisted; only contact, location and event metadata are retained.
"""
import asyncio
import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.db import db
from app.core.security import get_current_user
from app.services.sos_email import email_ready, send_alert

router = APIRouter(prefix="/sos", tags=["sos"])
FIELDS = {"age": "Age", "chronicIllnesses": "Conditions",
          "allergies": "Allergies", "currentMedications": "Medications"}
EMAIL = re.compile(r"^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$")


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=1000000)
    capturedAt: datetime


class PreviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    location: Location | None = None
    manualLocation: str = Field(default="", max_length=300)
    fields: list[Literal["age", "chronicIllnesses", "allergies", "currentMedications"]] = Field(default_factory=list, max_length=4)


class Activation(PreviewInput):
    requestId: UUID
    previewHash: str = Field(pattern=r"^[a-f0-9]{64}$")
    confirmed: Literal[True]


def now():
    return datetime.now(timezone.utc)


def stamp(value):
    return value.isoformat() if isinstance(value, datetime) else value


def public(doc):
    if not doc:
        return None
    return {key: stamp(value) for key, value in doc.items() if key != "_id"}


async def latest(user_id):
    # No health data is stored here. _id provides a built-in unique per-user lock.
    collection = db["sosIncidents"]
    await collection.update_one(
        {"_id": user_id, "emailStatus": "sending", "lastAttemptAt": {"$lt": now() - timedelta(minutes=2)}},
        {"$set": {"emailStatus": "unknown", "statusAt": now()}},
    )
    return await collection.find_one({"_id": user_id})


async def preview_data(data, user):
    profile = await db["patientProfiles"].find_one({"userId": user["sub"]}) or {}
    recipient = str(profile.get("emergencyContactEmail", "")).strip()
    if len(recipient) > 254 or not EMAIL.fullmatch(recipient):
        raise HTTPException(400, "Save a valid emergency contact email in your profile first.")
    name = str(profile.get("emergencyContactName", "")).strip()[:100]
    location = data.location
    if location:
        captured = location.capturedAt
        if captured.tzinfo is None or abs((now() - captured).total_seconds()) > 600:
            raise HTTPException(400, "Refresh your location; the snapshot is older than 10 minutes.")
        location_text = (f"https://www.google.com/maps/search/?api=1&query={location.lat},{location.lng}"
                         f"\nAccuracy: approximately {round(location.accuracy)} m. Captured: {captured.isoformat()}")
    else:
        location_text = data.manualLocation.strip() or "Location unavailable. Please contact the person directly."
    lines = ["MedAssist SOS", "Your saved emergency contact has activated SOS and is asking for help.",
             f"Person: {str(user.get('name') or user.get('email') or 'MedAssist user')[:200]}",
             f"Location: {location_text}", "", "Self-recorded health summary (not verified medical advice):"]
    for key in dict.fromkeys(data.fields):
        value = profile.get(key)
        text = ", ".join(str(item)[:150] for item in value[:15]) if isinstance(value, list) else str(value or "Not provided")
        lines.append(f"{FIELDS[key]}: {text[:2000] or 'Not provided'}")
    if not data.fields:
        lines.append("Not shared.")
    lines.extend(["", "Please try contacting them. If emergency help is needed in India, call 112.",
                  "This email does not dispatch an ambulance. Delivery and reading are not guaranteed."])
    body = "\n".join(lines)
    digest = hashlib.sha256((recipient + "\n" + body).encode()).hexdigest()
    return {"recipient": recipient, "contactName": name, "message": body,
            "previewHash": digest, "emailReady": email_ready()}


@router.post("/preview")
async def preview(data: PreviewInput, user: dict = Depends(get_current_user)):
    return await preview_data(data, user)


@router.get("/current")
async def current(user: dict = Depends(get_current_user)):
    return {"incident": public(await latest(user["sub"])), "emailReady": email_ready()}


async def deliver(doc, body):
    result = await asyncio.to_thread(send_alert, doc["recipient"], body, doc["incidentId"])
    await db["sosIncidents"].update_one(
        {"_id": doc["_id"], "incidentId": doc["incidentId"], "emailStatus": "sending"},
        {"$set": {"emailStatus": result, "statusAt": now()}},
    )
    return {"incident": public(await latest(doc["_id"]))}


@router.post("/activate")
async def activate(data: Activation, user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    old = await latest(user_id)
    if old and (old["incidentId"] == str(data.requestId) or not old.get("endedAt")):
        return {"incident": public(old)}
    details = await preview_data(data, user)
    if details["previewHash"] != data.previewHash:
        raise HTTPException(409, "Profile or sharing details changed. Review the updated preview.")
    created = now()
    doc = {"_id": user_id, "incidentId": str(data.requestId), "recipient": details["recipient"],
           "contactName": details["contactName"], "createdAt": created,
           "lastAttemptAt": created, "statusAt": created, "endedAt": None,
           "emailStatus": "sending", "attempts": 1,
           "location": data.location.model_dump(mode="json") if data.location else None,
           "manualLocation": data.manualLocation.strip(), "sharedFields": data.fields,
           "previewHash": data.previewHash}
    collection = db["sosIncidents"]
    if old:
        replaced = await collection.replace_one(
            {"_id": user_id, "incidentId": old["incidentId"], "endedAt": {"$ne": None},
             "lastAttemptAt": {"$lte": created - timedelta(seconds=60)}}, doc)
        if not replaced.modified_count:
            raise HTTPException(429, "Wait one minute after the previous attempt before activating again.")
    else:
        try:
            await collection.insert_one(doc)
        except DuplicateKeyError:
            return {"incident": public(await latest(user_id))}
    return await deliver(doc, details["message"])


@router.post("/{incident_id}/retry")
async def retry(incident_id: UUID, data: Activation, user: dict = Depends(get_current_user)):
    details = await preview_data(data, user)
    if details["previewHash"] != data.previewHash:
        raise HTTPException(409, "Review the updated sharing preview.")
    doc = await db["sosIncidents"].find_one_and_update(
        {"_id": user["sub"], "incidentId": str(incident_id), "endedAt": None,
         "emailStatus": "failed", "attempts": {"$lt": 3},
         "lastAttemptAt": {"$lte": now() - timedelta(seconds=60)}},
        {"$set": {"emailStatus": "sending", "lastAttemptAt": now(), "statusAt": now(),
                  "recipient": details["recipient"], "contactName": details["contactName"],
                  "location": data.location.model_dump(mode="json") if data.location else None,
                  "manualLocation": data.manualLocation.strip(), "sharedFields": data.fields,
                  "previewHash": data.previewHash}, "$inc": {"attempts": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(409, "Retry unavailable. Only failed active alerts can retry, after 60 seconds, up to three attempts.")
    return await deliver(doc, details["message"])


@router.post("/{incident_id}/end")
async def end(incident_id: UUID, user: dict = Depends(get_current_user)):
    doc = await db["sosIncidents"].find_one_and_update(
        {"_id": user["sub"], "incidentId": str(incident_id), "endedAt": None},
        {"$set": {"endedAt": now()}}, return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(404, "Active SOS not found.")
    return {"incident": public(doc)}
