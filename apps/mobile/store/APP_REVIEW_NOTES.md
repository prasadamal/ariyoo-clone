# App Review notes — Ariyoo (paste into Apple / Google)

## Before you submit

Reviewers need two working accounts **on the production server**. Create them in the app itself
(the demo seed script refuses to run in production, on purpose):

1. Register `reviewer-asker@YOUR-DOMAIN` — leave "answer questions as an expert" off.
2. Register `reviewer-expert@YOUR-DOMAIN` — turn expert mode on, then Profile → add the topic `goa`.
3. Use a strong password you do not use anywhere else, and put both in the review form's
   "Sign-in required" fields (Apple) / App access section (Google).

## Notes to paste

```
Ariyoo lets a member ask a question and chat with another member who offers to answer it.

Sign in:  reviewer-asker@YOUR-DOMAIN / <password>
Second account (answers questions): reviewer-expert@YOUR-DOMAIN / <password>

To test:
1. Sign in as the asker. On the Ask tab type "Quiet beaches near Palolem? #goa" and tap
   "Send to experts". The conversation opens.
2. Sign in as the expert on another device (or after signing out). Chats shows the question.
   Reply to it. The asker receives the reply.
3. Tap the photo button in a conversation to send an image from the system photo picker
   (no photo permission is requested).

User-generated content safeguards (guideline 1.2):
- Terms of Use with zero tolerance for abusive content must be accepted at sign-up.
- Report and Block: menu (⋮) at the top right of any conversation. Blocking is immediate
  and hides the conversation for both people.
- Messages are screened against a blocklist before they are sent.
- Reports are reviewed within 24 hours; offending accounts are suspended or removed.
- Contact: support@ariyoo.app

Account deletion (guideline 5.1.1(v)): Profile tab → Delete account → enter password.
It deletes the account, its conversations and photos immediately.

Notifications are used only for new questions and replies and contain no message text.
The app has no purchases, ads or tracking.
```

## URLs for the forms

| Field | URL |
| --- | --- |
| Privacy policy | https://prasadamal.github.io/ariyoo-clone/privacy/ariyoo.html |
| Terms of use (Apple "License Agreement" / EULA link) | https://prasadamal.github.io/ariyoo-clone/privacy/ariyoo-terms.html |
| Account deletion (Google Play "Delete account URL") | https://prasadamal.github.io/ariyoo-clone/privacy/ariyoo-delete-account.html |

The pages go live after the "Deploy privacy policies" workflow has run on `main`
(see `docs/STORE_START_HERE.md`).
