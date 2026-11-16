# Wayfare release device checks

Use isolated staging accounts and test trips. Run on both signed Android and iOS builds. Passing TypeScript, unit, bundle and SQL/HTTP checks does not prove native behavior.

Record the build version, device/OS, account aliases, result and failure recovery. Do not log tokens, chat contents or precise coordinates.

1. Cold start with an existing guest journal: guest restoration completes before routing, and the journal stays available offline.
2. Sign in to account A, then switch to B with A's unsynced trips still on the phone. Journal contents stay covered/noninteractive, sync stays paused, and ownership resolution offers retry/sign-out rather than adopting A's data. Test a failed local database read and a rapid A → B → A transition.
3. In the ownership dialog, tap each action repeatedly. Only one operation runs. Test failure/retry. Sign-out stops local recording and clearly preserves any older owner's live link for that owner to revoke.
4. Open the microphone permission prompt, navigate away/cancel while preparation is pending, and confirm the microphone never starts after the screen closes. Tap record/stop rapidly; only one recorder and one saved clip exist. Simulate a save failure and verify an existing moment is retained.
5. Start route recording, then live sharing. Stop each independently; the remaining activity continues. Start/stop rapidly, switch battery/precise mode, deny permissions and force a start failure; persisted intent matches the OS service after retry/restart.
6. End a live link online. Its public API/viewer immediately reports inactive and has null latitude/longitude/accuracy. Retry ending in airplane mode: failure remains visible and local retry information is retained. Sign back into its owner account if RLS denies revocation from a different account.
7. Sign out, delete the account and remove device data while sync/recording is active (separate runs). Native activity shuts down before destructive cleanup. Force each preflight failure; the app must not report completion or wipe first. After success, foreground/restart the app and confirm no late route points or voice clips recreate wiped rows.
8. Check normal sign-in/sign-out, recovery from ownership errors, deep links and modal screens for navigation-before-root-mount errors. Verify screen-reader focus does not enter covered journal content.

The local SQLite journal is shared by the installation rather than physically partitioned per account. Separate background JS runtimes and native callbacks require these explicit tests. Production release stays blocked until results are recorded.
