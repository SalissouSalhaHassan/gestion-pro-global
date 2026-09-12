# Gestion Pro Mobile

تطبيق جوال متقدم لإدارة المبيعات والمخزون والعملاء | Advanced Mobile Business Management Application

## نظرة عامة / Overview

تطبيق Flutter شامل لإدارة العمليات التجارية:
- ✅ إدارة المبيعات والفواتير
- ✅ إدارة المخزون والمنتجات  
- ✅ إدارة العملاء والموردين
- ✅ سجل الأنشطة والعمليات
- ✅ تقارير PDF و Excel
- ✅ الطباعة الحرارية للإيصالات
- ✅ الوضع دون اتصال (Offline Mode)
- ✅ المصادقة الآمنة

## المتطلبات / Requirements

- Flutter SDK: >=3.10.1 <4.0.0
- Dart SDK
- Android SDK (للتطبيق على Android)
- Xcode (للتطبيق على iOS)

## التثبيت / Installation

```bash
# استنساخ المشروع
git clone <repository-url>
cd gestion_pro_mobile

# تثبيت المكتبات
flutter pub get

# تشغيل التطبيق
flutter run
```

## المكتبات الرئيسية / Key Dependencies

- **Provider**: إدارة الحالة
- **Hive**: قاعدة البيانات المحلية
- **http**: طلبات الشبكة
- **pdf/printing**: توليد ومشاركة التقارير
- **excel**: تصدير البيانات
- **mobile_scanner**: ماسح الباركود
- **flutter_local_notifications**: الإشعارات

## البنية / Project Structure

```
lib/
├── api/              # خدمات API
├── models/           # نماذج البيانات
├── providers/        # مزودي الحالة (State)
├── screens/          # الشاشات الرئيسية
├── services/         # الخدمات المساعدة
├── utils/            # دوال مساعدة
└── widgets/          # المكونات المخصصة
```
samples, guidance on mobile development, and a full API reference.
