import smtplib
from email.message import EmailMessage

from backend.utils.settings import get_settings

settings = get_settings()


class EmailService:
    def send_email(self, *, to_address: str, subject: str, body: str) -> bool:
        smtp_password = settings.get_smtp_password()
        if settings.smtp_host and settings.smtp_username and smtp_password:
            message = EmailMessage()
            message["From"] = settings.email_from
            message["To"] = to_address
            message["Subject"] = subject
            message.set_content(body)

            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.starttls()
                smtp.login(settings.smtp_username, smtp_password)
                smtp.send_message(message)
            return True

        return False


email_service = EmailService()
