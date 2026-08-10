from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.MONGODB_DB_NAME]

# Usage in a router:
#   from app.core.db import db
#   profile = await db.patientProfiles.find_one({"userId": user["sub"]})