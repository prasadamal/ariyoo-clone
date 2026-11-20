# Ariyoo corporate API

Java 21 · Spring Boot 3.5 · PostgreSQL · Flyway. The small backend behind the corporate website
(`apps/corporate-web`): contact form, newsletter, careers, press and an admin inbox. It is separate from
the product API in `services/api`.

## Run it

```bash
# needs a PostgreSQL database
DATABASE_URL=jdbc:postgresql://localhost:5432/ariyoo_corporate DATABASE_USER=postgres DATABASE_PASSWORD=... \
ADMIN_API_KEY=<long random string> mvn spring-boot:run
mvn test        # 11 tests, in-memory database, no setup
```

| Variable | Meaning |
|---|---|
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | PostgreSQL (JDBC URL). Migrations run on start. |
| `CORS_ORIGINS` | Comma-separated website addresses allowed to call the API from a browser. **Set it in production.** |
| `ADMIN_API_KEY` | Key for `/api/admin/**`. Leave empty and the admin API does not exist (404). |
| `FORM_RATE_LIMIT` | Public form posts per address per minute (default 5). |
| `PORT` | Default 8080. |

## Public API

| | |
|---|---|
| `POST /api/contact` | `{name, email, topic, organisation?, message}`. Topics: general, partnership, investor, press, support, careers. |
| `POST /api/newsletter/subscribe`, `/unsubscribe` | Same answer for new and existing addresses. |
| `GET /api/jobs`, `/api/jobs/{slug}`, `POST /api/applications` | Open roles (empty until published) and applications. |
| `GET /api/press`, `/api/press/{slug}` | Published news only. |
| `GET /actuator/health` | Health check. |

Forms carry a hidden decoy field: a filled one looks successful but stores nothing. Errors are always
`{code, message, fields?}` and never include internals.

## Admin (header `X-Admin-Key`)

```bash
curl -H "X-Admin-Key: $KEY" https://<api>/api/admin/inbox                       # contact messages and applications
curl -X POST -H "X-Admin-Key: $KEY" -H 'Content-Type: application/json' https://<api>/api/admin/jobs \
  -d '{"slug":"backend-engineer","title":"Backend Engineer","team":"Engineering","location":"Bengaluru","employment":"Full-time","summary":"..."}'
curl -X DELETE -H "X-Admin-Key: $KEY" https://<api>/api/admin/jobs/backend-engineer
# press: POST /api/admin/press {slug,title,summary,body,publishedAt?}   DELETE /api/admin/press/{slug}
```

## Not built yet

- **No email is sent.** Messages are stored and read from the admin inbox. Sending notifications and a
  newsletter confirmation needs a sending domain (not bought yet).
- Newsletter has no double opt-in until email sending exists.
- No résumé upload: applicants share a link instead.
