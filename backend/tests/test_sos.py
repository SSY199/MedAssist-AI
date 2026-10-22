"""Standard-library unittest; synthetic records, mocked MongoDB and SMTP only."""
import asyncio
import copy
import httpx
import unittest
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers import sos
from app.services import sos_email


def matches(doc, query):
    for key, value in query.items():
        actual = doc.get(key)
        if isinstance(value, dict):
            for op, operand in value.items():
                if op == "$lt" and not actual < operand: return False
                if op == "$lte" and not actual <= operand: return False
                if op == "$ne" and actual == operand: return False
        elif actual != value: return False
    return True


class MemoryCollection:
    def __init__(self): self.docs = []
    async def find_one(self, query):
        await asyncio.sleep(0)
        return next((copy.deepcopy(d) for d in self.docs if matches(d, query)), None)
    async def insert_one(self, doc):
        if any(d["_id"] == doc["_id"] for d in self.docs): raise sos.DuplicateKeyError("duplicate")
        self.docs.append(copy.deepcopy(doc))
    async def replace_one(self, query, doc):
        for i, old in enumerate(self.docs):
            if matches(old, query):
                self.docs[i] = copy.deepcopy(doc)
                return type("Result", (), {"modified_count": 1})()
        return type("Result", (), {"modified_count": 0})()
    async def update_one(self, query, update): await self.find_one_and_update(query, update)
    async def find_one_and_update(self, query, update, **kwargs):
        for doc in self.docs:
            if matches(doc, query):
                doc.update(copy.deepcopy(update.get("$set", {})))
                for key, value in update.get("$inc", {}).items(): doc[key] += value
                return copy.deepcopy(doc)
        return None


