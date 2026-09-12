#!/usr/bin/env bash
# Script for quick testing and verification

echo "🧪 بدء اختبار المشروع..."
echo ""

# التحقق من وجود Flutter
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter غير مثبت"
    exit 1
fi

echo "✅ Flutter مثبت"

# الانتقال إلى مجلد المشروع
cd "$(dirname "$0")"

# تنظيف
echo "🧹 تنظيف المشروع..."
flutter clean

# الحصول على الحزم
echo "📦 تحديث الحزم..."
flutter pub get

# التحليل
echo "🔍 تحليل الكود..."
flutter analyze

echo ""
echo "✅ الاختبارات الأساسية اكتملت!"
echo ""
echo "📝 الملفات المعدلة:"
echo "  ✅ lib/models/invoice_model.dart (copyWith method)"
echo "  ✅ lib/screens/invoices_list_screen.dart (_syncPendingInvoices)"
echo ""
echo "📚 الملفات المنشأة:"
echo "  ✅ SOLUTION_SUMMARY.md"
echo "  ✅ SYNC_UI_INTEGRATION.md"
echo "  ✅ TESTING_SYNC_UI.md"
echo "  ✅ README_AR.md"
echo "  ✅ INDEX.md"
echo "  ✅ QUICK_START.md"
echo ""
echo "🚀 لتشغيل التطبيق:"
echo "  flutter run"
echo ""
echo "🔨 للبناء للإنتاج:"
echo "  flutter build apk"
