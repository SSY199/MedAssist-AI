"""Persistent schedule/occurrence operations, shared by API and standalone worker."""
from datetime import date, timedelta
from hashlib import sha256
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.db import db
from app.services.reminder_schedule import aware, occurrence_id, slots, utcnow


def email_fingerprint(email):
    return sha256(email.strip().lower().encode()).hexdigest()


async def setup_indexes():
    # Only this feature's new collections. No existing collections are migrated.
    await db["medicationReminders"].create_index([("userId", ASCENDING)])
    await db["reminderOccurrences"].create_index([("userId", 1), ("localDate", 1)])
    await db["reminderOccurrences"].create_index([("reminderId", 1), ("version", 1), ("effectiveAt", 1)])
    await db["reminderOccurrences"].create_index([("delivery", 1), ("effectiveAt", 1)])


async def owned_schedule(schedule_id, user_id):
    doc = await db["medicationReminders"].find_one({"_id": schedule_id, "userId": user_id})
    if not doc:
        raise HTTPException(404, "Reminder not found")
    return doc


async def materialize(schedule, now=None):
    now = now or utcnow()
    if schedule["state"] != "active":
        return
    today = now.astimezone(ZoneInfo(schedule["timezone"])).date()
    last = today + timedelta(days=1)
    marker = schedule.get("generatedUntil")
    if marker and date.fromisoformat(marker) >= last:
        return
    first = max(today - timedelta(days=30),
                date.fromisoformat(marker) + timedelta(days=1) if marker else
                aware(schedule["effectiveFrom"]).astimezone(ZoneInfo(schedule["timezone"])).date())
    for day, clock, instant, gap in slots(schedule, first, last):
        if instant < aware(schedule["effectiveFrom"]):
            continue
        row = {
            "userId": schedule["userId"], "reminderId": schedule["_id"],
            "version": schedule["version"], "medicine": schedule["medicine"],
            "instructions": schedule["instructions"], "timezone": schedule["timezone"],
            "localDate": day.isoformat(), "localTime": clock, "dueAt": instant,
            "effectiveAt": instant, "status": "time_skipped" if gap else "pending",
            "delivery": "suppressed" if gap else "pending", "reason": "clock_change" if gap else "",
            "actionVersion": 1, "snoozed": False, "round": 0, "attempts": 0, "history": [],
        }
        try:
            await db["reminderOccurrences"].update_one(
                {"_id": occurrence_id(schedule, day, clock)}, {"$setOnInsert": row}, upsert=True)
        except DuplicateKeyError:
            pass
    current = await db["medicationReminders"].find_one(
        {"_id": schedule["_id"], "version": schedule["version"], "state": "active"})
    if not current:
        await db["reminderOccurrences"].update_many(
            {"reminderId": schedule["_id"], "version": schedule["version"], "dueAt": {"$gt": now}, "status": "pending"},
            {"$set": {"status": "cancelled", "delivery": "suppressed", "reason": "schedule_changed"}})
        return
    await db["medicationReminders"].update_one(
        {"_id": schedule["_id"], "version": schedule["version"], "state": "active"},
        {"$set": {"generatedUntil": last.isoformat()}})


async def materialize_user(user_id, now=None):
    rows = await db["medicationReminders"].find({"userId": user_id, "state": "active"}).to_list(length=50)
    for schedule in rows:
        await materialize(schedule, now)


def public_schedule(doc):
    keys = ["medicine", "instructions", "timezone", "recurrence", "times", "weekdays",
            "start_date", "end_date", "email_enabled", "state", "version"]
    return {"id": doc["_id"], **{key: doc.get(key) for key in keys}}


def public_occurrence(doc, now):
    keys = ["medicine", "instructions", "timezone", "localDate", "localTime", "status",
            "delivery", "reason", "actionVersion", "snoozed", "history"]
    result = {"id": doc["_id"], "reminder_id": doc["reminderId"], **{key: doc.get(key) for key in keys}}
    result["dueAt"] = aware(doc["dueAt"]).isoformat()
    result["effectiveAt"] = aware(doc["effectiveAt"]).isoformat()
    result["overdue"] = doc["status"] == "pending" and aware(doc["effectiveAt"]) <= now
    for public_key, stored_key in (("workerPickedAt", "claimedAt"), ("emailSubmittedAt", "submittingAt"), ("emailFinishedAt", "finishedAt")):
        result[public_key] = aware(doc[stored_key]).isoformat() if doc.get(stored_key) else None
    result["history"] = [{"action": h["action"], "at": aware(h["at"]).isoformat()} for h in doc.get("history", [])]
    return result