class SosRoutes(unittest.TestCase):
    def setUp(self):
        self.user = {"sub": "synthetic-a", "name": "Demo Patient"}
        self.profiles = MemoryCollection()
        self.profiles.docs = [{"userId": "synthetic-a", "emergencyContactEmail": "relative@example.com", "age": 30,
                               "allergies": ["Demo allergy"], "currentMedications": ["Private medicine"]}]
        self.incidents = MemoryCollection()
        patch.object(sos, "db", {"patientProfiles": self.profiles, "sosIncidents": self.incidents}).start()
        self.sender = patch.object(sos, "send_alert", return_value="accepted").start()
        patch.object(sos, "email_ready", return_value=True).start()
        self.addCleanup(patch.stopall)
        self.app = FastAPI(); self.app.include_router(sos.router)
        self.app.dependency_overrides[sos.get_current_user] = lambda: self.user
        self.client = TestClient(self.app); self.addCleanup(self.client.close)

    def body(self, **overrides):
        data = {"fields": ["age", "allergies"], "manualLocation": "Demo building", **overrides}
        preview = self.client.post("/sos/preview", json=data)
        self.assertEqual(preview.status_code, 200)
        return {**data, "requestId": str(uuid4()), "previewHash": preview.json()["previewHash"], "confirmed": True}
    def activate(self): return self.client.post("/sos/activate", json=self.body())

    def test_exact_preview_selected_fields_and_no_health_persistence(self):
        self.assertEqual(self.activate().status_code, 200)
        body = self.sender.call_args.args[1]
        self.assertIn("Demo allergy", body); self.assertNotIn("Private medicine", body)
        self.assertNotIn("message", self.incidents.docs[0]); self.assertNotIn("allergies", self.incidents.docs[0])
    def test_preview_and_read_never_send(self):
        self.body(); self.client.get("/sos/current"); self.sender.assert_not_called()
    def test_duplicate_activation_sends_once(self):
        data = self.body()
        first = self.client.post("/sos/activate", json=data).json()
        self.assertEqual(self.client.post("/sos/activate", json=data).json(), first)
        self.assertEqual(self.activate().json(), first); self.sender.assert_called_once()
    def test_changed_profile_rejected(self):
        data = self.body(); self.profiles.docs[0]["emergencyContactEmail"] = "changed@example.com"
        self.assertEqual(self.client.post("/sos/activate", json=data).status_code, 409); self.sender.assert_not_called()
    def test_invalid_email_coordinates_and_stale_location(self):
        for lat, time, code in [(91, sos.now(), 422), (0, sos.now() - timedelta(hours=1), 400)]:
            self.assertEqual(self.client.post("/sos/preview", json={"location": {"lat": lat, "lng": 0, "accuracy": 1, "capturedAt": time.isoformat()}}).status_code, code)
        self.profiles.docs[0]["emergencyContactEmail"] = "bad\r\nBcc:inject@example.com"
        self.assertEqual(self.client.post("/sos/preview", json={}).status_code, 400)
    def test_ownership_read_end_retry(self):
        incident = self.activate().json()["incident"]
        self.user = {"sub": "synthetic-b"}
        self.profiles.docs.append({"userId": "synthetic-b", "emergencyContactEmail": "other@example.com"})
        self.assertIsNone(self.client.get("/sos/current").json()["incident"])
        path = f'/sos/{incident["incidentId"]}'
        self.assertEqual(self.client.post(path + "/end").status_code, 404)
        self.assertEqual(self.client.post(path + "/retry", json=self.body()).status_code, 409)
        self.sender.assert_called_once()
    def test_retry_cooldown_and_limit(self):
        self.sender.return_value = "failed"; incident = self.activate().json()["incident"]
        path = f'/sos/{incident["incidentId"]}/retry'
        self.assertEqual(self.client.post(path, json=self.body()).status_code, 409)
        for _ in range(2):
            self.incidents.docs[0]["lastAttemptAt"] -= timedelta(seconds=61)
            self.assertEqual(self.client.post(path, json=self.body()).status_code, 200)
        self.incidents.docs[0]["lastAttemptAt"] -= timedelta(seconds=61)
        self.assertEqual(self.client.post(path, json=self.body()).status_code, 409)
        self.assertEqual(self.sender.call_count, 3)
    def test_accepted_unknown_and_ended_cannot_retry(self):
        for status in ("accepted", "unknown"):
            self.incidents.docs.clear(); self.sender.return_value = status
            incident = self.activate().json()["incident"]
            self.incidents.docs[0]["lastAttemptAt"] -= timedelta(seconds=61)
            path = f'/sos/{incident["incidentId"]}'
            self.assertEqual(self.client.post(path + "/retry", json=self.body()).status_code, 409)
            self.assertEqual(self.client.post(path + "/end").status_code, 200)
            self.assertEqual(self.client.post(path + "/retry", json=self.body()).status_code, 409)
    def test_new_activation_rate_limit_and_reload(self):
        incident = self.activate().json()["incident"]
        self.assertEqual(self.client.get("/sos/current").json()["incident"]["emailStatus"], "accepted")
        self.client.post(f'/sos/{incident["incidentId"]}/end')
        self.assertEqual(self.activate().status_code, 429)
        self.incidents.docs[0]["lastAttemptAt"] -= timedelta(seconds=61)
        self.assertEqual(self.activate().status_code, 200)
    def test_crashed_submission_becomes_unknown_without_resend(self):
        self.activate(); self.incidents.docs[0].update(emailStatus="sending", lastAttemptAt=sos.now() - timedelta(minutes=3))
        self.assertEqual(self.client.get("/sos/current").json()["incident"]["emailStatus"], "unknown")
        self.sender.assert_called_once()
    def test_concurrent_activation_and_retry_claims(self):
        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test") as client:
                data = {"fields": ["age"]}
                preview = (await client.post("/sos/preview", json=data)).json()
                payload = {**data, "requestId": str(uuid4()), "previewHash": preview["previewHash"], "confirmed": True}
                self.sender.return_value = "failed"
                results = await asyncio.gather(*(client.post("/sos/activate", json=payload) for _ in range(8)))
                self.assertTrue(all(result.status_code == 200 for result in results))
                self.assertEqual(self.sender.call_count, 1)
                doc = self.incidents.docs[0]
                doc["lastAttemptAt"] -= timedelta(seconds=61)
                results = await asyncio.gather(*(client.post(f'/sos/{doc["incidentId"]}/retry', json=payload) for _ in range(8)))
                self.assertEqual(sum(result.status_code == 200 for result in results), 1)
                self.assertEqual(self.sender.call_count, 2)
        asyncio.run(exercise())

    def test_auth_and_confirmation_required(self):
        data = self.body(); data["confirmed"] = False
        self.assertEqual(self.client.post("/sos/activate", json=data).status_code, 422)
        self.app.dependency_overrides.clear()
        self.assertIn(self.client.get("/sos/current").status_code, (401, 403))


class EmailTransport(unittest.TestCase):
    @patch.object(sos_email, "email_ready", return_value=True)
    @patch.object(sos_email.smtplib, "SMTP")
    def test_tls_and_success_even_if_quit_fails(self, smtp, ready):
        context = smtp.return_value; server = context.__enter__.return_value
        context.__exit__.side_effect = OSError("disconnect after acceptance")
        self.assertEqual(sos_email.send_alert("synthetic@example.com", "Synthetic demo", str(uuid4())), "accepted")
        server.starttls.assert_called_once()
        self.assertTrue(server.starttls.call_args.kwargs["context"].check_hostname)
    @patch.object(sos_email, "email_ready", return_value=True)
    @patch.object(sos_email.smtplib, "SMTP")
    def test_auth_failure_and_ambiguous_submission(self, smtp, ready):
        server = smtp.return_value.__enter__.return_value
        server.login.side_effect = sos_email.smtplib.SMTPAuthenticationError(535, b"no")
        self.assertEqual(sos_email.send_alert("synthetic@example.com", "demo", "id"), "failed")
        server.login.side_effect = None; server.send_message.side_effect = OSError("disconnect during DATA")
        self.assertEqual(sos_email.send_alert("synthetic@example.com", "demo", "id"), "unknown")
    @patch.object(sos_email, "email_ready", return_value=False)
    @patch.object(sos_email.smtplib, "SMTP")
    def test_missing_sender_never_opens_smtp(self, smtp, ready):
        self.assertEqual(sos_email.send_alert("synthetic@example.com", "demo", "id"), "failed")
        smtp.assert_not_called()
