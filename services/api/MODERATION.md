# Moderation runbook — Ariyoo

Both stores require that reports about user content are acted on, and Ariyoo's Terms promise a
review **within 24 hours**. Someone has to own this from the day the app is public.

Set `ADMIN_API_KEY` on the API host (a random string of 24+ characters; `/admin` answers 503
until it is set). All calls send it as the `x-admin-key` header.

```bash
API=https://YOUR-API-HOST
KEY=...   # ADMIN_API_KEY
```

## Daily: read the queue

```bash
curl -s "$API/admin/reports" -H "x-admin-key: $KEY"
```

Each open report shows who reported whom, the reason, and the reported person's last 20
messages in that conversation.

## Act

```bash
# Suspend (signs them out everywhere, blocks sign-in, stops notifications)
curl -s -X POST "$API/admin/users/USER_ID/suspend" -H "x-admin-key: $KEY" \
  -H "Content-Type: application/json" -d '{"suspended":true}'

# Lift a suspension
curl -s -X POST "$API/admin/users/USER_ID/suspend" -H "x-admin-key: $KEY" \
  -H "Content-Type: application/json" -d '{"suspended":false}'

# Close the report: "resolved" (action taken) or "dismissed" (no violation)
curl -s -X POST "$API/admin/reports/REPORT_ID" -H "x-admin-key: $KEY" \
  -H "Content-Type: application/json" -d '{"status":"resolved"}'
```

Guideline: threats, sexual content involving minors, or scams → suspend at once and report to
the authorities where the law requires it. Harassment or hate → suspend. Spam → suspend.
Rudeness without a rule broken → dismiss; the reporter has already blocked the person.

## Deletion requests by email

The public deletion page promises deletion within 30 days for people who cannot use the app.
Confirm the request comes from the account's own address, then:

```bash
curl -s "$API/admin/users?email=person@example.com" -H "x-admin-key: $KEY"     # find the id
curl -s -X DELETE "$API/admin/users/USER_ID" -H "x-admin-key: $KEY"            # delete everything
```

## Forgotten passwords

There is no self-service reset yet. For now, verify the person by email and delete the account
so they can register again, or add a reset flow (it needs an email provider) before the user
base grows.

## Blocklist

Messages, names and topics are screened against a short built-in list. Add words or phrases
with the `CONTENT_BLOCKLIST` environment variable (comma-separated) and restart the API.
