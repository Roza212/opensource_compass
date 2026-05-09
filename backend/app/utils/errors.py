import math


def sanitize_error(e: Exception) -> str:
    """
    Converts raw Python/Supabase exceptions into clean, user-facing messages.
    Prevents raw Cloudflare HTML, stack traces, and overly long strings from
    reaching the React UI.
    """
    err_msg = str(e)

    if "521" in err_msg and "Web server is down" in err_msg:
        return "Supabase Database is offline or paused. Please restore your project in the Supabase Dashboard."

    if "getaddrinfo failed" in err_msg or "Name or service not known" in err_msg:
        return "Database connection failed. Please verify that your SUPABASE_URL in the .env file is correct."

    if "429" in err_msg or "rate limit" in err_msg.lower() or "too many requests" in err_msg.lower():
        return "You've sent too many requests. Please wait a few minutes before trying again."

    if len(err_msg) > 300:
        return f"An unexpected error occurred: {err_msg[:200]}... [Error truncated]"

    return err_msg


def friendly_rate_limit_message(retry_after_seconds: int) -> str:
    """
    Converts a raw retry_after_seconds value into a human-readable wait message
    for display in the React UI.
    """
    if retry_after_seconds >= 3600:
        hours = math.ceil(retry_after_seconds / 3600)
        return f"You've sent too many requests. Please wait {hours} hour{'s' if hours != 1 else ''}."
    minutes = math.ceil(retry_after_seconds / 60)
    if minutes <= 1:
        return "You've sent too many requests. Please wait a moment."
    return f"You've sent too many requests. Please wait {minutes} minutes."
