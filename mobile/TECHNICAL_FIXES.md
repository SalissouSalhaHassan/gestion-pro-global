# دليل الإصلاحات الفنية للمزامنة
# Technical Guide for Synchronization Fixes

---

## 1. مشكلة: المعرفات المؤقتة لا تُحدث بشكل صحيح

### الوصف:
الفواتير المنشأة محلياً تحصل على معرف مؤقت سالب (مثل -1641234567)
عند المزامنة، الخادم يعطيها معرف جديد (مثل 42)
الطلبات المعتمدة (الدفع، الإلغاء) لا تزال تشير للمعرف القديم

### الحل المطبق:
```dart
// في syncPendingRequests():
// 1. بعد إنشاء فاتورة بنجاح:
final newId = resData['id']; // من الخادم
await _offlineService.updateQueueInvoiceId(oldId, newId);

// 2. تحديث قائمة الطلبات في الذاكرة:
for (var req in requests) {
  if (req['type'] == 'pay_invoice' || req['type'] == 'cancel_invoice') {
    final pData = req['data'];
    if (pData is Map && pData['invoice_id'] == oldId) {
      pData['invoice_id'] = newId; // تحديث مباشر
    }
  }
}
```

### الفائدة:
✅ لا توجد طلبات معلقة بسبب معرفات خاطئة
✅ المزامنة تكمل بنجاح

---

## 2. مشكلة: التكرارات في الفواتير

### الوصف:
نفس الفاتورة قد تظهر مرتين:
- مرة كـ pending (محلية)
- مرة كـ synced (من الخادم)

### الحل المطبق:
```dart
// في cacheInvoices():
// فحص ثنائي قبل الإدراج:
if (remoteId != null) {
  final existing = await db.query(
    'invoices',
    where: 'remote_id = ?',
    whereArgs: [remoteId],
    limit: 1, // محسّن بـ limit
  );
}

if (!exists && blNumber != null) {
  final existing = await db.query(
    'invoices',
    where: 'bl_number = ?',
    whereArgs: [blNumber],
    limit: 1,
  );
}

// في deduplicateInvoicesByBl():
// فحص heuristic متقدم:
if (pDate.difference(sDate).inMinutes.abs() < 10) {
  // حذف النسخة المحلية
  await db.delete(...);
}
```

### الفائدة:
✅ لا توجد فواتير مكررة
✅ واجهة مستخدم نظيفة

---

## 3. مشكلة: المخزون لا يُستعاد عند حذف الفاتورة

### الوصف:
المستخدم ينشئ فاتورة:
- المخزون ينخفض بـ 10 وحدات
المستخدم يحذفها:
- المخزون لا يرتفع مرة أخرى

### الحل المطبق:
```dart
// في deletePendingInvoice():
// الخطوة الأولى: استعادة المخزون
await restoreStockFromInvoiceId(invoiceId);

// في restoreStockFromInvoiceId():
// استخراج الأسطر من الفاتورة
List<dynamic> lines = targetJson['items'] ?? 
                      targetJson['lignes'] ??
                      targetJson['details'] ??
                      targetJson['invoice_lines'] ?? [];

// لكل سطر: استعادة المخزون
for (var line in lines) {
  await incrementProductStock(articleId, qty, depotName: depotName);
}
```

### الفائدة:
✅ المخزون يبقى متوازناً
✅ عدم فقدان البيانات

---

## 4. مشكلة: أخطاء الشبكة تسد طابور المزامنة

### الوصف:
إذا كان هناك خطأ في الشبكة:
- قد تبقى الطلبات معلقة إلى الأبد
- لا يتم إعادة المحاولة بذكاء

### الحل المطبق:
```dart
try {
  final response = await http.post(
    url,
    headers: headers,
    body: jsonEncode(data),
  ).timeout(const Duration(seconds: 15)); // timeout محسّن
  
} catch (e) {
  if (e.toString().contains("TimeoutException")) {
    networkErrorCount++; // تتبع منفصل
  } else if (e.toString().contains("SocketException")) {
    networkErrorCount++;
  } else {
    errorCount++;
  }
}
```

### الفائدة:
✅ تمييز بين أنواع الأخطاء
✅ إعادة محاولة ذكية

---

## 5. مشكلة: معالجة البيانات المفقودة أو التالفة

### الوصف:
قد يحدث:
- JSON parsing errors
- منتج مفقود
- حقل فارغ غير متوقع

### الحل المطبق:
```dart
// في جميع الدوال: try/catch محسّن
try {
  final data = jsonDecode(row['data_json'] as String);
  // المعالجة
} catch (e) {
  debugPrint("⚠️ Error parsing: $e");
  continue; // تخطي هذا العنصر
}

// فحوصات تحقق من البيانات:
if (articleId == null || articleId <= 0) continue;
if (qty == null || qty is! num) qty = 0.0;
```

### الفائدة:
✅ عدم توقف التطبيق
✅ معالجة آمنة للاستثناءات

---

## 6. مشكلة: اتصال غير موثوق بـ isOnline()

### الوصف:
```dart
// قبل:
return hasNetwork; // فقط فحص الاتصال، لا فحص الخادم

// مشكلة:
// WiFi متصل لكن الخادم معطل → يعود true
```

