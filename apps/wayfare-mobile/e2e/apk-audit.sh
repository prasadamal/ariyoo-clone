#!/usr/bin/env bash
# Release audit of the APK, the checks Google Play runs at upload and pre-launch.
set -u
APK="$1"
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
echo "== APK audit: $(basename "$APK") ($(du -h "$APK" | cut -f1)), build-tools $(basename "$BT")"
"$BT/aapt2" dump badging "$APK" > badging.txt 2>&1
grep -E "^package:|sdkVersion|targetSdkVersion|application-debuggable|native-code" badging.txt
echo "-- Permissions"
grep -E "^uses-permission" badging.txt | sed -E "s/uses-permission: name='([^']+)'.*/\1/"
echo "-- Manifest flags"
"$BT/aapt2" dump xmltree --file AndroidManifest.xml "$APK" > manifest.txt 2>&1
for f in debuggable allowBackup usesCleartextTraffic networkSecurityConfig fullBackupContent dataExtractionRules; do
  grep -m1 -E "android:$f" manifest.txt || echo "  $f: (not set)"
done
echo "-- Exported components (must be intentional)"
python3 - <<'PY'
import re
t = open('manifest.txt', errors='ignore').read()
blocks = re.split(r'\n\s*E: (?=activity|service|receiver|provider)', t)
for b in blocks[1:]:
    kind = b.split()[0]
    name = re.search(r'android:name\(0x[0-9a-f]+\)="([^"]+)"', b)
    exp = re.search(r'android:exported\(0x[0-9a-f]+\)=\(type 0x12\)0x(\w+)', b)
    if exp and exp.group(1) != '0':
        print(f'  exported {kind}: {name.group(1) if name else "?"}')
PY
echo "-- 16 KB page size (Play requires it for new apps from Nov 2025)"
if "$BT/zipalign" -c -P 16 -v 4 "$APK" > zipalign.txt 2>&1; then echo "  zipalign -P 16: PASS"; else echo "  zipalign -P 16: FAIL"; grep -v "(OK" zipalign.txt | head -10; fi
mkdir -p so && unzip -q -o "$APK" 'lib/arm64-v8a/*.so' -d so 2>/dev/null
bad=0; total=0
for so in so/lib/arm64-v8a/*.so; do
  total=$((total+1))
  if readelf -lW "$so" | awk '/LOAD/ {print $NF}' | grep -qvE '0x4000|0x10000'; then bad=$((bad+1)); echo "  not 16 KB aligned: $(basename "$so")"; fi
done
echo "  arm64 libraries checked: $total, misaligned: $bad"
echo "-- Signature"
"$BT/apksigner" verify --print-certs "$APK" 2>&1 | grep -E "Signer #1 certificate DN|Verified using|DOES NOT VERIFY" | head -5
echo "-- Size by part"
unzip -l "$APK" | awk 'NR>3 {split($4,p,"/"); s[p[1]]+=$1} END {for (k in s) if (s[k] > 500000) printf "  %-28s %6.1f MB\n", k, s[k]/1048576}' | sort -k2 -nr
