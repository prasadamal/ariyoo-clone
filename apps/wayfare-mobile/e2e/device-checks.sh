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

texts() {  # what is on screen now, for the log when a step fails
  adb shell uiautomator dump /sdcard/now.xml > /dev/null 2>&1
  adb shell cat /sdcard/now.xml 2>/dev/null | grep -oE '(text|content-desc)="[^"]+"' | sed -E 's/^[a-z-]+="(.*)"$/\1/' | head -40 | paste -sd'|' -
}
alive() { adb shell pidof $PKG > /dev/null 2>&1 && echo yes || echo no; }
flow() {  # name, file
  if maestro test --format junit --output "$OUT/$1.xml" --test-output-dir "$OUT/screens" "$E2E/maestro/$2" > "$OUT/$1.log" 2>&1; then
    say "- Flow $1: PASS"
  else
    say "- Flow $1: FAIL"; grep -E '\[Failed\]|Assertion|not found' "$OUT/$1.log" | head -5 | sed 's/^/    /' | tee -a "$SUM" > /dev/null
    say "    on screen: $(texts)"
  fi
}
keyboard() {  # label, button regex
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/$1-ui.xml" > /dev/null 2>&1
  adb shell dumpsys window windows > "$OUT/$1-window.txt" 2>&1
  adb shell dumpsys window >> "$OUT/$1-window.txt" 2>&1
  adb shell dumpsys input_method >> "$OUT/$1-window.txt" 2>&1
  adb exec-out screencap -p > "$OUT/screens/$1-keyboard.png"
  r=$(python3 "$E2E/keyboard_check.py" "$OUT/$1-ui.xml" "$OUT/$1-window.txt" "$2" "$1")
  say "- $r"
  case "$r" in *UNKNOWN*) grep -iE "type=ime|ITYPE_IME|InputMethod" "$OUT/$1-window.txt" | head -6 | cut -c1-220 | sed 's/^/    /' | tee -a "$SUM" > /dev/null;; esac
}

flow guest-plan 01-guest-plan.yaml
keyboard plan-sheet '^Add plan$'
flow expense 02-expense.yaml
keyboard expense-sheet '^Add ₹'
flow second-journey 03-second-journey.yaml
flow light-swipe-keeps-list-closed 04-light-swipe.yaml
flow firm-swipe-opens-list 05-firm-swipe.yaml

# Robustness checks the big app stores run: the app killed in the background (Android does this
# to free memory), no network at launch, very large text, dark mode, and a low-memory signal.
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity > /dev/null 2>&1; sleep 6
adb shell input keyevent KEYCODE_HOME; sleep 2
adb shell am kill $PKG; sleep 2
adb shell am start -W -n $PKG/.MainActivity > /dev/null 2>&1; sleep 8
if [ "$(alive)" = yes ] && texts | grep -q "Device test trip"; then say "- Killed in background, reopened: PASS (journeys still there)"; else say "- Killed in background, reopened: FAIL · on screen: $(texts)"; fi
adb exec-out screencap -p > "$OUT/screens/09-after-process-death.png"

adb shell am force-stop $PKG
adb shell svc wifi disable; adb shell svc data disable; sleep 2
adb shell am start -W -n $PKG/.MainActivity > /dev/null 2>&1; sleep 10
if [ "$(alive)" = yes ] && texts | grep -q "Device test trip"; then say "- Launch with no network: PASS"; else say "- Launch with no network: FAIL · on screen: $(texts)"; fi
adb exec-out screencap -p > "$OUT/screens/10-offline-launch.png"
adb shell svc wifi enable; adb shell svc data enable

adb shell am force-stop $PKG
adb shell settings put system font_scale 1.3
adb shell cmd uimode night yes; sleep 2
adb shell am start -W -n $PKG/.MainActivity > /dev/null 2>&1; sleep 8
adb exec-out screencap -p > "$OUT/screens/11-dark-large-text-home.png"
adb shell input tap 540 900; sleep 4
adb exec-out screencap -p > "$OUT/screens/12-dark-large-text-trip.png"
adb shell am send-trim-memory $PKG RUNNING_CRITICAL > /dev/null 2>&1; sleep 3
if [ "$(alive)" = yes ]; then say "- Dark mode + 130% text + low-memory signal: PASS (still running)"; else say "- Dark mode + 130% text + low-memory signal: FAIL (app closed)"; fi
adb shell settings put system font_scale 1.0
adb shell cmd uimode night no
adb logcat -d > "$OUT/logcat-robust.txt"
rc=$(grep -cE "FATAL EXCEPTION|ANR in $PKG" "$OUT/logcat-robust.txt" || true)
say "- Crashes or freezes during these checks: $rc"

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
