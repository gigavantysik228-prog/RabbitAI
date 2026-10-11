#!/bin/bash
# Сборка Rabbit AI .apk без Gradle. Использование: ./build.sh https://ваш-сайт.onrender.com
set -e
URL="${1:-https://rabbit-ai.onrender.com}"; URL="${URL%/}"
cd "$(dirname "$0")"
SDK=${SDK:-/data/build/sdk}; BT=$SDK/build-tools/34.0.0; JAR=$SDK/platforms/android-34/android.jar
rm -rf out && mkdir -p out/gen out/classes out/dex
cat > out/gen/BuildConfigUrl.java <<J
package kz.rabbitai.app;
final class BuildConfigUrl { static final String URL = "$URL"; }
J
$BT/aapt2 compile --dir res -o out/res.zip
$BT/aapt2 link -I $JAR --manifest AndroidManifest.xml -A assets -o out/base.apk --java out/gen out/res.zip --min-sdk-version 24 --target-sdk-version 34 --version-code 4 --version-name 3.1
javac -nowarn -Xlint:none --release 11 -encoding UTF-8 -cp $JAR -d out/classes $(find src out/gen -name '*.java') 2>&1 | grep -v "warning" || true
$BT/d8 --release --min-api 24 --lib $JAR --output out/dex $(find out/classes -name '*.class')
cp out/base.apk out/unsigned.apk && (cd out/dex && zip -q ../unsigned.apk classes.dex)
$BT/zipalign -p -f 4 out/unsigned.apk out/aligned.apk
[ -f rabbit.keystore ] || keytool -genkeypair -keystore rabbit.keystore -storepass rabbitai -keypass rabbitai -alias rabbit -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Rabbit AI, O=Rabbit AI, C=KZ" >/dev/null 2>&1
$BT/apksigner sign --ks rabbit.keystore --ks-pass pass:rabbitai --key-pass pass:rabbitai --out out/rabbit-ai.apk out/aligned.apk
$BT/apksigner verify out/rabbit-ai.apk && echo "APK готов: out/rabbit-ai.apk ($URL)"
