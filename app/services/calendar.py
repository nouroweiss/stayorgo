import os
from datetime import date, datetime, timedelta, timezone

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.models.schedule import Schedule
from app.models.user import User

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

_CLIENT_CONFIG = {
    "web": {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}


def _make_flow(state: str | None = None):
    from google_auth_oauthlib.flow import Flow

    # Allow HTTP for local development
    if settings.google_redirect_uri.startswith("http://"):
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    return Flow.from_client_config(
        _CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
        state=state,
    )


def create_oauth_state(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "oauth_state"},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def decode_oauth_state(state: str) -> int | None:
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "oauth_state":
            return None
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


def get_google_auth_url(user_id: int) -> str:
    state = create_oauth_state(user_id)
    flow = _make_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
    )
    return auth_url


def exchange_code_for_tokens(code: str, state: str) -> tuple[int, dict]:
    """Returns (user_id, token_dict). Raises ValueError if state is invalid."""
    user_id = decode_oauth_state(state)
    if user_id is None:
        raise ValueError("Invalid or expired OAuth state")

    flow = _make_flow(state=state)
    flow.fetch_token(code=code)
    creds = flow.credentials
    return user_id, {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "expiry": creds.expiry,
    }


def build_credentials(user: User, db: Session) -> Credentials | None:
    if not user.google_access_token:
        return None

    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Persist refreshed token so we don't re-refresh on every request
        user.google_access_token = creds.token
        user.google_token_expiry = creds.expiry
        db.commit()

    return creds


def sync_google_calendar(db: Session, user: User, target_date: date) -> list[Schedule]:
    creds = build_credentials(user, db)
    if not creds:
        return []

    service = build("calendar", "v3", credentials=creds)
    time_min = datetime.combine(target_date, datetime.min.time()).isoformat() + "Z"
    time_max = datetime.combine(target_date, datetime.max.time()).isoformat() + "Z"

    result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    synced = []
    for event in result.get("items", []):
        existing = (
            db.query(Schedule)
            .filter(Schedule.user_id == user.id, Schedule.google_event_id == event["id"])
            .first()
        )

        start = event["start"].get("dateTime", event["start"].get("date", ""))
        end = event["end"].get("dateTime", event["end"].get("date", ""))
        start_dt = datetime.fromisoformat(start.replace("Z", "+00:00")) if "T" in start else None
        end_dt = datetime.fromisoformat(end.replace("Z", "+00:00")) if "T" in end else None

        if existing:
            existing.title = event.get("summary", "No title")
            existing.description = event.get("description")
            existing.start_time = start_dt.time() if start_dt else None
            existing.end_time = end_dt.time() if end_dt else None
            existing.location = event.get("location")
            synced.append(existing)
        else:
            schedule = Schedule(
                user_id=user.id,
                title=event.get("summary", "No title"),
                description=event.get("description"),
                event_date=target_date,
                start_time=start_dt.time() if start_dt else None,
                end_time=end_dt.time() if end_dt else None,
                location=event.get("location"),
                source="google_calendar",
                google_event_id=event["id"],
            )
            db.add(schedule)
            synced.append(schedule)

    db.commit()
    return synced
