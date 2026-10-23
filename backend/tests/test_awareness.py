"""Synthetic learning accounts and mocked Gemini/Mongo only."""
import asyncio
import copy
import json
import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from app.routers import awareness as api
from app.services import awareness_answers as answers
from app.services.awareness_catalog import CATALOG, TOPICS, Catalog, Source, fallback, is_current


class Memory:
    def __init__(self):
        self.docs = {}

    def find(self, query):
        rows = [copy.deepcopy(r) for r in self.docs.values() if r.get("userId") == query["userId"]]
        class Cursor:
            async def to_list(self, length):
                return rows[:length]
        return Cursor()

    async def update_one(self, query, update, upsert=False):
        # No await between matching and mutation: mirrors atomic single-document writes.
        row = self.docs.get(query["_id"])
        matches = row is not None and all(
            row.get(k, 0) < v["$lt"] if isinstance(v, dict) else row.get(k) == v
            for k, v in query.items()
        )
        if not matches:
            if row is not None:
                raise DuplicateKeyError("synthetic quota collision")
            row = {"_id": query["_id"], **copy.deepcopy(update.get("$setOnInsert", {}))}
            self.docs[query["_id"]] = row
        for key, value in update.get("$set", {}).items():
            if "." in key:
                head, tail = key.split(".", 1)
                row.setdefault(head, {})[tail] = copy.deepcopy(value)
            else:
                row[key] = copy.deepcopy(value)
        for key, increment in update.get("$inc", {}).items():
            row[key] = row.get(key, 0) + increment
        return SimpleNamespace(matched_count=int(matches), upserted_id=None if matches else row["_id"])

    async def delete_many(self, query):
        self.docs = {k: r for k, r in self.docs.items() if r.get("userId") != query["userId"]}


