"""Generic reminder mail only. Keep SOS transport and recipient policy separate."""
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlsplit

import certifi
from bson import ObjectId
from app.core.config import settings
from app.core.db import db


async def verified_recipient(user_id: str):
    # Installed Better-Auth Mongo adapter serializes ObjectId IDs to JWT sub.
    # UUID/string IDs are also supported without trusting a browser email field.
    ids = [user_id]
    if ObjectId.is_valid(user_id):
        ids.append(ObjectId(user_id))
    user = await db["user"].find_one({"_id": {"$in": ids}})
    email = user.get("email", "") if user else ""
    if not user or user.get("emailVerified") is not True or not isinstance(email, str):
        return None
    if len(email) > 254 or "@" not in email or any(c in email for c in "\r\n<>"):
        return None
    return email


def email_ready():
    return bool(settings.REMINDERS_EMAIL_ENABLED and settings.SOS_GMAIL_ADDRESS
                and settings.SOS_GMAIL_APP_PASSWORD)


def send_reminder(recipient: str, message_id: str) -> str:
    if not email_ready():
        return "failed"
    submitting = accepted = False
    try:
        message = EmailMessage()
        message["From"] = settings.SOS_GMAIL_ADDRESS
        message["To"] = recipient
        message["Subject"] = "MedAssist reminder"
        message["Message-ID"] = f"<{message_id}@medassist.local>"
        body = "You have a scheduled reminder. Sign in to MedAssist to view it."
        url = urlsplit(settings.BETTER_AUTH_URL)
        if url.scheme in {"http", "https"} and url.hostname and not url.username and not url.password:
            body += f"\n\n{url.scheme}://{url.netloc}/reminders"
        message.set_content(body)
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context(cafile=certifi.where()))
            smtp.login(settings.SOS_GMAIL_ADDRESS, settings.SOS_GMAIL_APP_PASSWORD.replace(" ", ""))
            submitting = True
            smtp.send_message(message)
            accepted = True
            return "accepted"
    except (smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused,
            smtplib.SMTPDataError, smtplib.SMTPAuthenticationError):
        return "accepted" if accepted else "failed"
    except Exception:
        return "accepted" if accepted else ("unknown" if submitting else "failed")
