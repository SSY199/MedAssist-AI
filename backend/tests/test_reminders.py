"""Frozen-clock synthetic schedules; all Mongo and email effects are mocked."""
import asyncio
import copy
import unittest
from datetime import datetime, timedelta, timezone, date
from unittest.mock import patch, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from app.routers import reminders as api
from app.services import reminders as service, reminder_email as mail
from app.services.reminder_schedule import ReminderInput, next_preview, local_instant, slots, aware

NOW = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)


def matches(doc, query):
    for key, expected in query.items():
        actual = doc.get(key)
        if isinstance(expected, dict):
            for op, operand in expected.items():
                if op == "$lt" and not (actual is not None and actual < operand): return False
                if op == "$lte" and not (actual is not None and actual <= operand): return False
                if op == "$gt" and not (actual is not None and actual > operand): return False
                if op == "$gte" and not (actual is not None and actual >= operand): return False
                if op == "$in" and actual not in operand: return False
                if op == "$nin" and actual in operand: return False
                if op == "$ne" and actual == operand: return False
        elif actual != expected:
            return False
    return True


class Cursor:
    def __init__(self, docs): self.docs = copy.deepcopy(docs)
    def sort(self, key, direction):
        self.docs.sort(key=lambda row: row.get(key), reverse=direction == -1)
        return self
    async def to_list(self, length): return self.docs[:length] if length else self.docs
    def __aiter__(self): self.position = 0; return self
    async def __anext__(self):
        if self.position >= len(self.docs): raise StopAsyncIteration
        row = self.docs[self.position]; self.position += 1; return row


class MemoryCollection:
    def __init__(self): self.docs = {}
    async def create_index(self, fields): return "synthetic_index"
    def find(self, query, *args): return Cursor([r for r in self.docs.values() if matches(r, query)])
    async def find_one(self, query, sort=None):
        await asyncio.sleep(0)
        rows = [r for r in self.docs.values() if matches(r, query)]
        if sort:
            for key, direction in reversed(sort): rows.sort(key=lambda row: row[key], reverse=direction == -1)
        return copy.deepcopy(rows[0]) if rows else None
    async def count_documents(self, query): return len([r for r in self.docs.values() if matches(r, query)])
    async def insert_one(self, doc):
        if doc["_id"] in self.docs: raise DuplicateKeyError("synthetic duplicate")
        self.docs[doc["_id"]] = copy.deepcopy(doc)
    def apply(self, row, update, inserting=False):
        if inserting: row.update(copy.deepcopy(update.get("$setOnInsert", {})))
        row.update(copy.deepcopy(update.get("$set", {})))
        for key, amount in update.get("$inc", {}).items(): row[key] = row.get(key, 0) + amount
        for key, value in update.get("$push", {}).items():
            row.setdefault(key, []).extend(copy.deepcopy(value["$each"]))
            if "$slice" in value: row[key] = row[key][value["$slice"]:]
    async def find_one_and_update(self, query, update, **kwargs):
        await asyncio.sleep(0)
        for row in self.docs.values():
            if matches(row, query):
                self.apply(row, update)
                return copy.deepcopy(row)
        return None
    async def update_one(self, query, update, upsert=False):
        result = await self.find_one_and_update(query, update)
        if result is None and upsert:
            key = query["_id"]
            if key in self.docs: raise DuplicateKeyError("synthetic duplicate")
            row = {k:v for k,v in query.items() if not isinstance(v, dict)}
            self.apply(row, update, True); self.docs[key] = row
    async def update_many(self, query, update):
        await asyncio.sleep(0)
        for row in self.docs.values():
            if matches(row, query): self.apply(row, update)


class MemoryDB(dict):
    def __missing__(self, key): self[key] = MemoryCollection(); return self[key]


def draft(**changes):
    return {"medicine":"Synthetic tablet", "instructions":"Synthetic prescribed label", "timezone":"UTC",
            "recurrence":"daily", "times":["10:01"], "weekdays":[], "start_date":"2026-01-15",
            "end_date":None, "email_enabled":False, "email_consent":False, **changes}


def schedule(**changes):
    return {"_id":"synthetic-reminder", "userId":"synthetic-a", **draft(email_enabled=True, email_consent=True),
            "state":"active", "version":1, "effectiveFrom":NOW-timedelta(hours=3),
            "consentEmail":service.email_fingerprint("synthetic@example.invalid"), "createdAt":NOW, **changes}


