import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageName = 'com.jainigtm.deadwater.stagnes'
const packagePath = packageName.replaceAll('.', '/')
const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml')
const activityPath = resolve(root, `android/app/src/main/java/${packagePath}/MainActivity.java`)
const backgroundPath = resolve(root, 'android/app/src/main/res/values/ic_launcher_background.xml')
const stringsPath = resolve(root, 'android/app/src/main/res/values/strings.xml')
const buildGradlePath = resolve(root, 'android/app/build.gradle')

let manifest = readFileSync(manifestPath, 'utf8')
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"')
if (!manifest.includes('android:hardwareAccelerated=')) {
  manifest = manifest.replace(
    'android:allowBackup="false"',
    'android:allowBackup="false"\n        android:hardwareAccelerated="true"',
  )
}
if (!manifest.includes('android:screenOrientation=')) {
  manifest = manifest.replace(
    'android:launchMode="singleTask"',
    'android:launchMode="singleTask"\n            android:screenOrientation="sensorLandscape"',
  )
}
if (!manifest.includes('android.permission.VIBRATE')) {
  manifest = manifest.replace(
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.INTERNET" />\n' +
      '    <uses-permission android:name="android.permission.VIBRATE" />\n' +
      '    <uses-feature android:glEsVersion="0x00020000" android:required="true" />',
  )
}
writeFileSync(manifestPath, manifest)

writeFileSync(
  activityPath,
  `package ${packageName};

import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
        }
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
`,
)

let strings = readFileSync(stringsPath, 'utf8')
strings = strings
  .replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Ashfall: St. Agnes</string>')
  .replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">Ashfall: St. Agnes</string>')
writeFileSync(stringsPath, strings)

let background = readFileSync(backgroundPath, 'utf8')
background = background.replace(/#[0-9A-Fa-f]{6}/, '#1A0D09')
writeFileSync(backgroundPath, background)

let buildGradle = readFileSync(buildGradlePath, 'utf8')
buildGradle = buildGradle.replace(/versionCode \d+/, 'versionCode 312')
buildGradle = buildGradle.replace(/versionName "[^"]+"/, 'versionName "0.18.12-stagnes"')
writeFileSync(buildGradlePath, buildGradle)

console.log('Configured side-by-side Ashfall: St. Agnes Android preview build.')
