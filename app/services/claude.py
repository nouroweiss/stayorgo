import json
from datetime import date

import anthropic

from app.config import settings
from app.models.schedule import Schedule
from app.models.user import User

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def build_decision_prompt(user: User, target_date: date, schedules: list[Schedule], extra_context: str | None) -> str:
    events_text = ""
    if schedules:
        for s in schedules:
            time_str = f"{s.start_time} - {s.end_time}" if s.start_time else "all day"
            location_str = f" at {s.location}" if s.location else ""
            campus_str = "(on campus)" if s.is_on_campus else "(off campus / home)"
            events_text += f"  - {s.title}: {time_str}{location_str} {campus_str}\n"
    else:
        events_text = "  No scheduled events.\n"

    extra = f"\nAdditional context from student: {extra_context}" if extra_context else ""

    return f"""You are helping a commuter student decide whether to stay on campus or go home on {target_date}.

Student profile:
- Commute time: {user.commute_minutes} minutes one way
- Home address: {user.home_address or "not specified"}
- Campus address: {user.campus_address or "not specified"}

Schedule for {target_date}:
{events_text}{extra}

Analyze the schedule and commute time to recommend whether the student should STAY on campus or GO home. Consider:
1. Number of on-campus events and gaps between them
2. Whether gaps are long enough to justify going home and coming back
3. Total commute cost (time × 2 for round trip)
4. Evening events that would require returning late
5. Overall fatigue and productivity

Respond with a JSON object only (no markdown) with these exact fields:
{{
  "recommendation": "stay" or "go",
  "confidence_score": integer 0-100,
  "reasoning": "2-3 sentence explanation",
  "factors": {{
    "campus_events_count": integer,
    "total_commute_minutes": integer,
    "largest_gap_minutes": integer or null,
    "last_event_end": "HH:MM" or null,
    "key_reason": "one short phrase"
  }}
}}"""


def get_stay_or_go_decision(
    user: User,
    target_date: date,
    schedules: list[Schedule],
    extra_context: str | None = None,
) -> dict:
    prompt = build_decision_prompt(user, target_date, schedules, extra_context)
    client = get_client()

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system="You are a helpful assistant for commuter students. Always respond with valid JSON only.",
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback if model wraps output in markdown fences
        import re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse Claude response: {raw}")