class CalendarTests(unittest.TestCase):
    def test_validation_rejects_duplicates_invalid_dates_timezones_and_consent(self):
        for changes in [{"times":["10:00","10:00"]}, {"times":["25:10"]}, {"medicine":"   "},
                        {"timezone":"Invalid/Zone"}, {"recurrence":"weekdays"}, {"weekdays":[1]},
                        {"end_date":"2026-01-01"}, {"start_date":"9999-01-01"},
                        {"email_enabled":True}, {"recurrence":"once", "times":["10:00","11:00"]}]:
            with self.subTest(changes=changes), self.assertRaises(ValidationError): ReminderInput.model_validate(draft(**changes))
    def test_midnight_weekdays_and_inclusive_end(self):
        data = draft(recurrence="weekdays", weekdays=[3,4], times=["00:00"], end_date="2026-01-16")
        values = list(slots(data,date(2026,1,14),date(2026,1,18)))
        self.assertEqual([v[0].isoformat() for v in values],["2026-01-15","2026-01-16"])
    def test_dst_gap_and_overlap(self):
        _,gap = local_instant(date(2026,3,8),"02:30","America/New_York")
        self.assertTrue(gap)
        instant,gap = local_instant(date(2026,11,1),"01:30","America/New_York")
        self.assertFalse(gap); self.assertEqual(instant.hour,5)
        with self.assertRaises(ValidationError): ReminderInput.model_validate(draft(recurrence="once", timezone="America/New_York", start_date="2026-03-08", times=["02:30"]))
    def test_legacy_records_do_not_invent_submission_timestamps(self):
        event={"_id":"synthetic-old", "reminderId":"synthetic-reminder", "dueAt":NOW,
               "effectiveAt":NOW,"status":"pending", "delivery":"accepted", "history":[],
               "claimedAt":NOW.replace(tzinfo=None)}
        public=service.public_occurrence(event,NOW)
        self.assertEqual(public["workerPickedAt"],NOW.isoformat())
        self.assertIsNone(public["emailSubmittedAt"])
        self.assertIsNone(public["emailFinishedAt"])

    def test_future_preview_converts_timezone_and_skips_past(self):
        values = next_preview(draft(timezone="Asia/Kolkata", times=["15:31"]),NOW,1)
        self.assertEqual(values[0]["due_at"],"2026-01-15T10:01:00+00:00")
        self.assertEqual(aware(NOW.replace(tzinfo=None)), NOW)


