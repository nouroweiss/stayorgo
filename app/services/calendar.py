from datetime import date, datetime, timezone

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.schedule import Schedule

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def build_credentials(user: User) -> Credentials | None:
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
    return creds


def get_google_auth_url() -> str:
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "expiry": creds.expiry,
    }


def sync_google_calendar(db: Session, user: User, target_date: date) -> list[Schedule]:
    creds = build_credentials(user)
    if not creds:
        return []

    service = build("calendar", "v3", credentials=creds)
    time_min = datetime.combine(target_date, datetime.min.time()).isoformat() + "Z"
    time_max = datetime.combine(target_date, datetime.max.time()).isoformat() + "Z"

    result = service.events().list(
        calendarId="primary",
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    synced = []
    for event in result.get("items", []):
        existing = db.query(Schedule).filter(
            Schedule.user_id == user.id,
            Schedule.google_event_id == event["id"],
        ).first()

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
