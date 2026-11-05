#!/bin/bash
# Ajustes no projeto Android gerado pelo Capacitor (rodado no CI)
set -e
M=android/app/src/main/AndroidManifest.xml
grep -q ACCESS_FINE_LOCATION $M || sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />#' $M
grep -q ACCESS_FINE_LOCATION $M
G=android/app/build.gradle
sed -i 's/versionCode 1$/versionCode 1/; s/versionName "1.0"/versionName "1.0.0"/' $G
# ícone adaptativo + ícone da notificação
cp -r ../res/* android/app/src/main/res/
cat $M
