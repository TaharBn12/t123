#!/usr/bin/env bash
# ============================================================
# تجهيز ملفات منصة أندرويد قبل البناء
# ------------------------------------------------------------
# ملفات Gradle والـ Gradle wrapper وأيقونات التطبيق تُولَّد من قوالب إصدار
# Flutter المثبّت لديك (لتفادي تعارض compileSdk / AGP مع إصدارات أندرويد
# الحديثة)، ثم نُعيد ملفات المشروع المخصّصة من المستودع:
#   AndroidManifest.xml  (اسم التطبيق + صلاحيات الكاميرا)
#   MainActivity.kt      (com.cashierpro.scanner)
#   res/values/styles.xml
#
# الاستخدام (من مجلد app):
#   bash tool/prepare_android.sh
#   flutter build apk --release
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf android/gradlew android/gradlew.bat android/gradle
rm -f android/build.gradle android/build.gradle.kts \
      android/settings.gradle android/settings.gradle.kts \
      android/gradle.properties \
      android/app/build.gradle android/app/build.gradle.kts

flutter create --org com.cashierpro --project-name scanner --platforms android .

git checkout -- pubspec.yaml analysis_options.yaml lib 2>/dev/null || true
git checkout -- android/app/src/main/AndroidManifest.xml \
                android/app/src/main/kotlin \
                android/app/src/main/res/values/styles.xml 2>/dev/null || true

echo "✅ ملفات أندرويد جاهزة (namespace: com.cashierpro.scanner)"
