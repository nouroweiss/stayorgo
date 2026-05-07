# StayOrGo API

A REST API that helps commuter students decide whether to stay on campus or go home based on their schedule, commute time, deadlines, and Google Calendar events — powered by Claude AI.

## Features

- JWT authentication (register, login, protected routes)
- Manual schedule management (create, read, update, delete events)
- Google Calendar OAuth2 integration (sync events for any date)
- AI-powered stay/go recommendations via Claude with confidence scores and reasoning
- Decision history stored per user

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI |
| Database | SQLite + SQLAlchemy 2.0 |
| Auth | JWT via `python-jose` + `passlib[bcrypt]` |
| Calendar | Google Calendar API (read-only OAuth2) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Server | Uvicorn |

## Project Structure

```
stayorgo/
├── app/
│   ├── main.py            # FastAPI app, CORS middleware, route registration
│   ├── config.py          # Environment-based settings (pydantic-settings)
│   ├── database.py        # SQLAlchemy engine, session, Base
│   ├── dependencies.py    # get_current_user FastAPI dependency
│   ├── models/
│   │   ├── user.py        # User model (profile + Google tokens)
│   │   └── schedule.py    # Schedule + Decision models
│   ├── schemas/
│   │   ├── user.py        # UserCreate, UserOut, Token schemas
│   │   └── schedule.py    # ScheduleCreate, DecisionRequest/Out schemas
│   ├── routers/
│   │   ├── auth.py        # /auth/* endpoints
│   │   ├── schedules.py   # /schedules/* endpoints
│   │   └── decisions.py   # /decisions/* endpoints
│   └── services/
│       ├── auth.py        # Password hashing, JWT encode/decode
│       ├── calendar.py    # Google OAuth2 flow + Calendar sync
│       └── claude.py      # Claude prompt builder + API call
├── .env.example
├── .gitignore
└── requirements.txt
```

## Getting Started

### Prerequisites

- Python 3.11+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)
- A [Google Cloud project](https://console.cloud.google.com/) with the Calendar API enabled and OAuth2 credentials

### Installation

```bash
git clone https://github.com/nouroweiss/stayorgo.git
cd stayorgo

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
SECRET_KEY=<generate with: python3 -c "import secrets; print(secrets.token_hex(32))">

ANTHROPIC_API_KEY=sk-ant-...

GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

### Run

```bash
uvicorn app.main:app --reload
```

API is live at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Create a new account |
| `POST` | `/auth/login` | No | Login, receive JWT |
| `GET` | `/auth/me` | Yes | Get current user profile |
| `PATCH` | `/auth/me` | Yes | Update profile (name, commute time, addresses) |
| `GET` | `/auth/google` | Yes | Get Google OAuth2 authorization URL |
| `GET` | `/auth/google/callback` | Yes | Exchange code for tokens, store in DB |

#### Register

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@university.edu",
    "password": "yourpassword",
    "full_name": "Jane Smith",
    "commute_minutes": 40,
    "home_address": "123 Home St, City",
    "campus_address": "456 Campus Ave, City"
  }'
```

#### Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=student@university.edu&password=yourpassword"
```

Response:
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

Use the token as `Authorization: Bearer <token>` on all protected routes.

---

### Schedules

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/schedules/` | List all events (filter by `?event_date=YYYY-MM-DD`) |
| `POST` | `/schedules/` | Create a manual event |
| `GET` | `/schedules/{id}` | Get a single event |
| `PATCH` | `/schedules/{id}` | Update an event |
| `DELETE` | `/schedules/{id}` | Delete an event |
| `POST` | `/schedules/sync/google` | Sync Google Calendar for a date |

#### Create a schedule event

```bash
curl -X POST http://localhost:8000/schedules/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CS301 Lecture",
    "event_date": "2026-05-08",
    "start_time": "09:00:00",
    "end_time": "10:30:00",
    "location": "Engineering Hall",
    "is_on_campus": true
  }'
```

#### Sync Google Calendar

```bash
curl -X POST "http://localhost:8000/schedules/sync/google?target_date=2026-05-08" \
  -H "Authorization: Bearer <token>"
```

---

### Decisions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/decisions/` | Request a stay/go decision from Claude |
| `GET` | `/decisions/` | List past decisions (filter by `?decision_date=YYYY-MM-DD`) |
| `GET` | `/decisions/{id}` | Get a single decision |

#### Get a stay/go recommendation

```bash
curl -X POST http://localhost:8000/decisions/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_date": "2026-05-08",
    "extra_context": "I have a major assignment due tomorrow"
  }'
```

Response:
```json
{
  "id": 1,
  "decision_date": "2026-05-08",
  "recommendation": "stay",
  "reasoning": "With two on-campus events and a 90-minute round-trip commute, the 3.5-hour gap is better spent studying on campus than commuting. Staying eliminates fatigue and maximizes productive time.",
  "confidence_score": 88,
  "factors": "{\"campus_events_count\": 2, \"total_commute_minutes\": 90, \"largest_gap_minutes\": 210, \"last_event_end\": \"15:00\", \"key_reason\": \"gap time better spent studying on campus than commuting\"}",
  "created_at": "2026-05-08T09:00:00"
}
```

Claude considers:
- Number of on-campus events and gaps between them
- Whether gaps are long enough to justify going home and back
- Total commute cost (one-way time × 2)
- Evening events that would require a late return
- Any extra context provided by the student

---

## Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Calendar API**
3. Create an **OAuth 2.0 Client ID** (Web application type)
4. Add `http://localhost:8000/auth/google/callback` as an authorized redirect URI
5. Copy the Client ID and Secret into your `.env`

To connect a user's calendar:

```bash
# 1. Get the auth URL
curl http://localhost:8000/auth/google \
  -H "Authorization: Bearer <token>"

# 2. Visit the returned auth_url in a browser and authorize
# 3. Google redirects to /auth/google/callback — tokens are stored automatically
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | Random secret for JWT signing |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token lifetime (default: `30`) |
| `DATABASE_URL` | No | SQLAlchemy URL (default: `sqlite:///./stayorgo.db`) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `GOOGLE_CLIENT_ID` | Yes* | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes* | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | No | OAuth2 callback URL (default: `http://localhost:8000/auth/google/callback`) |

\* Required only for Google Calendar integration.

---

## License

MIT
