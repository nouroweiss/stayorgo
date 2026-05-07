from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, decisions, schedules

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="StayOrGo API",
    description="Helps commuter students decide whether to stay on campus or go home.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(schedules.router)
app.include_router(decisions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
