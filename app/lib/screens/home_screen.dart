import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/app_settings.dart';
import '../services/scan_service.dart';
import '../services/scan_targets.dart';
import 'scanner_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _queue = 0;
  String _name = '';
  String _lastTarget = 'pos';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final db = Supabase.instance.client;
    final user = db.auth.currentUser;
    String name = user?.email ?? '';
    int queue = 0;
    try {
      final p = await db.from('profiles').select('full_name,is_active').eq('id', user!.id).maybeSingle();
      name = p?['full_name'] ?? name;
      if (p?['is_active'] == false) {
        await db.auth.signOut();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تعطيل حسابك. تواصل مع المدير'), backgroundColor: Colors.red));
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
        return;
      }
    } catch (_) {/* تعذّر الاتصال - نُكمل بالبيانات المتاحة */}
    try {
      queue = await ScanService.queueLength();
    } catch (_) {}
    String lastTarget = 'pos';
    try {
      lastTarget = await AppSettings.target();
    } catch (_) {}
    if (mounted) setState(() { _name = name; _queue = queue; _lastTarget = lastTarget; });
  }

  Widget _mode(BuildContext c, ScanTarget t) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        child: ListTile(
          contentPadding: const EdgeInsets.all(14),
          leading: Container(width: 50, height: 50, decoration: BoxDecoration(color: t.color.withOpacity(.15), borderRadius: BorderRadius.circular(14)), child: Icon(t.icon, color: t.color, size: 26)),
          title: Row(children: [
            Expanded(child: Text(t.label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
            if (t.id == _lastTarget)
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: t.color.withOpacity(.18), borderRadius: BorderRadius.circular(20)), child: const Text('الأخيرة', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700))),
          ]),
          subtitle: Text(t.hint),
          trailing: const Icon(Icons.arrow_back_ios_new, size: 16),
          onTap: () => Navigator.push(c, MaterialPageRoute(builder: (_) => ScannerScreen(target: t.id, title: t.label))).then((_) => _load()),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ماسح كاشير برو'), actions: [
        IconButton(icon: const Icon(Icons.logout), tooltip: 'خروج', onPressed: () async { await Supabase.instance.client.auth.signOut(); if (context.mounted) Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen())); }),
      ]),
      body: ListView(padding: const EdgeInsets.all(18), children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)])),
          child: Row(children: [
            const CircleAvatar(radius: 26, backgroundColor: Colors.white24, child: Icon(Icons.person, color: Colors.white, size: 30)),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('مرحباً', style: TextStyle(color: Colors.white70)), Text(_name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18))])),
            if (_queue > 0) ActionChip(avatar: const Icon(Icons.cloud_upload, size: 16), label: Text('$_queue معلّق'), onPressed: () async { final s = await ScanService.flushQueue(); if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم إرسال $s'))); _load(); }),
          ]),
        ),
        const SizedBox(height: 22),
        const Text('اختر الصفحة التي سيُرسل إليها المسح', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 10),
        ...ScanTarget.all.map((t) => _mode(context, t)),
        const SizedBox(height: 14),
        const Card(child: Padding(padding: EdgeInsets.all(14), child: Row(children: [Icon(Icons.info_outline, color: Colors.blueAccent), SizedBox(width: 10), Expanded(child: Text('افتح الموقع على الحاسوب بنفس الحساب، وستظهر عمليات المسح لحظياً. عند انقطاع الإنترنت تُحفظ العمليات وتُرسل لاحقاً.', style: TextStyle(fontSize: 12)))]))),
      ]),
    );
  }
}
