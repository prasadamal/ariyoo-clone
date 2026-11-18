# Google Play Data safety & Apple App Privacy — Ariyoo

These match what the app and API do today. Re-check them whenever an SDK, permission or
data field is added.

## Google Play — Data safety

Does the app collect or share user data? **Yes, collects. Shares: No.**
Is all data encrypted in transit? **Yes.** Can users request deletion? **Yes**
(in app, and https://ariyoo-docs.onrender.com/privacy/ariyoo-delete-account.html).

| Data type | Collected | Shared | Required | Purpose |
| --- | --- | --- | --- | --- |
| Personal info → Email address | Yes | No | Required | Account management |
| Personal info → Name | Yes | No | Required | App functionality, account management |
| Personal info → User IDs (username) | Yes | No | Optional | App functionality |
| Messages → Other in-app messages | Yes | No | Required | App functionality |
| Photos and videos → Photos | Yes | No | Optional | App functionality |
| App activity → Other user-generated content (questions, topics) | Yes | No | Required | App functionality |
| Device or other IDs (push notification token) | Yes | No | Optional | App functionality |

Not collected: location, contacts, financial info, health, web history, advertising ID,
crash logs or diagnostics (the app has no analytics or crash SDK).

Other Play declarations:

- **Ads:** No.
- **Target audience:** 18 and over.
- **User-generated content:** Yes — the app has reporting, blocking and moderation.
- **Content rating questionnaire:** users can interact and exchange content: Yes. Shares
  location: No. Purchases: No.
- **Permissions:** Internet, notifications, vibrate. No camera, microphone, media or location.

## Apple — App Privacy

Data **linked to the user**, used for **App Functionality** only, **not** used for tracking:

- **Contact Info:** Email Address, Name
- **User Content:** Photos or Videos; Other User Content (questions, messages, topics)
- **Identifiers:** User ID; Device ID (push token)

Data used to track you: **None.**

Age rating: answer "Yes" to unrestricted user-generated content only if you plan no
moderation; with reporting, blocking and review in place choose the moderated option. Set the
age rating to **17+/18+** to match the Terms.

## Export compliance

Standard encryption only (HTTPS). `ITSAppUsesNonExemptEncryption` is `false` in the app config.
