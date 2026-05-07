from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    commute_minutes: int = 30
    home_address: str | None = None
    campus_address: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    commute_minutes: int | None = None
    home_address: str | None = None
    campus_address: str | None = None


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    full_name: str | None
    commute_minutes: int
    home_address: str | None
    campus_address: str | None
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: int | None = None
