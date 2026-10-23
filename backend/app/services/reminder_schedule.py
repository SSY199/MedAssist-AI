"""Pure calendar rules: prescribed wall-clock schedules, never dose advice."""
import hashlib
import json
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

UTC = timezone.utc


def utcnow():
    return datetime.now(UTC)


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class ReminderInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    medicine: str = Field(min_length=1, max_length=120)
    instructions: str = Field(default="", max_length=300)
    timezone: str = Field(max_length=80)
    recurrence: Literal["once", "daily", "weekdays"]
    times: list[str] = Field(min_length=1, max_length=8)
    weekdays: list[int] = Field(default_factory=list, max_length=7)
    start_date: date
    end_date: date | None = None
    email_enabled: bool = False
    email_consent: bool = False

    @field_validator("medicine", "instructions")
    @classmethod
    def clean_text(cls, value):
        value = value.strip()
        if any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Invalid control character")
        return value

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid IANA timezone")
        return value

    @field_validator("times")
    @classmethod
    def valid_times(cls, values):
        if any(not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", v) for v in values):
            raise ValueError("Use HH:MM times")
        if len(set(values)) != len(values):
            raise ValueError("Remove duplicate times")
        return sorted(values)

    @model_validator(mode="after")
    def valid_schedule(self):
        if not self.medicine:
            raise ValueError("Enter a medicine name")
        if not 1970 <= self.start_date.year <= 2100 or (self.end_date and not 1970 <= self.end_date.year <= 2100):
            raise ValueError("Choose a date between 1970 and 2100")
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must follow start date")
        if any(type(v) is not int or v < 0 or v > 6 for v in self.weekdays):
            raise ValueError("Weekdays use Monday=0 through Sunday=6")
        if len(set(self.weekdays)) != len(self.weekdays):
            raise ValueError("Remove duplicate weekdays")
        if self.recurrence == "weekdays" and not self.weekdays:
            raise ValueError("Choose at least one weekday")
        if self.recurrence != "weekdays" and self.weekdays:
            raise ValueError("Weekdays only apply to selected-weekday schedules")
        if self.recurrence == "once" and (len(self.times) != 1 or self.end_date):
            raise ValueError("One-time schedules have one time and no end date")
        if self.email_enabled and not self.email_consent:
            raise ValueError("Confirm generic email delivery to your account")
        if self.recurrence == "once":
            _, gap = local_instant(self.start_date, self.times[0], self.timezone)
            if gap:
                raise ValueError("This local time does not exist because the clock changes")
        return self


def local_instant(day: date, clock: str, zone: str):
    naive = datetime.combine(day, time.fromisoformat(clock))
    local = naive.replace(tzinfo=ZoneInfo(zone), fold=0)
    instant = local.astimezone(UTC)
    # fold=0 selects the first repeated time; a round-trip detects spring gaps.
    gap = instant.astimezone(ZoneInfo(zone)).replace(tzinfo=None) != naive
    return instant, gap


def slots(schedule: dict, first: date, last: date):
    start = date.fromisoformat(schedule["start_date"])
    end = date.fromisoformat(schedule["end_date"]) if schedule.get("end_date") else last
    first, last = max(first, start), min(last, end)
    if schedule["recurrence"] == "once":
        last = min(last, start)
    day = first
    while day <= last:
        if schedule["recurrence"] != "weekdays" or day.weekday() in schedule["weekdays"]:
            for clock in schedule["times"]:
                instant, gap = local_instant(day, clock, schedule["timezone"])
                yield day, clock, instant, gap
        day += timedelta(days=1)


def occurrence_id(schedule: dict, day: date, clock: str):
    return hashlib.sha256(json.dumps([schedule["_id"], schedule["version"], day.isoformat(), clock]).encode()).hexdigest()


def next_preview(schedule: dict, now: datetime, limit=5):
    zone = ZoneInfo(schedule["timezone"])
    first = max(now.astimezone(zone).date(), date.fromisoformat(schedule["start_date"]))
    result = []
    for day, clock, instant, gap in slots(schedule, first, first + timedelta(days=370)):
        if instant > now:
            result.append({"local_date": day.isoformat(), "local_time": clock,
                           "due_at": instant.isoformat(), "clock_change": gap})
        if len(result) == limit:
            break
    return result
