#!/usr/bin/env node
// Fails CI if prebuild output drifts from the store-review-safe configuration.
import { readFileSync, readdirSync, existsSync } from 'node:fs';

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — ${detail}`}`);
  if (!ok) failed++;
};

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const granted = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"\s*\/>/g)].map(m => m[1]);
const has = p => granted.includes(`android.permission.${p}`);

check('Android: RECORD_AUDIO granted (voice notes)', has('RECORD_AUDIO'), 'a plugin removed it');
check('Android: fine/coarse location granted', has('ACCESS_FINE_LOCATION') && has('ACCESS_COARSE_LOCATION'));
check('Android: location foreground service permission', has('FOREGROUND_SERVICE_LOCATION'));
for (const p of ['ACCESS_BACKGROUND_LOCATION', 'CAMERA', 'READ_MEDIA_IMAGES', 'READ_EXTERNAL_STORAGE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'SYSTEM_ALERT_WINDOW']) {
  check(`Android: ${p} not granted`, !has(p), 'would trigger extra Play declarations');
}
check('Android: no media-playback foreground service', !/foregroundServiceType="mediaPlayback"/.test(manifest));

const iosDir = readdirSync('ios').find(d => existsSync(`ios/${d}/Info.plist`));
const plist = readFileSync(`ios/${iosDir}/Info.plist`, 'utf8');
const modes = plist.match(/<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1].match(/<string>(.*?)<\/string>/g) ?? [];
check('iOS: only the location background mode', modes.length === 1 && modes[0] === '<string>location</string>', modes.join(','));
for (const key of ['NSLocationWhenInUseUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSFaceIDUsageDescription']) {
  check(`iOS: ${key}`, plist.includes(`<key>${key}</key>`));
}
check('iOS: no camera/motion strings', !plist.includes('NSCameraUsageDescription') && !plist.includes('NSMotionUsageDescription'));
check('iOS: privacy manifest present', existsSync(`ios/${iosDir}/PrivacyInfo.xcprivacy`));

process.exit(failed ? 1 : 0);