async def reserve_quota(user_id, now):
    # Conservative shared-sender budget leaves room for SOS. Failed reservations
    # can consume partial capacity; they never increase the sending allowance.
    keys = [("global-hour:" + now.strftime("%Y%m%d%H"), 20),
            ("global-day:" + now.strftime("%Y%m%d"), 100),
            ("user-hour:" + user_id + now.strftime("%Y%m%d%H"), 6),
            ("user-day:" + user_id + now.strftime("%Y%m%d"), 30)]
    for key, cap in keys:
        try:
            await db["reminderWorkerState"].update_one(
                {"_id": key, "count": {"$lt": cap}},
                {"$inc": {"count": 1}, "$setOnInsert": {"createdAt": now}}, upsert=True)
        except DuplicateKeyError:
            return False
    return True


async def worker_tick(now=None, sender=None):
    import asyncio
    from app.services.reminder_email import email_ready, send_reminder, verified_recipient
    now = now or utcnow()
    sender = sender or send_reminder
    events = db["reminderOccurrences"]
    # Claimed-but-not-submitting work can safely be reclaimed. Once submission
    # begins, a crash is ambiguous and must never automatically resend.
    await events.update_many({"delivery": "claimed", "claimedAt": {"$lt": now - timedelta(minutes=2)}},
                             {"$set": {"delivery": "pending"}})
    await events.update_many({"delivery": "submitting", "claimedAt": {"$lt": now - timedelta(minutes=2)}},
                             {"$set": {"delivery": "unknown", "reason": "submission_interrupted"}})
    schedules = db["medicationReminders"].find({"state": "active"}).sort("_id", 1)
    async for schedule in schedules:
        await materialize(schedule, now)
        scope = {"reminderId": schedule["_id"], "version": schedule["version"], "status": "pending"}
        await events.update_many({**scope, "effectiveAt": {"$lt": now - timedelta(minutes=30)},
                                  "delivery": {"$in": ["pending", "failed"]}},
                                 {"$set": {"delivery": "suppressed", "reason": "late_window_expired"}})
        due = await events.find_one({"reminderId": schedule["_id"], "version": schedule["version"], "status": {"$ne": "cancelled"}, "effectiveAt": {"$lte": now, "$gte": now - timedelta(minutes=30)}},
                                    sort=[("effectiveAt", -1)])
        if not due:
            continue
        # Only newest due occurrence per schedule is eligible, including when it
        # was already accepted or acted upon; older queued work cannot replay.
        await events.update_many({**scope, "effectiveAt": {"$lt": due["effectiveAt"]},
                                  "delivery": {"$in": ["pending", "failed"]}},
                                 {"$set": {"delivery": "suppressed", "reason": "newer_occurrence"}})
        if due["status"] != "pending" or not schedule["email_enabled"] or not email_ready():
            continue
        if due["delivery"] not in ("pending", "failed") or due.get("attempts", 0) >= 2:
            continue
        if due.get("retryAt") and aware(due["retryAt"]) > now:
            continue
        token = str(uuid4())
        claimed = await events.find_one_and_update(
            {"_id": due["_id"], "status": "pending", "delivery": due["delivery"],
             "round": due["round"], "actionVersion": due["actionVersion"]},
            {"$set": {"delivery": "claimed", "claim": token, "claimedAt": now}, "$inc": {"attempts": 1}},
            return_document=ReturnDocument.AFTER)
        if not claimed:
            continue
        claim = {"_id": due["_id"], "claim": token, "round": due["round"], "delivery": "claimed"}
        current = await db["medicationReminders"].find_one({"_id": schedule["_id"], "version": schedule["version"],
                                                          "state": "active", "email_enabled": True})
        recipient = await verified_recipient(schedule["userId"]) if current else None
        if not current or not recipient or email_fingerprint(recipient) != current.get("consentEmail"):
            await events.update_one(claim, {"$set": {"delivery": "suppressed", "reason": "consent_or_account_changed"}})
            continue
        if not await reserve_quota(schedule["userId"], now):
            await events.update_one(claim, {"$set": {"delivery": "suppressed", "reason": "sender_budget"}})
            continue
        fresh = await db["medicationReminders"].find_one(
            {"_id": schedule["_id"], "version": schedule["version"], "state": "active", "email_enabled": True})
        if not fresh or fresh.get("consentEmail") != current.get("consentEmail"):
            await events.update_one(claim, {"$set": {"delivery": "suppressed", "reason": "schedule_changed"}})
            continue
        # Fresh occurrence action check immediately before crossing SMTP boundary.
        ready = await events.find_one_and_update({**claim, "status": "pending"},
                    {"$set": {"delivery": "submitting", "submittingAt": utcnow()}}, return_document=ReturnDocument.AFTER)
        if not ready:
            continue
        outcome = await asyncio.to_thread(sender, recipient, f'{due["_id"]}-{due["round"]}')
        await events.update_one({"_id": due["_id"], "claim": token, "round": due["round"], "delivery": "submitting"},
            {"$set": {"delivery": outcome, "finishedAt": utcnow(), "retryAt": now + timedelta(minutes=1),
                      "reason": "" if outcome == "accepted" else "provider_" + outcome}})
    await db["reminderWorkerState"].update_one({"_id": "heartbeat"},
        {"$set": {"at": utcnow(), "email_ready": email_ready()}}, upsert=True)
