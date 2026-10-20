import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).with_name(".env"))

uri = os.getenv("MONGODB_URI")

if not uri:
    raise ValueError("MONGODB_URI is missing from backend/.env")

client = MongoClient(uri, serverSelectionTimeoutMS=10000)

try:
    client.admin.command("ping")
    print("SUCCESS: Connected to MongoDB Atlas!")

except Exception as error:
    print("MongoDB connection failed:")
    print(type(error).__name__, str(error))

finally:
    client.close()