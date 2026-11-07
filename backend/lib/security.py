"""Security-related constants shared by auth handlers."""

from werkzeug.security import generate_password_hash

# Used to equalize login timing when the email does not exist, so attackers
# cannot distinguish registered emails by response time.
_DUMMY_PASSWORD_HASH = generate_password_hash("studylens-timing-equalizer")