class ReminderRoutes(unittest.TestCase):
    def setUp(self):
        self.db = MemoryDB(); self.user = {"sub":"synthetic-a"}
        self.db["user"].docs["synthetic-a"] = {"_id":"synthetic-a", "email":"synthetic@example.invalid", "emailVerified":True}
        self.patches = [patch.object(module,"db",self.db) for module in [api,service,mail]]
        self.patches += [patch.object(api,"utcnow",return_value=NOW), patch.object(service,"utcnow",return_value=NOW), patch.object(api,"email_ready",return_value=True)]
        for p in self.patches: p.start()
        self.app = FastAPI(); self.app.include_router(api.router)
        self.app.dependency_overrides[api.get_current_user] = lambda:self.user
        self.client = TestClient(self.app)
    def tearDown(self):
        self.client.close()
        for p in reversed(self.patches): p.stop()
    def create(self, **changes):
        return self.client.post('/reminders',json={"request_id":str(uuid4()),"schedule":draft(**changes)})
    def seed_due(self, **changes):
        row=schedule(**changes); self.db["medicationReminders"].docs[row["_id"]]=row
        asyncio.run(service.materialize(row,NOW))
        return row
    def test_all_routes_protected(self):
        self.app.dependency_overrides.clear()
        for method,path in [("GET",""),("GET","/status"),("GET","/summary"),("GET","/occurrences?day=2026-01-15"),("POST","/preview"),("PATCH","/x"),("POST","/occurrences/x/action")]:
            self.assertIn(self.client.request(method,'/reminders'+path).status_code,(401,403))
    def test_create_idempotent_preview_and_no_private_fields(self):
        body={"request_id":str(uuid4()),"schedule":draft()}
        first=self.client.post('/reminders',json=body); self.assertEqual(first.status_code,200)
        self.assertEqual(self.client.post('/reminders',json=body).json()["id"],first.json()["id"])
        body["schedule"]["medicine"]="Different synthetic label"
        self.assertEqual(self.client.post('/reminders',json=body).status_code,409)
        self.assertNotIn("userId",first.json()); self.assertNotIn("consentEmail",first.json())
        self.assertEqual(self.client.post('/reminders/preview',json=draft()).status_code,200)
        self.assertEqual(self.create(recurrence="once",times=["09:59"]).status_code,422)
    def test_email_only_verified_own_account_and_explicit_consent(self):
        self.assertEqual(self.create(email_enabled=True,email_consent=False).status_code,422)
        self.assertEqual(self.create(email_enabled=True,email_consent=True).status_code,200)
        self.db["user"].docs["synthetic-a"]["emailVerified"]=False
        self.assertEqual(self.create(email_enabled=True,email_consent=True).status_code,422)
        self.assertEqual(self.create(recipient="other@example.invalid").status_code,422)
    def test_account_isolation_read_edit_action(self):
        row=self.seed_due(times=["09:59"])
        event=next(iter(self.db["reminderOccurrences"].docs.values()))
        self.user={"sub":"synthetic-b"}
        self.assertEqual(self.client.get('/reminders').json()["schedules"],[])
        self.assertEqual(self.client.get('/reminders/occurrences?day=2026-01-15').json()["occurrences"],[])
        self.assertEqual(self.client.patch('/reminders/'+row["_id"],json={"version":1,"state":"paused"}).status_code,404)
        self.assertEqual(self.client.post('/reminders/occurrences/'+event["_id"]+'/action',json={"version":1,"action":"taken","request_id":str(uuid4())}).status_code,404)
    def test_pause_cancels_future_and_version_conflicts(self):
        row=self.create().json()
        response=self.client.patch('/reminders/'+row["id"],json={"version":1,"state":"paused"})
        self.assertEqual(response.status_code,200)
        self.assertTrue(all(e["status"]=="cancelled" for e in self.db["reminderOccurrences"].docs.values()))
        self.assertEqual(self.client.patch('/reminders/'+row["id"],json={"version":1,"state":"active"}).status_code,409)
        self.assertEqual(self.client.patch('/reminders/'+row["id"],json={"version":2,"state":"active"}).status_code,200)
    def test_actions_snooze_idempotency_history_and_correction(self):
        self.seed_due(times=["09:59"])
        event=next(e for e in self.db["reminderOccurrences"].docs.values() if e["dueAt"]<NOW)
        url='/reminders/occurrences/'+event["_id"]+'/action'
        event.update(delivery="accepted",claimedAt=NOW,submittingAt=NOW,finishedAt=NOW)
        payload={"version":1,"action":"snooze","request_id":str(uuid4())}
        result=self.client.post(url,json=payload); self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()["effectiveAt"],(NOW+timedelta(minutes=10)).isoformat())
        self.assertIsNone(result.json()["workerPickedAt"])
        self.assertIsNone(result.json()["emailFinishedAt"])
        self.assertEqual(self.client.post(url,json=payload).status_code,200)
        self.assertEqual(self.client.post(url,json={**payload,"version":2,"request_id":str(uuid4())}).status_code,422)
        taken=self.client.post(url,json={"version":2,"action":"taken","request_id":str(uuid4())})
        self.assertEqual(taken.status_code,200)
        skipped=self.client.post(url,json={"version":3,"action":"skipped","request_id":str(uuid4())})
        self.assertEqual(skipped.json()["status"],"skipped"); self.assertEqual(len(skipped.json()["history"]),3)
    def test_snooze_next_time_overlap_and_submission_blocked(self):
        self.seed_due(times=["09:59","10:05"])
        event=next(e for e in self.db["reminderOccurrences"].docs.values() if e["dueAt"]<NOW)
        body={"version":1,"action":"snooze","request_id":str(uuid4())}; path='/reminders/occurrences/'+event["_id"]+'/action'
        self.assertEqual(self.client.post(path,json=body).status_code,422)
        self.db["medicationReminders"].docs[event["reminderId"]]["times"]=["09:59"]
        event["delivery"]="submitting"
        self.assertEqual(self.client.post(path,json=body).status_code,409)
    def test_create_worker_email_and_taken_flow(self):
        created=self.create(recurrence="once",email_enabled=True,email_consent=True)
        self.assertEqual(created.status_code,200)
        sent=[]
        later=NOW+timedelta(minutes=2)
        with patch.object(mail,"email_ready",return_value=True):
            asyncio.run(service.worker_tick(later,lambda recipient,key: sent.append(key) or "accepted"))
        self.assertEqual(len(sent),1)
        with patch.object(api,"utcnow",return_value=later):
            row=self.client.get('/reminders/occurrences?day=2026-01-15').json()["occurrences"][0]
            self.assertEqual(row["delivery"],"accepted")
            result=self.client.post('/reminders/occurrences/'+row["id"]+'/action',json={"version":row["actionVersion"],"action":"taken","request_id":str(uuid4())})
            self.assertEqual(result.json()["status"],"taken")
            self.assertEqual(self.client.get('/reminders/occurrences?day=2026-01-15').json()["occurrences"][0]["status"],"taken")

    def test_day_bounds_and_failed_writes(self):
        self.assertEqual(self.client.get('/reminders/occurrences?day=2000-01-01').status_code,422)
        with patch.object(self.db["medicationReminders"],"insert_one",side_effect=RuntimeError("synthetic failure")):
            with TestClient(self.app,raise_server_exceptions=False) as client:
                self.assertEqual(client.post('/reminders',json={"request_id":str(uuid4()),"schedule":draft()}).status_code,500)


