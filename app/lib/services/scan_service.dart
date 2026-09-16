import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// إرسال أحداث المسح إلى Supabase مع طابور محلي عند انقطاع الإنترنت
class ScanService {
  static final _db = Supabase.instance.client;
  static String? _deviceId;

  static Future<String> deviceId() async {
    if (_deviceId != null) return _deviceId!;
    try {
      final info = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final a = await info.androidInfo;
        _deviceId = '${a.brand} ${a.model}';
      } else {
        _deviceId = 'iOS';
      }
    } catch (_) {
      _deviceId = 'phone';
    }
    return _deviceId!;
  }

  /// تنظيف الباركود (حماية من الحقن)
  static String clean(String s) {
    final c = s.replaceAll(RegExp(r'[^A-Za-z0-9\-_.]'), '');
    return c.length > 64 ? c.substring(0, 64) : c;
  }

  /// آخر سبب فشل إرسال — يُعرض للمستخدم بدل أن يختفي المسح بصمت.
  static String? lastError;

  /// يحوّل خطأ القاعدة إلى سبب مفهوم؛ يكتشف قيد الوجهة القديم تحديداً.
  static String _explain(Object e) {
    final String s = e.toString();
    if (s.contains('scan_events_target_check') || s.contains('23514')) {
      return 'قاعدة البيانات لا تقبل هذه الوجهة بعد: شغّل ملف supabase/schema.sql في محرر SQL ثم اضغط «إعادة الإرسال».';
    }
    return s.length > 180 ? s.substring(0, 180) : s;
  }

  static Future<Map<String, dynamic>?> lookup(String barcode) async {
    final r = await _db.from('products').select('id,name,sale_price,stock,unit,image_url').eq('barcode', barcode).maybeSingle();
    return r;
  }

  static Future<bool> send(String barcode, {String target = 'products', double qty = 1}) async {
    final row = {
      'barcode': clean(barcode),
      'device_id': await deviceId(),
      'user_id': _db.auth.currentUser?.id,
      'target': target,
      'quantity': qty,
    };
    try {
      await _db.from('scan_events').insert(row);
      await flushQueue();
      lastError = null;
      return true;
    } catch (e) {
      lastError = _explain(e);
      await _enqueue(row);
      return false;
    }
  }

  static Future<void> _enqueue(Map<String, dynamic> row) async {
    final p = await SharedPreferences.getInstance();
    final q = p.getStringList('queue') ?? [];
    q.add('${row['barcode']}|${row['target']}|${row['quantity']}');
    await p.setStringList('queue', q);
  }

  static Future<int> flushQueue() async {
    final p = await SharedPreferences.getInstance();
    final q = p.getStringList('queue') ?? [];
    if (q.isEmpty) return 0;
    int sent = 0;
    final remaining = <String>[];
    for (final e in q) {
      final parts = e.split('|');
      try {
        await _db.from('scan_events').insert({'barcode': parts[0], 'target': parts[1], 'quantity': double.tryParse(parts[2]) ?? 1, 'device_id': await deviceId(), 'user_id': _db.auth.currentUser?.id});
        sent++;
      } catch (_) {
        remaining.add(e);
      }
    }
    await p.setStringList('queue', remaining);
    return sent;
  }

  static Future<int> queueLength() async => ((await SharedPreferences.getInstance()).getStringList('queue') ?? []).length;
}
