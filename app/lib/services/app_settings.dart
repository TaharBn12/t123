import 'package:shared_preferences/shared_preferences.dart';

/// إعدادات الماسح المحفوظة على الجهاز (تبقى بعد إغلاق التطبيق)
class AppSettings {
  static const String _kTarget = 'target';
  static const String _kDup = 'duplicateMs';
  static const String _kHaptics = 'haptics';
  static const String _kBeep = 'beep';
  static const String _kCont = 'continuous';
  static const String _kQty = 'qty';

  static SharedPreferences? _cache;

  static Future<SharedPreferences> get _prefs async =>
      _cache ??= await SharedPreferences.getInstance();

  static Future<String> target() async => (await _prefs).getString(_kTarget) ?? 'pos';
  static Future<void> setTarget(String v) async => (await _prefs).setString(_kTarget, v);

  /// مهلة تجاهل تكرار نفس الباركود (ميلي ثانية)
  static Future<int> duplicateMs() async => (await _prefs).getInt(_kDup) ?? 2000;
  static Future<void> setDuplicateMs(int v) async => (await _prefs).setInt(_kDup, v);

  static Future<bool> haptics() async => (await _prefs).getBool(_kHaptics) ?? true;
  static Future<void> setHaptics(bool v) async => (await _prefs).setBool(_kHaptics, v);

  static Future<bool> beep() async => (await _prefs).getBool(_kBeep) ?? true;
  static Future<void> setBeep(bool v) async => (await _prefs).setBool(_kBeep, v);

  static Future<bool> continuous() async => (await _prefs).getBool(_kCont) ?? true;
  static Future<void> setContinuous(bool v) async => (await _prefs).setBool(_kCont, v);

  static Future<double> qty() async => (await _prefs).getDouble(_kQty) ?? 1;
  static Future<void> setQty(double v) async => (await _prefs).setDouble(_kQty, v);
}