class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db=MemoryDB(); self.sent=[]
        self.patches=[patch.object(module,"db",self.db) for module in [service,mail]]
        self.patches += [patch.object(mail,"email_ready",return_value=True),patch.object(service,"utcnow",return_value=NOW)]
        for p in self.patches:p.start()
        self.db["user"].docs["synthetic-a"]={"_id":"synthetic-a","email":"synthetic@example.invalid","emailVerified":True}
    async def asyncTearDown(self):
        for p in reversed(self.patches):p.stop()
    def sender(self, recipient, key): self.sent.append(key); return "accepted"
    async def seed(self,**changes):
        row=schedule(**changes);self.db["medicationReminders"].docs[row["_id"]]=row
        await service.materialize(row,NOW);return row
    async def test_restart_and_two_workers_send_once(self):
        await self.seed(times=["09:59"])
        await asyncio.gather(service.worker_tick(NOW,self.sender),service.worker_tick(NOW,self.sender))
        await service.worker_tick(NOW,self.sender)
        self.assertEqual(len(self.sent),1)
        accepted=[e for e in self.db["reminderOccurrences"].docs.values() if e["delivery"]=="accepted"]
        self.assertEqual(accepted[0]["status"],"pending")
    async def test_worker_generates_and_dispatches_without_page_read(self):
        row=schedule(times=["09:59"])
        self.db["medicationReminders"].docs[row["_id"]]=row
        self.assertFalse(self.db["reminderOccurrences"].docs)
        await service.worker_tick(NOW,self.sender)
        self.assertEqual(len(self.sent),1)
        self.assertTrue(self.db["medicationReminders"].docs[row["_id"]]["generatedUntil"])

    async def test_submission_and_result_times_are_separate_from_due_time(self):
        await self.seed(times=["09:59"])
        with patch.object(service,"utcnow",side_effect=[NOW+timedelta(seconds=2),NOW+timedelta(seconds=5),NOW+timedelta(seconds=6)]):
            await service.worker_tick(NOW,self.sender)
        event=next(e for e in self.db["reminderOccurrences"].docs.values() if e["delivery"]=="accepted")
        public=service.public_occurrence(event,NOW)
        self.assertEqual(public["workerPickedAt"],NOW.isoformat())
        self.assertEqual(public["emailSubmittedAt"],(NOW+timedelta(seconds=2)).isoformat())
        self.assertEqual(public["emailFinishedAt"],(NOW+timedelta(seconds=5)).isoformat())
        self.assertNotEqual(public["dueAt"],public["emailFinishedAt"])

    async def test_only_latest_catchup_within_thirty_minutes(self):
        await self.seed(times=["09:00","09:40","09:50"])
        await service.worker_tick(NOW,self.sender)
        self.assertEqual(len(self.sent),1)
        due=[e for e in self.db["reminderOccurrences"].docs.values() if e["dueAt"]<=NOW]
        self.assertEqual(sorted(e["delivery"] for e in due),["accepted","suppressed","suppressed"])
    async def test_taken_latest_does_not_replay_older(self):
        await self.seed(times=["09:40","09:50"])
        latest=max((e for e in self.db["reminderOccurrences"].docs.values() if e["dueAt"]<=NOW),key=lambda e:e["dueAt"])
        latest["status"]="taken";latest["delivery"]="suppressed"
        await service.worker_tick(NOW,self.sender)
        self.assertFalse(self.sent)
    async def test_crashed_submission_unknown_but_claim_recoverable(self):
        await self.seed(times=["09:50"])
        event=next(e for e in self.db["reminderOccurrences"].docs.values() if e["dueAt"]<NOW)
        event.update(delivery="submitting",claimedAt=NOW-timedelta(minutes=3))
        await service.worker_tick(NOW,self.sender)
        self.assertEqual(event["delivery"],"unknown");self.assertFalse(self.sent)
        event.update(delivery="claimed",claimedAt=NOW-timedelta(minutes=3))
        await service.worker_tick(NOW,self.sender)
        self.assertEqual(len(self.sent),1)
    async def test_recipient_change_and_paused_schedule_never_send(self):
        row=await self.seed(times=["09:59"])
        self.db["user"].docs["synthetic-a"]["email"]="changed@example.invalid"
        await service.worker_tick(NOW,self.sender);self.assertFalse(self.sent)
        row["state"]="paused";self.db["user"].docs["synthetic-a"]["email"]="synthetic@example.invalid"
        await service.worker_tick(NOW,self.sender);self.assertFalse(self.sent)
    async def test_retry_bounded_and_unknown_not_retried(self):
        await self.seed(times=["09:59"])
        outcomes=[]
        def failed(*args):outcomes.append(1);return "failed"
        await service.worker_tick(NOW,failed)
        await service.worker_tick(NOW,failed)
        await service.worker_tick(NOW+timedelta(minutes=1),failed)
        await service.worker_tick(NOW+timedelta(minutes=2),failed)
        self.assertEqual(len(outcomes),2)
    async def test_pause_during_preparation_suppresses_send(self):
        row=await self.seed(times=["09:59"])
        async def reserve(*args):
            row["state"]="paused"
            return True
        with patch.object(service,"reserve_quota",side_effect=reserve):
            await service.worker_tick(NOW,self.sender)
        self.assertFalse(self.sent)

    async def test_sending_budget(self):
        for _ in range(6):self.assertTrue(await service.reserve_quota("synthetic-a",NOW))
        self.assertFalse(await service.reserve_quota("synthetic-a",NOW))
    async def test_materialize_survives_repeated_reads_and_gap_visible(self):
        row=await self.seed(times=["09:59"])
        count=len(self.db["reminderOccurrences"].docs)
        await service.materialize(row,NOW)
        self.assertEqual(len(self.db["reminderOccurrences"].docs),count)
        gap=schedule(_id="gap",timezone="America/New_York",start_date="2026-03-08",times=["02:30"],effectiveFrom=datetime(2026,3,8,tzinfo=timezone.utc))
        self.db["medicationReminders"].docs["gap"]=gap
        await service.materialize(gap,datetime(2026,3,8,12,tzinfo=timezone.utc))
        self.assertTrue(any(e["status"]=="time_skipped" for e in self.db["reminderOccurrences"].docs.values()))


