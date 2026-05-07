import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schedule import Decision, Schedule
from app.models.user import User
from app.schemas.schedule import DecisionOut, DecisionRequest
from app.services.claude import get_stay_or_go_decision

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.post("/", response_model=DecisionOut)
def make_decision(
    payload: DecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedules = (
        db.query(Schedule)
        .filter(Schedule.user_id == current_user.id, Schedule.event_date == payload.target_date)
        .order_by(Schedule.start_time)
        .all()
    )

    result = get_stay_or_go_decision(current_user, payload.target_date, schedules, payload.extra_context)

    decision = Decision(
        user_id=current_user.id,
        decision_date=payload.target_date,
        recommendation=result["recommendation"],
        reasoning=result["reasoning"],
        confidence_score=result.get("confidence_score", 0),
        factors=json.dumps(result.get("factors")),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


@router.get("/", response_model=list[DecisionOut])
def list_decisions(
    decision_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Decision).filter(Decision.user_id == current_user.id)
    if decision_date:
        query = query.filter(Decision.decision_date == decision_date)
    return query.order_by(Decision.created_at.desc()).all()


@router.get("/{decision_id}", response_model=DecisionOut)
def get_decision(decision_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    decision = db.query(Decision).filter(Decision.id == decision_id, Decision.user_id == current_user.id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision
