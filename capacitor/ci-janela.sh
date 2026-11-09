#!/bin/bash
# Bateria de testes do ClimaA no emulador. Saída: out/<API>/ (prints, logs, results.txt)
set -x
PKG=com.magames.clima
API=${API:-$(adb shell getprop ro.build.version.sdk | tr -d '\r')}
O=out/api$API; mkdir -p $O
R=$O/results.txt; : > $R
shot() { dismiss; adb exec-out screencap -p > $O/$1.png; }
res() { echo "$1" | tee -a $R; }
fwd() { # liga a porta 9222 ao DevTools da WebView do app
  adb forward --remove-all
  for i in $(seq 1 30); do SOCK=$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_$(adb shell pidof $PKG | tr -d '\r')" | head -1); [ -n "$SOCK" ] && break; SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1); [ -n "$SOCK" ] && break; sleep 1; done
  adb forward tcp:9222 localabstract:$SOCK
}
step() { fwd; O=$O timeout 300 node ci-step.mjs "$@" 2>&1 | tee -a $O/steps.log | grep '^RESULT' | tee -a $R; }
tapid() { # toca no botão pelo resource-id (diálogo de permissão)
  for i in $(seq 1 15); do
    adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml $O/u.xml >/dev/null 2>&1
    B=$(python3 - "$1" $O/u.xml <<'P'
import sys,re
s=open(sys.argv[2],encoding='utf8',errors='ignore').read()
for m in re.finditer(r'<node [^>]*>', s):
    n=m.group(0)
    if re.search(sys.argv[1], n):
        b=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if b: x1,y1,x2,y2=map(int,b.groups()); print((x1+x2)//2,(y1+y2)//2); break
P
)
    if [ -n "$B" ]; then adb shell input tap $B; echo "tapped $1 at $B"; return 0; fi
    sleep 1
  done
  echo "não achei $1"; return 1
}
start() { adb shell am start -W -n $PKG/.MainActivity >/dev/null; }
crashcheck() { C=$(adb logcat -d | grep -cE "Process: $PKG, PID|ANR in $PKG|Fatal signal.*\($PKG\)|>>> $PKG <<<"); echo $C; } # só o nosso app (o System UI do emulador às vezes cai)
dismiss() { # fecha "System UI parou" e afins do emulador
  for k in 1 2 3; do adb shell uiautomator dump /sdcard/d.xml >/dev/null 2>&1; adb pull /sdcard/d.xml /tmp/d.xml >/dev/null 2>&1
    B=$(python3 -c "
import re,sys
s=open('/tmp/d.xml',encoding='utf8',errors='ignore').read()
m=re.search(r'resource-id=\"android:id/(aerr_close|aerr_wait|button1)\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]', s)
print('' if not m else '%d %d'%((int(m.group(2))+int(m.group(4)))//2,(int(m.group(3))+int(m.group(5)))//2))" 2>/dev/null)
    [ -z "$B" ] && return 0; echo "fechando diálogo do sistema em $B"; adb shell input tap $B; sleep 2; done; }

adb shell settings put global window_animation_scale 0; adb shell settings put global transition_animation_scale 0; adb shell settings put global animator_duration_scale 0
adb shell settings put system accelerometer_rotation 0; adb shell settings put system user_rotation 0
adb install -r debug-test.apk || adb install -r -t debug-test.apk
adb shell dumpsys package $PKG | grep -E "versionCode|versionName" | tee $O/version.txt
adb shell svc power stayon true; adb shell settings put secure lockscreen.disabled 1; adb shell wm dismiss-keyguard; adb shell input keyevent 82
sleep 15; dismiss; adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null
adb logcat -c
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION; adb shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null
adb emu geo fix -43.67306 -17.01389 772; sleep 2
start; sleep 8; dismiss; adb emu geo fix -43.67306 -17.01389 772
step info
step gps
step search Guaraciama
shot 01-principal
step janela
shot 02-janela
adb shell input swipe 540 1200 540 700 400; sleep 3; shot 03-janela-arrasto
res "CRASH $(crashcheck)"
adb logcat -d | grep -iE "chromium|webgl|maplibre|Refused|Console" | tail -120 > $O/webview.log
cat $R
