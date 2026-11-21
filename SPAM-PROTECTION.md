# Spam protection: what exists and what is still needed

## What exists in the frontend now
- A hidden "honeypot" field (`website`). If a simple bot fills it, the form silently does nothing.
- Client-side validation and a double-submit guard.

**This is not production-grade spam protection.** Bots can skip the page and send requests straight to the Edge Function URL, so anything checked only in the browser can be bypassed.

## Needed on the server before public launch
These live in the Edge Function / Supabase. They change the backend, so each one needs your decision.
1. **Bot challenge verified server-side:** for example Cloudflare Turnstile. The browser gets a token and the Edge Function verifies it with the provider's secret key (kept in Supabase secrets, never in the website).
2. **Rate limiting:** limit requests per IP address and per phone number or email in a time window (for example a small table of recent submissions checked by the function).
3. **Strict server-side validation:** re-check every field, allow only known `service` values, cap the size of `details` and each text field, reject unknown or oversized payloads.
4. **Duplicate detection:** block or flag the same phone and service submitted repeatedly in a short time.
5. **CORS allow-list:** allow only your website's address. This stops other websites' browsers from calling it, but it does not stop bots.
6. **Check how leads can be written:** confirm anonymous users cannot insert into `leads` directly through the API, so the Edge Function is the only way in.
7. **Notification safety (if used):** if the function sends emails or messages, limit how many can be triggered so spam cannot flood you or cost money.
8. **Monitoring:** log rejected and suspicious requests, and review them regularly.
9. **Idempotency (optional):** accept a unique request ID so a retried request does not create two leads.
