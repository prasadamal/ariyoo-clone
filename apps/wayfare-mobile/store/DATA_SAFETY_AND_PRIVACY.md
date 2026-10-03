# Google Play Data safety & Apple App Privacy — Wayfare

## Google Play — Data safety

| Question | Answer |
| --- | --- |
| Collects data? | Yes (when signed in / sync) |
| **Email** | Account, not sold |
| **Photos** | User-selected journal attachments, not sold |
| **Location** | Precise location **only when user starts route recording** |
| **User-generated content** | Journal, budget notes, not sold |
| Encrypted in transit | Yes |
| Deletion requests | privacy@ariyoo.app |

Offline-only usage without account: data stays on device (declare accordingly if you ship offline-only flavor).

## Apple — App Privacy

- **Contact Info:** Email — linked — app functionality
- **User Content:** Journal, photos — linked — app functionality
- **Location:** Precise — linked — app functionality (route feature)
- **Tracking:** No

## Export compliance

HTTPS only; `usesNonExemptEncryption: false` in app config.
