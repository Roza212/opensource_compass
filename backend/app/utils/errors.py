def sanitize_error(e: Exception) -> str:
    err_msg = str(e)
    if "521" in err_msg and "Web server is down" in err_msg:
        return "Supabase Database is offline or paused. Please restore your project in the Supabase Dashboard."
    if "getaddrinfo failed" in err_msg or "Name or service not known" in err_msg:
        return "Database connection failed. Please verify that your SUPABASE_URL in the .env file is correct."
    if len(err_msg) > 300:
        return f"An unexpected error occurred: {err_msg[:200]}... [Error truncated]"
    return err_msg
