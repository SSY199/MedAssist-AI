from urllib.parse import parse_qsl, urlsplit

import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

# Supply trusted public roots for TLS connections on Python installations that
# have no system CA file. Preserve explicit CA files and non-TLS local databases.
uri_options = {
    key.lower(): value for key, value in parse_qsl(urlsplit(settings.MONGODB_URI).query)
}
tls_enabled = uri_options.get(
    "tls",
    uri_options.get("ssl", "true" if settings.MONGODB_URI.startswith("mongodb+srv://") else "false"),
).lower() == "true"
tls_options = (
    {"tlsCAFile": certifi.where()}
    if tls_enabled and "tlscafile" not in uri_options
    else {}
)

client = AsyncIOMotorClient(settings.MONGODB_URI, **tls_options)
db = client[settings.MONGODB_DB_NAME]

# Usage in a router:
#   from app.core.db import db
#   profile = await db.patientProfiles.find_one({"userId": user["sub"]})
