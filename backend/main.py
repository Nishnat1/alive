import logging
import os
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Annotated, Literal

import jwt
from bson import ObjectId

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials,
)

from pydantic import BaseModel, Field

from pymongo import MongoClient, DESCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError

from pwdlib import PasswordHash

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).with_name(".env"))

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    # "mongodb://127.0.0.1:27017/",
)
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "fittrack")

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    tz_aware=True,
)
db = client[MONGODB_DATABASE]
workouts_collection = db["workouts"]
# Collection for user accounts
users_collection = db["users"]

def ensure_database_indexes():
    users_collection.create_index("email", unique=True)
    workouts_collection.create_index([("userId", 1), ("completedAt", -1)])

# JWT settings loaded from backend/.env
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is missing from backend/.env"
    )

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

# Password hashing configuration
password_hash = PasswordHash.recommended()

# Reads Bearer tokens from request headers
security = HTTPBearer(auto_error=False)

app = FastAPI(
    title="alive API",
    description="Backend API for alive",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            # "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


class WorkoutCreate(BaseModel):
    activity: Literal["Running", "Walking", "Cycling"]
    durationMs: int = Field(ge=0)
    distanceMeters: float = Field(ge=0)
    routePoints: list[
        tuple[
            Annotated[float, Field(ge=-90, le=90)],
            Annotated[float, Field(ge=-180, le=180)],
        ]
    ] = Field(
        default_factory=list,
        max_length=20000,
    )
    completedAt: datetime

class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    password: str | None = Field(default=None, min_length=8, max_length=128)

def serialize_workout(document):
    return {
        "id": str(document["_id"]),
        "activity": document["activity"],
        "durationMs": document["durationMs"],
        "distanceMeters": document["distanceMeters"],
        "routePoints": document.get("routePoints", []),
        "completedAt": document["completedAt"].isoformat(),
    }


@app.get("/")
def home():
    return {"message": "alive API is running"}


@app.get("/health")
def health_check():
    try:
        client.admin.command("ping")
        ensure_database_indexes()
        return {
            "status": "ok",
            "database": "connected",
        }
    except PyMongoError as exc:
        message = re.sub(
            r"mongodb(?:\+srv)?://[^\s\"']+",
            "<redacted MongoDB URI>",
            str(exc),
        )
        logger.error(
            "MongoDB health check failed (%s): %s",
            type(exc).__name__,
            message,
        )
        raise HTTPException(
            status_code=503,
            detail="MongoDB is unavailable. Check that the server is running.",
        )


# -----------------------------------------
# Authentication helper functions
# -----------------------------------------

def normalize_email(email: str) -> str:
    email = email.strip().lower()

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(
            status_code=422,
            detail="Please enter a valid email address."
        )

    return email


def create_access_token(user_id: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": user_id,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm="HS256"
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Please log in first.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        user_id = payload.get("sub")

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not isinstance(user_id, str) or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=401,
            detail="Invalid login token.",
        )

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Could not verify your account with MongoDB.",
        )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User account not found.",
        )

    return user


@app.post("/workouts", status_code=status.HTTP_201_CREATED)
def create_workout(workout: WorkoutCreate, user=Depends(get_current_user)):
    document = workout.model_dump()
    document["routePoints"] = [
        list(point) for point in workout.routePoints
    ]
    document["userId"] = user["_id"]
    document["createdAt"] = datetime.now(timezone.utc)

    try:
        result = workouts_collection.insert_one(document)
        saved = workouts_collection.find_one(
            {"_id": result.inserted_id}
        )

        return {
            "message": "Workout saved successfully",
            "workout": serialize_workout(saved),
        }
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Could not save workout to MongoDB.",
        )


@app.get("/workouts")
def get_workouts(user=Depends(get_current_user)):
    try:
        documents = workouts_collection.find(
            {"userId": user["_id"]}
        ).sort(
            "completedAt", DESCENDING
        ).limit(500)

        records = [
            serialize_workout(document)
            for document in documents
        ]

        return {
            "count": len(records),
            "workouts": records,
        }
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve workouts from MongoDB.",
        )


@app.delete("/workouts/{workout_id}", status_code=200)
def delete_workout(workout_id: str, user=Depends(get_current_user)):
    if not ObjectId.is_valid(workout_id):
        raise HTTPException(
            status_code=404,
            detail="Workout not found.",
        )

    try:
        result = workouts_collection.delete_one(
            {"_id": ObjectId(workout_id), "userId": user["_id"]}
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Could not delete workout from MongoDB.",
        )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Workout not found.",
        )

    return {"message": "Workout deleted successfully."}


# -----------------------------------------
# Signup API
# -----------------------------------------

@app.post("/auth/signup", status_code=201)
def signup(data: SignupRequest):
    name = data.name.strip()
    email = normalize_email(data.email)

    if len(name) < 2:
        raise HTTPException(
            status_code=422,
            detail="Name must contain at least 2 characters.",
        )

    # Never save the original password
    user_document = {
        "name": name,
        "email": email,
        "hashed_password": password_hash.hash(data.password),
        "created_at": datetime.now(timezone.utc),
    }

    try:
        ensure_database_indexes()
        if users_collection.find_one({"email": email}):
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )
        result = users_collection.insert_one(user_document)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Could not create your account because MongoDB is unavailable.",
        )

    token = create_access_token(str(result.inserted_id))

    return {
        "message": "Account created successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(result.inserted_id),
            "name": name,
            "email": email,
        },
    }


# -----------------------------------------
# Login API
# -----------------------------------------

@app.post("/auth/login")
def login(data: LoginRequest):
    email = normalize_email(data.email)

    try:
        user = users_collection.find_one({"email": email})
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Could not sign in because MongoDB is unavailable.",
        )

    if user is None or not password_hash.verify(
        data.password,
        user["hashed_password"],
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
        )

    token = create_access_token(str(user["_id"]))

    return {
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
        },
    }


# -----------------------------------------
# Current logged-in user API
# -----------------------------------------

@app.get("/auth/me")
def get_my_account(
    user=Depends(get_current_user)
):
    return {
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
        }
    }


@app.put("/auth/me")
def update_my_account(
    data: ProfileUpdate,
    user=Depends(get_current_user),
):
    updates = {}

    if data.name is not None:
        name = data.name.strip()
        if len(name) < 2:
            raise HTTPException(
                status_code=422,
                detail="Name must contain at least 2 characters.",
            )
        updates["name"] = name

    if data.password is not None:
        updates["hashed_password"] = password_hash.hash(data.password)

    if not updates:
        raise HTTPException(
            status_code=422,
            detail="Nothing to update.",
        )

    try:
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": updates},
        )
        updated = users_collection.find_one({"_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Could not update your account.",
        )

    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="User account not found.",
        )

    return {
        "message": "Profile updated successfully.",
        "user": {
            "id": str(updated["_id"]),
            "name": updated["name"],
            "email": updated["email"],
        },
    }