#!/usr/bin/env bash
# Runs on an Android emulator in CI: install the real APK, scripted flows (Maestro), keyboard
# geometry, cold start, Google's monkey stress test, crash/ANR scan, memory. Writes summary.md.
set -u
APK="$1"; OUT="$2"; PKG=com.wayfare.app
mkdir -p "$OUT/screens"
E2E="$(cd "$(dirname "$0")" && pwd)"
SUM="$OUT/summary.md"
say() { echo "$*" | tee -a "$SUM"; }
export PATH="$PATH:$HOME/.maestro/bin"

say "## Device checks ($(adb shell getprop ro.build.version.release | tr -d '\r') / API $(adb shell getprop ro.build.version.sdk | tr -d '\r'), $(adb shell wm size | tr -d '\r'))"
adb logcat -c
if adb install -r "$APK" > "$OUT/install.txt" 2>&1; then say "- Install: PASS"; else say "- Install: FAIL ($(tail -1 "$OUT/install.txt"))"; exit 0; fi

# Cold start: three launches from scratch.
times=""
for i in 1 2 3; do
  adb shell am force-stop $PKG; sleep 2
  t=$(adb shell am start -W -n $PKG/.MainActivity 2>/dev/null | tr -d '\r' | awk -F': ' '/TotalTime/ {print $2}')
  times="$times ${t:-?}"; sleep 6
done
say "- Cold start (ms, 3 launches):$times"

flow() {  # name, file
  if maestro test --format junit --output "$OUT/$1.xml" --test-output-dir "$OUT/screens" "$E2E/maestro/$2" > "$OUT/$1.log" 2>&1; then
    say "- Flow $1: PASS"
  else
    say "- Flow $1: FAIL"; tail -25 "$OUT/$1.log" | sed 's/^/    /' | tee -a "$SUM" > /dev/null
  fi
}
keyboard() {  # label, button regex
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/$1-ui.xml" > /dev/null 2>&1
  adb shell dumpsys window windows > "$OUT/$1-window.txt" 2>&1
  adb shell dumpsys input_method >> "$OUT/$1-window.txt" 2>&1
  adb exec-out screencap -p > "$OUT/screens/$1-keyboard.png"
  say "- $(python3 "$E2E/keyboard_check.py" "$OUT/$1-ui.xml" "$OUT/$1-window.txt" "$2" "$1")"
}

flow guest-plan 01-guest-plan.yaml
keyboard plan-sheet '^Add plan$'
flow expense 02-expense.yaml
keyboard expense-sheet '^Add ₹'
flow home-swipe 03-home-swipe.yaml

# Google's UI Exerciser Monkey: random taps, swipes and keys inside the app only.
adb shell am force-stop $PKG
adb logcat -c
adb shell monkey -p $PKG --throttle 120 --pct-syskeys 0 --pct-appswitch 0 --ignore-security-exceptions -s 42 -v 4000 > "$OUT/monkey.txt" 2>&1
if grep -q "Monkey finished" "$OUT/monkey.txt"; then say "- Monkey (4,000 random events): finished"; else say "- Monkey (4,000 random events): STOPPED EARLY — $(grep -m1 -E 'CRASH|NOT RESPONDING|aborted' "$OUT/monkey.txt")"; fi
adb logcat -d > "$OUT/logcat.txt"
crashes=$(grep -cE "FATAL EXCEPTION|AndroidRuntime: Process: $PKG" "$OUT/logcat.txt" || true)
anrs=$(grep -c "ANR in $PKG" "$OUT/logcat.txt" || true)
jserr=$(grep -cE "ReactNativeJS.*(Error|TypeError)" "$OUT/logcat.txt" || true)
say "- Crashes: $crashes · ANRs (freezes): $anrs · JS errors logged: $jserr"
if [ "$crashes" != "0" ] || [ "$jserr" != "0" ]; then
  grep -A12 -E "FATAL EXCEPTION|ReactNativeJS.*(Error|TypeError)" "$OUT/logcat.txt" | head -60 | sed 's/^/    /' | tee -a "$SUM" > /dev/null
fi
adb shell am start -W -n $PKG/.MainActivity > /dev/null 2>&1; sleep 8
mem=$(adb shell dumpsys meminfo $PKG | tr -d '\r' | awk '/TOTAL PSS|TOTAL:/ {print $3; exit}')
say "- Memory after the run (PSS): $((${mem:-0} / 1024)) MB"
