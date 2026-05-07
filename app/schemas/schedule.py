from datetime import date, datetime, time

from pydantic import BaseModel


class ScheduleCreate(BaseModel):
    title: str
    description: str | None = None
    event_date: date
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    is_on_campus: bool = True


class ScheduleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    is_on_campus: bool | None = None


class ScheduleOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: str | None
    event_date: date
    start_time: time | None
    end_time: time | None
    location: str | None
    is_on_campus: bool
    source: str
    created_at: datetime


class DecisionRequest(BaseModel):
    target_date: date
    extra_context: str | None = None


class DecisionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    decision_date: date
    recommendation: str
    reasoning: str
    confidence_score: int
    factors: str | None
    created_at: datetime