class EmailTests(unittest.TestCase):
    def test_generic_content_and_tls_without_real_send(self):
        smtp=MagicMock();smtp.__enter__.return_value=smtp
        with patch.object(mail,"email_ready",return_value=True),patch.object(mail.smtplib,"SMTP",return_value=smtp):
            self.assertEqual(mail.send_reminder("synthetic@example.invalid","synthetic-id"),"accepted")
        message=smtp.send_message.call_args.args[0]
        self.assertEqual(message["Subject"],"MedAssist reminder")
        self.assertNotIn("Synthetic tablet",message.get_content())
        self.assertNotIn("dose",message.get_content())
        self.assertTrue(smtp.starttls.call_args.kwargs["context"].check_hostname)
    def test_ambiguous_submission_not_failed(self):
        smtp=MagicMock();smtp.__enter__.return_value=smtp;smtp.send_message.side_effect=TimeoutError()
        with patch.object(mail,"email_ready",return_value=True),patch.object(mail.smtplib,"SMTP",return_value=smtp):
            self.assertEqual(mail.send_reminder("synthetic@example.invalid","synthetic-id"),"unknown")
        with patch.object(mail,"email_ready",return_value=False):
            self.assertEqual(mail.send_reminder("synthetic@example.invalid","synthetic-id"),"failed")