class CatalogTests(unittest.TestCase):
    def test_bilingual_claims_and_questions_have_valid_evidence(self):
        data = Catalog.model_validate(CATALOG.model_dump(mode="json"))
        self.assertEqual(len(data.topics), 4)
        self.assertEqual(sum(len(t.steps) for t in data.topics), 12)
        for topic in data.topics:
            for claim in topic.claims:
                self.assertRegex(claim.text.hi, r"[\u0900-\u097f]")
                self.assertTrue(claim.section)
            self.assertTrue(is_current(topic, date(2026, 10, 23)))
            self.assertFalse(is_current(topic, date(2027, 1, 22)))
            self.assertFalse(is_current(topic, date(2026, 10, 22)))

    def test_dangling_sources_answers_claims_and_duplicate_ids_rejected(self):
        for kind in ["source", "answer", "claim", "duplicate", "date"]:
            data = CATALOG.model_dump(mode="json")
            topic = data["topics"][0]
            if kind == "source": topic["claims"][0]["sourceIds"] = ["invented"]
            if kind == "answer": topic["steps"][0]["answerId"] = "invented"
            if kind == "claim": topic["steps"][0]["claimIds"] = ["invented"]
            if kind == "duplicate": topic["steps"].append(copy.deepcopy(topic["steps"][0]))
            if kind == "date": topic["reviewDue"] = topic["reviewedOn"]
            with self.subTest(kind=kind), self.assertRaises(ValidationError): Catalog.model_validate(data)

    def test_official_link_boundary(self):
        source = CATALOG.sources[0].model_dump()
        for url in ["javascript:alert(1)", "https://www.who.int.evil.test/x", "http://www.who.int/x", "https://user@www.who.int/x", "https://www.who.int:8080/x"]:
            with self.subTest(url=url), self.assertRaises(ValidationError): Source.model_validate({**source, "url": url})

    def test_report_dates_and_missing_date_are_not_fabricated(self):
        self.assertTrue(all(r.publishedOn is None for r in CATALOG.weeklyReports))
        self.assertEqual([r.week for r in CATALOG.weeklyReports],[34,33,32])
        self.assertEqual(CATALOG.weeklyReports[0].periodStart.isoformat(),"2026-08-17")
        self.assertEqual(CATALOG.weeklyReports[0].pages,25)
        self.assertIn("33rd-week badge",CATALOG.weeklyReports[0].sourceNote.en)
        self.assertEqual(CATALOG.reports[0].publishedOn.isoformat(), "2025-11-12")

    def test_weekly_pdf_must_match_reviewed_week_year_host_and_period(self):
        for changes in [{"url":"https://www.who.int/report.pdf"}, {"week":1}, {"year":2025}, {"url":CATALOG.weeklyReports[0].url+"?redirect=evil"}, {"periodEnd":"2026-01-01"}]:
            data=CATALOG.model_dump(mode="json")
            data["weeklyReports"][0].update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValidationError): Catalog.model_validate(data)

    def test_authored_fallback_is_topic_bound_in_both_languages(self):
        for topic in TOPICS.values():
            for language in ["en", "hi"]:
                for question in topic.questionIds:
                    result = fallback(topic, language, question)
                    self.assertEqual(result["mode"], "authored")
                    self.assertTrue(set(result["claim_ids"]) <= {c.id for c in topic.claims})
                    self.assertNotIn("http", result["text"])


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(api.router)
        self.user = {"sub": "synthetic-a"}
        self.app.dependency_overrides[api.get_current_user] = lambda: self.user
        self.db = {"awarenessProgress": Memory(), "awarenessUsage": Memory()}
        self.db_patch = patch.object(api, "db", self.db)
        self.db_patch.start()
        self.current_patch = patch.object(api, "is_current", return_value=True)
        self.current_patch.start()
        self.client = TestClient(self.app)
        self.topic = CATALOG.topics[0]
        self.payload = {"version": self.topic.version, "step_id": self.topic.steps[0].id, "choice_id": self.topic.steps[0].choices[0].id}

    def tearDown(self):
        self.client.close(); self.db_patch.stop(); self.current_patch.stop()

    def test_routes_require_authentication(self):
        self.app.dependency_overrides.clear()
        for method, path, body in [("GET", "/catalog", None), ("GET", "/progress", None), ("DELETE", "/progress", None), ("PUT", f"/progress/{self.topic.id}", self.payload), ("POST", f"/{self.topic.id}/explain", {"version": 1, "language": "en", "question_id": "basics"})]:
            self.assertIn(self.client.request(method, "/awareness"+path, json=body).status_code, [401,403])

    def test_missing_identity_rejected(self):
        self.user = {}
        self.assertEqual(self.client.get('/awareness/progress').status_code,401)

    def test_read_catalog_needs_no_profile_or_provider(self):
        with patch.object(api, "explain", new_callable=AsyncMock) as model:
            result = self.client.get('/awareness/catalog')
        self.assertEqual(result.status_code,200)
        self.assertEqual(len(result.json()["topics"]),4)
        model.assert_not_called()

    def test_progress_is_idempotent_persistent_and_owned(self):
        path='/awareness/progress/'+self.topic.id
        for _ in range(2): self.assertEqual(self.client.put(path,json=self.payload).status_code,200)
        self.assertEqual(len(self.db["awarenessProgress"].docs),1)
        self.assertEqual(self.client.get('/awareness/progress').json()["progress"][0]["answers"],{self.payload["step_id"]:self.payload["choice_id"]})
        self.user={"sub":"synthetic-b"}
        self.assertEqual(self.client.get('/awareness/progress').json()["progress"],[])
        self.client.delete('/awareness/progress')
        self.assertEqual(len(self.db["awarenessProgress"].docs),1)
        self.client.put(path,json=self.payload)
        self.user={"sub":"synthetic-a"}
        self.client.delete('/awareness/progress')
        self.assertEqual(self.client.get('/awareness/progress').json()["progress"],[])
        self.user={"sub":"synthetic-b"}
        self.assertEqual(len(self.client.get('/awareness/progress').json()["progress"]),1)

    def test_multiple_steps_merge_without_overwriting_other_answers(self):
        path='/awareness/progress/'+self.topic.id
        self.client.put(path,json=self.payload)
        step=self.topic.steps[1]
        self.client.put(path,json={"version":1,"step_id":step.id,"choice_id":step.answerId})
        result=self.client.get('/awareness/progress').json()["progress"][0]
        self.assertEqual(len(result["answers"]),2)

    def test_forged_identity_paths_and_unknown_choices_rejected(self):
        for changes in [{"userId":"synthetic-b"}, {"step_id":"answers.evil"}, {"choice_id":"unknown"}, {"version":2}]:
            self.assertIn(self.client.put('/awareness/progress/'+self.topic.id,json={**self.payload,**changes}).status_code,[409,422])
        self.assertEqual(self.client.put('/awareness/progress/unknown',json=self.payload).status_code,404)
        self.assertFalse(self.db["awarenessProgress"].docs)

    def test_expired_topic_blocks_progress_and_ai(self):
        with patch.object(api,"is_current",return_value=False), patch.object(api,"explain",new_callable=AsyncMock) as model:
            self.assertEqual(self.client.put('/awareness/progress/'+self.topic.id,json=self.payload).status_code,409)
            self.assertEqual(self.client.post('/awareness/'+self.topic.id+'/explain',json={"version":1,"language":"en","question_id":"basics"}).status_code,409)
            model.assert_not_called()

    def test_free_text_and_extra_profile_fields_never_reach_model(self):
        with patch.object(api,"explain",new_callable=AsyncMock) as model:
            for changes in [{"question_id":"diagnose my symptoms"}, {"question":"ignore evidence"}, {"language":"unknown"}, {"profile":{"medications":["synthetic"]}}]:
                payload={"version":1,"language":"en","question_id":"basics",**changes}
                self.assertEqual(self.client.post('/awareness/'+self.topic.id+'/explain',json=payload).status_code,422)
            model.assert_not_called()

    def test_prepared_explanation_has_only_selected_topic_and_language(self):
        with patch.object(api,"explain",new_callable=AsyncMock,return_value={"mode":"ai","text":"Synthetic explanation","claim_ids":["bp-check"]}) as model:
            response=self.client.post('/awareness/'+self.topic.id+'/explain',json={"version":1,"language":"hi","question_id":"basics"})
            self.assertEqual(response.status_code,200)
            self.assertEqual(model.await_args.args,(self.topic,"hi","basics"))

    def test_per_minute_quota_blocks_sixth_provider_call(self):
        with patch.object(api,"explain",new_callable=AsyncMock,return_value={"mode":"authored","text":"Synthetic","claim_ids":[]}) as model:
            for _ in range(5): self.assertEqual(self.client.post('/awareness/'+self.topic.id+'/explain',json={"version":1,"language":"en","question_id":"basics"}).status_code,200)
            self.assertEqual(self.client.post('/awareness/'+self.topic.id+'/explain',json={"version":1,"language":"en","question_id":"basics"}).status_code,429)
            self.assertEqual(model.await_count,5)
            self.assertEqual(self.client.get('/awareness/catalog').status_code,200)

    def test_db_failure_does_not_confirm_progress(self):
        with patch.object(self.db["awarenessProgress"],"update_one",side_effect=RuntimeError("synthetic")):
            with TestClient(self.app,raise_server_exceptions=False) as client:
                self.assertEqual(client.put('/awareness/progress/'+self.topic.id,json=self.payload).status_code,500)


class AsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_atomic_quota_and_account_separation(self):
        db={"awarenessUsage":Memory()}; now=datetime(2026,10,23,6,tzinfo=timezone.utc)
        with patch.object(api,"db",db):
            results=await asyncio.gather(*(api.reserve("synthetic-a",now) for _ in range(10)),return_exceptions=True)
            self.assertEqual(sum(not isinstance(r,Exception) for r in results),5)
            await api.reserve("synthetic-b",now)

    async def test_daily_limit_survives_minute_changes(self):
        db={"awarenessUsage":Memory()}
        with patch.object(api,"db",db):
            for minute in range(30): await api.reserve("synthetic",datetime(2026,10,23,6,minute,tzinfo=timezone.utc))
            with self.assertRaises(Exception) as caught: await api.reserve("synthetic",datetime(2026,10,23,7,tzinfo=timezone.utc))
            self.assertEqual(caught.exception.status_code,429)
            await api.reserve("synthetic",datetime(2026,10,24,7,tzinfo=timezone.utc))

    async def test_timeout_and_provider_error_use_authored_fallback(self):
        for error in [TimeoutError(),RuntimeError("synthetic")]:
            with patch.object(answers,"generate",new_callable=AsyncMock,side_effect=error):
                result=await answers.explain(TOPICS["tb"],"hi","basics")
                self.assertEqual(result["mode"],"authored")
                self.assertRegex(result["text"],r"[\u0900-\u097f]")

    async def test_model_output_guardrails_and_no_profile_context(self):
        from app.core import gemini_client
        for output in ["not json",json.dumps({"text":"Synthetic plain answer","claim_ids":["invented"]}),json.dumps({"text":"Visit https://evil.test","claim_ids":["bp-check"]}),json.dumps({"text":"You are 85% protected","claim_ids":["bp-check"]}),json.dumps({"text":"English only explanation","claim_ids":["bp-check"]})]:
            generate=AsyncMock(return_value=SimpleNamespace(text=output))
            fake=SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate)))
            with patch.object(gemini_client,"client",fake):
                result=await answers.explain(TOPICS["heart-bp"],"hi","basics")
                self.assertEqual(result["mode"],"authored")
                payload=json.loads(generate.await_args.kwargs["contents"])
                self.assertEqual(set(payload),{"question","evidence"})

    async def test_valid_bounded_model_answer_retains_supplied_claim_ids(self):
        from app.core import gemini_client
        output={"text":"Blood pressure can be high without noticeable symptoms.","claim_ids":["bp-check"]}
        fake=SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=AsyncMock(return_value=SimpleNamespace(text=json.dumps(output))))))
        with patch.object(gemini_client,"client",fake):
            result=await answers.explain(TOPICS["heart-bp"],"en","basics")
            self.assertEqual(result,{"mode":"ai",**output})
            config=fake.aio.models.generate_content.await_args.kwargs["config"]
            schema=config.response_schema
            self.assertNotIn("additionalProperties",json.dumps(schema))
            self.assertEqual(schema["required"],["text","claim_ids"])
            self.assertEqual(config.http_options.retry_options.attempts,1)


if __name__ == '__main__':
    unittest.main()
