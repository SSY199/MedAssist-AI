"""Gmail SMTP transport. Never log credentials, recipients, or message bodies."""
import smtplib
import ssl
from email.message import EmailMessage

import certifi

from app.core.config import settings


def email_ready() -> bool:
    return bool(settings.SOS_GMAIL_ADDRESS and settings.SOS_GMAIL_APP_PASSWORD)


def send_alert(recipient: str, body: str, incident_id: str) -> str:
    if not email_ready():
        return "failed"
    submitting = False
    accepted = False
    try:
        message = EmailMessage()
        message["From"] = settings.SOS_GMAIL_ADDRESS
        message["To"] = recipient
        message["Subject"] = "MedAssist SOS: your emergency contact needs help"
        message["Message-ID"] = f"<{incident_id}@medassist.local>"
        message.set_content(body)
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context(cafile=certifi.where()))
            smtp.login(settings.SOS_GMAIL_ADDRESS, settings.SOS_GMAIL_APP_PASSWORD.replace(" ", ""))
            submitting = True
            smtp.send_message(message)
            accepted = True
            # QUIT/disconnect errors after a successful DATA response must not
            # turn an accepted submission into a retryable failure.
            return "accepted"
    except (smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused,
            smtplib.SMTPDataError, smtplib.SMTPAuthenticationError):
        return "accepted" if accepted else "failed"
    except Exception:
        return "accepted" if accepted else ("unknown" if submitting else "failed")
