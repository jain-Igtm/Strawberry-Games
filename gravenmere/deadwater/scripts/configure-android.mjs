import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml')
const activityPath = resolve(
  root,
  'android/app/src/main/java/com/jainigtm/deadwater/MainActivity.java',
)
const backgroundPath = resolve(
  root,
  'android/app/src/main/res/values/ic_launcher_background.xml',
)
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
  `package com.jainigtm.deadwater;

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

let background = readFileSync(backgroundPath, 'utf8')
background = background.replace(/#[0-9A-Fa-f]{6}/, '#1A0D09')
writeFileSync(backgroundPath, background)

let buildGradle = readFileSync(buildGradlePath, 'utf8')
buildGradle = buildGradle.replace(/versionCode \d+/, 'versionCode 36')
buildGradle = buildGradle.replace(/versionName "[^"]+"/, 'versionName "0.19.6"')
writeFileSync(buildGradlePath, buildGradle)

console.log('Configured landscape, fullscreen Ashfall Android 0.19.6 (36) project.')
