from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserOut, UserUpdate
from app.services.auth import authenticate_user, create_access_token, get_user_by_email, hash_password
from app.services.calendar import exchange_code_for_tokens, get_google_auth_url

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        commute_minutes=payload.commute_minutes,
        home_address=payload.home_address,
        campus_address=payload.campus_address,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/google")
def google_auth():
    return {"auth_url": get_google_auth_url()}


@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tokens = exchange_code_for_tokens(code)
    current_user.google_access_token = tokens["access_token"]
    current_user.google_refresh_token = tokens["refresh_token"]
    current_user.google_token_expiry = tokens["expiry"]
    db.commit()
    return {"message": "Google Calendar connected successfully"}
