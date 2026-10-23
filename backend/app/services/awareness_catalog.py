"""One versioned bilingual bundle shared with the frontend. No network or DB imports."""
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Text(Record):
    en: str = Field(min_length=1, max_length=1200)
    hi: str = Field(min_length=1, max_length=1200)


class Link(Record):
    id: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    publisher: str
    url: str
    publishedOn: date | None

    @field_validator("url")
    @classmethod
    def official_url(cls, value):
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or parsed.hostname not in {
            "www.who.int", "www.pib.gov.in", "ncdc.mohfw.gov.in"
        } or parsed.username or parsed.password or parsed.port not in (None, 443)):
            raise ValueError("Only reviewed official HTTPS destinations allowed")
        return value


class Source(Link):
    title: str
    accessedOn: date
    language: Literal["en", "hi"]
    region: str
    section: str
    reuse: str


class Claim(Record):
    id: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    text: Text
    sourceIds: list[str] = Field(min_length=1)
    section: str


class Choice(Record):
    id: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    label: Text


class Step(Record):
    id: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    kind: Literal["situation", "evidence"]
    prompt: Text
    choices: list[Choice] = Field(min_length=2, max_length=4)
    answerId: str
    claimIds: list[str] = Field(min_length=1)


class Topic(Record):
    id: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    version: int = Field(ge=1)
    title: Text
    description: Text
    category: Text
    reviewedOn: date
    reviewDue: date
    reviewerRole: str
    claims: list[Claim] = Field(min_length=1)
    steps: list[Step] = Field(min_length=1)
    takeawayIds: list[str] = Field(min_length=1)
    questionIds: list[Literal["basics", "prevention"]]


class Report(Link):
    title: Text
    period: Text
    summary: Text
    kind: Text
    reviewedOn: date
    limitation: Text


class Catalog(Record):
    version: int
    sources: list[Source]
    topics: list[Topic]
    reports: list[Report]

    @model_validator(mode="after")
    def references(self):
        def unique(items):
            ids = [item.id for item in items]
            if len(ids) != len(set(ids)):
                raise ValueError("Duplicate awareness ID")
            return set(ids)
        sources = unique(self.sources)
        unique(self.topics)
        unique(self.reports)
        for topic in self.topics:
            claims = unique(topic.claims)
            unique(topic.steps)
            if topic.reviewDue <= topic.reviewedOn:
                raise ValueError("Review expiry must follow review date")
            if not set(topic.takeawayIds) <= claims:
                raise ValueError("Unknown takeaway claim")
            for claim in topic.claims:
                if not set(claim.sourceIds) <= sources:
                    raise ValueError("Unknown source")
            for step in topic.steps:
                choices = unique(step.choices)
                if step.answerId not in choices or not set(step.claimIds) <= claims:
                    raise ValueError("Invalid question evidence or answer")
        return self


CATALOG = Catalog.model_validate_json(
    (Path(__file__).resolve().parents[1] / "data" / "awareness.json").read_text()
)
TOPICS = {topic.id: topic for topic in CATALOG.topics}
SOURCES = {source.id: source for source in CATALOG.sources}


def is_current(topic, today=None):
    today = today or datetime.now(timezone.utc).date()
    return topic.reviewedOn <= today <= topic.reviewDue


def fallback(topic, language, question_id):
    ids = topic.takeawayIds[:2] if question_id == "basics" else topic.takeawayIds[1:]
    claims = [c for c in topic.claims if c.id in ids]
    return {"mode": "authored", "text": " ".join(getattr(c.text, language) for c in claims),
            "claim_ids": [c.id for c in claims]}
