#!/bin/bash
set -x
PKG=com.magames.clima
adb install -r debug-test.apk
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS; do adb shell pm grant $PKG android.permission.$p; done
adb emu geo fix -43.67306 -17.01389 772
sleep 2; adb emu geo fix -43.67306 -17.01389 772
adb logcat -c
adb shell am start -n $PKG/.MainActivity
sleep 35
adb exec-out screencap -p > 1-abertura-gps.png
SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
echo "SOCK=$SOCK"
adb forward tcp:9222 localabstract:$SOCK
timeout 900 node ci-test.mjs 2>&1 | tee ci-test.log
adb exec-out screencap -p > 9-final.png
APID=$(adb shell pidof $PKG)
adb logcat -d --pid=$APID > logcat-app-debug.txt
adb logcat -d | grep -E "AndroidRuntime|FATAL EXCEPTION|Capacitor/Console|chromium.*Uncaught" > logcat-erros-debug.txt
adb shell dumpsys notification --noredact | grep -iE "magames|chuva|Teste" > notificacoes.txt
# ---- reabrir SEM INTERNET ----
adb shell svc wifi disable; adb shell svc data disable; sleep 4
adb shell am force-stop $PKG; adb shell am start -n $PKG/.MainActivity; sleep 25
adb exec-out screencap -p > 8-sem-internet.png
SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1); adb forward --remove-all; adb forward tcp:9222 localabstract:$SOCK
timeout 120 node ci-offline.mjs 2>&1 | tee ci-offline.log
adb shell svc wifi enable; adb shell svc data enable; sleep 5
# ---- APK de RELEASE (WebView sem depuração) ----
adb uninstall $PKG
adb install -r release-test.apk
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION
adb shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION
adb logcat -c
adb shell am start -n $PKG/.MainActivity
sleep 35
adb exec-out screencap -p > 10-release-abertura.png
{ echo "pid: $(adb shell pidof $PKG)"; echo "devtools sockets (release pid deve NAO aparecer):"; adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | sort -u; adb shell dumpsys window | grep -E "mCurrentFocus" ; } > release-check.txt
adb logcat -d | grep -E "AndroidRuntime|FATAL EXCEPTION" > logcat-erros-release.txt
adb logcat -d --pid=$(adb shell pidof $PKG) > logcat-app-release.txt
cat release-check.txt
exit 0