### الحل المطبق:
```dart
// الآن:
// 1. فحص الاتصال أولاً
if (!hasNetwork) return false;

// 2. caching النتائج (30 ثانية)
if (_lastReachabilityCheck != null &&
    now.difference(_lastReachabilityCheck!).inSeconds < 30) {
  return _isOnlineCached ?? true;
}

// 3. فحص الخادم الفعلي
final serverOnline = await _checkServerReachability();
_lastReachabilityCheck = now;
return serverOnline;
```

### الفائدة:
✅ معلومات موثوقة عن حالة الاتصال
✅ أداء محسّن مع caching

---

## 7. نظام Logging الشامل

### الرموز المستخدمة:
```
✅ - نجاح العملية
❌ - خطأ حرج يوقف العملية
⚠️ - تحذير (عملية مستمرة لكن مع مشكلة)
ℹ️ - معلومات عامة
🔍 - عملية بحث
🗑️ - عملية حذف
```

### مثال على السجل:
```
✅ Cached invoice: 42 - BL-2026-001
ℹ️ Invoice already exists: 42
✅ Stock incremented: Article 5 + 10 units
⚠️ Product not found: 999
❌ Error in deletePendingInvoice: null check failed
🔍 Found 3 duplicate BL numbers
🗑️ Deleted 2 pending invoices with BL: BL-2026-001
```

### كيفية الوصول للسجلات:
```bash
# في الطرفية:
flutter logs

# أو في DevTools:
Run → Open DevTools → Logging tab
```

---

## 8. معالجة الأخطاء غير القابلة للاسترجاع

### الأخطاء التي تُحذف من الطابور:
```dart
if (response.statusCode == 400 || // Bad Request
    response.statusCode == 403 || // Forbidden
    response.statusCode == 422 || // Unprocessable Entity
    response.statusCode == 404 || // Not Found
    (response.statusCode == 500 && msg.contains("Foreign")) || // Foreign Key
    (response.statusCode == 500 && msg.contains("integrity"))) { // Integrity
  await _offlineService.removeRequest(queueId);
}
```

### الأخطاء التي تُعاد المحاولة:
```dart
// 2xx, 409 (Conflict) = نجاح
if (response.statusCode == 200 ||
    response.statusCode == 201 ||
    response.statusCode == 409) {
  await _offlineService.removeRequest(queueId);
}

// 5xx غير محددة = قد تعود المحاولة
// network errors = قد تعود المحاولة
```

---

## 9. مثال عملي: تدفق إنشاء فاتورة

### الخطوات:
```
1. المستخدم ينشئ فاتورة محلياً:
   - id = -(DateTime.now().millisecondsSinceEpoch)
   - المخزون ينخفض على الفور
   - تُضاف للطابور

2. أول جدول مزامنة:
   // من API:
   POST /invoices
   {
     "id": -1641234567,
     "bl_number": "BL-2026-001",
     ...
   }
   
   // نجاح:
   {
     "id": 42,  // الخادم أعطاها رقم جديد
     ...
   }
   
   // تحديث الطابور:
   await updateQueueInvoiceId(-1641234567, 42)

3. الطلب التالي (دفع):
   // من الطابور:
   {
     "type": "pay_invoice",
     "data": {
       "invoice_id": 42,  // تم تحديثه ✅
       "amount": 1000
     }
   }
   
   // المزامنة تنجح لأن المعرف صحيح
```

### المنطق الخاص:
```dart
// قبل المزامنة:
if (invoice.id < 0) {
  // معرف محلي مؤقت
  // قد يكون معلقاً ضمن طلبات أخرى
  // لا تزامن حتى الآن
  continue;
}

// بعد إنشاء الفاتورة:
final newId = response['id'];
await updateQueueInvoiceId(oldId, newId);
```

---

## 10. الأداء والتحسينات

### استخدام `limit` في الاستعلامات:
```dart
// قبل:
final existing = await db.query('invoices', where: '...');
if (existing.isNotEmpty) { ... }

// بعد:
final existing = await db.query('invoices', where: '...', limit: 1);
if (existing.isNotEmpty) { ... }
```
**الفائدة:** أسرع، خاصة مع جداول كبيرة

### استخدام `clamp()` للقيم:
```dart
// قبل:
double newStock = currentStock - quantity;

// بعد:
double newStock = (currentStock - quantity).clamp(0.0, double.infinity);
```
**الفائدة:** تجنب الأرقام السالبة

### Caching النتائج:
```dart
// في isOnline():
if (_lastReachabilityCheck != null &&
    now.difference(_lastReachabilityCheck!).inSeconds < 30) {
  return _isOnlineCached;
}
```
**الفائدة:** تقليل عدد الفحوصات المتكررة

---

## 🎯 الخلاصة

جميع الإصلاحات تهدف إلى:
1. ✅ منع فقدان البيانات
2. ✅ ضمان موثوقية المزامنة
3. ✅ سهولة تشخيص المشاكل
4. ✅ تحسين الأداء
5. ✅ تجربة مستخدم أفضل

**النتيجة:** تطبيق جوال مستقر وموثوق يعمل بكفاءة حتى مع الاتصالات غير المستقرة.
