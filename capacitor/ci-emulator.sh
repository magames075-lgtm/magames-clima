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

# 1) GPS NEGADO → busca
start; sleep 6; dismiss
tapid 'permission_deny_button|Don.t allow|DENY|Deny' && res "STEP gps-negado-dialogo PASS" || res "STEP gps-negado-dialogo FAIL (diálogo não apareceu)"
sleep 4; shot 01-gps-negado
step denied
step search Guaraciama
shot 02-busca-guaraciama
step info
step share
step search 'São Paulo'
step search 'Lisboa'
step search 'Guaraciama'
shot 03-tela-principal
adb shell input swipe 300 1400 300 500 300; sleep 1; shot 04-rolagem
adb shell input swipe 300 1400 300 300 300; sleep 1; shot 05-rolagem2

# 2) GPS PERMITIDO
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION; adb shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION
adb emu geo fix -43.67306 -17.01389 772; sleep 2; adb emu geo fix -43.67306 -17.01389 772
step gps
shot 06-gps-permitido

# 3) ROTAÇÃO
adb shell settings put system user_rotation 1; sleep 4; shot 07-paisagem
step state main
adb shell settings put system user_rotation 0; sleep 4; shot 08-retrato
step state main

# 4) NOTIFICAÇÃO
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null
step notif
sleep 3
adb shell dumpsys notification --noredact | grep -iE "Teste ClimaA|chuva|$PKG" | head -20 > $O/notificacoes.txt
grep -q "Teste ClimaA\|pkg=$PKG" $O/notificacoes.txt && res "STEP notificacao-na-barra PASS" || res "STEP notificacao-na-barra FAIL"
adb shell cmd statusbar expand-notifications; sleep 2; shot 09-notificacao; adb shell cmd statusbar collapse

# 5) SEM INTERNET
net_off() { adb shell svc wifi disable; adb shell svc data disable; adb shell cmd connectivity airplane-mode enable 2>/dev/null
  if [ "$API" -lt 30 ]; then adb root; sleep 3; adb wait-for-device; adb shell settings put global airplane_mode_on 1; adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true; adb shell svc wifi disable; sleep 2; fi
  sleep 5; adb shell ping -c1 -W3 8.8.8.8 >/dev/null 2>&1 && res "STEP sem-internet-de-verdade FAIL (ainda pinga)" || res "STEP sem-internet-de-verdade PASS"; }
net_on() { adb shell cmd connectivity airplane-mode disable 2>/dev/null; if [ "$API" -lt 30 ]; then adb shell settings put global airplane_mode_on 0; adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false; fi; adb shell svc wifi enable; adb shell svc data enable; sleep 8
  if [ "$API" -lt 30 ]; then adb unroot; sleep 3; adb wait-for-device; fi; }
net_off
adb shell am force-stop $PKG; start; sleep 10
shot 10-sem-internet
step offline
net_on
step online
shot 11-internet-voltou

# 6) FECHAR E REABRIR 20 VEZES (alternando force-stop e botão voltar)
OKC=0
for i in $(seq 1 20); do
  if [ $((i % 2)) -eq 0 ]; then adb shell am force-stop $PKG; else adb shell input keyevent KEYCODE_BACK; sleep 1; fi
  start; sleep 4
  F=$(adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | grep -c "$PKG")
  P=$(adb shell pidof $PKG | tr -d '\r')
  [ "$F" -ge 1 ] && [ -n "$P" ] && OKC=$((OKC+1)) || echo "reabrir $i: foco=$F pid=$P"
done
[ $OKC -eq 20 ] && res "STEP reabrir-20x PASS ($OKC/20)" || res "STEP reabrir-20x FAIL ($OKC/20)"
step state main
shot 12-depois-de-reabrir
CR=$(crashcheck); [ "$CR" -eq 0 ] && res "STEP sem-crash-debug PASS" || res "STEP sem-crash-debug FAIL ($CR)"
adb logcat -d | grep -E "AndroidRuntime|FATAL EXCEPTION|ANR in|Capacitor/Console.*(rror|ncaught)|chromium.*Uncaught" > $O/logcat-erros-debug.txt
adb logcat -d --pid=$(adb shell pidof $PKG | tr -d '\r') > $O/logcat-app-debug.txt 2>/dev/null

# 7) MONKEY no APK de release (assinatura de teste), 5000+ eventos
adb uninstall $PKG
adb install -r release-test.apk
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION; adb shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION; adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null
adb logcat -c
start; sleep 12; shot 13-release-abertura
TOTAL=0; MCR=0
for seed in 11 22 33; do
  adb shell monkey -p $PKG -s $seed --throttle 40 --pct-syskeys 2 --pct-appswitch 2 -v 1800 > $O/monkey-$seed.txt 2>&1
  N=$(grep -o "Events injected: [0-9]*" $O/monkey-$seed.txt | grep -o "[0-9]*$"); TOTAL=$((TOTAL + ${N:-0}))
  grep -qE "// CRASH|NOT RESPONDING|ANR" $O/monkey-$seed.txt && MCR=$((MCR+1))
  adb shell settings put system user_rotation 0
  start; sleep 2
done
CR=$(crashcheck)
if [ "$CR" -gt 0 ] || [ $MCR -gt 0 ]; then adb root; sleep 3; adb wait-for-device; adb pull /data/anr $O/anr; adb logcat -d -b crash > $O/logcat-crash.txt; adb unroot; sleep 3; adb wait-for-device; fi
echo "MONKEY eventos=$TOTAL crash_runs=$MCR logcat_crash=$CR" | tee $O/monkey-total.txt
[ $TOTAL -ge 5000 ] && [ $MCR -eq 0 ] && [ "$CR" -eq 0 ] && res "STEP monkey PASS ($TOTAL eventos)" || res "STEP monkey FAIL ($TOTAL eventos, crash_runs=$MCR, logcat=$CR)"
start; sleep 5; shot 14-depois-do-monkey
F=$(adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | grep -c "$PKG"); [ "$F" -ge 1 ] && res "STEP vivo-depois-monkey PASS" || res "STEP vivo-depois-monkey FAIL"
adb shell dumpsys package $PKG | grep -E "versionCode|versionName" >> $O/version.txt
adb logcat -d | grep -E "AndroidRuntime|FATAL EXCEPTION|ANR in" > $O/logcat-erros-release.txt
adb shell dumpsys window | grep mCurrentFocus >> $O/version.txt
echo "== RESUMO API $API =="; cat $R
echo "PASS=$(grep -c ' PASS' $R) FAIL=$(grep -c ' FAIL' $R)" | tee $O/summary.txt
exit 0
