import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/scan_service.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final db = Supabase.instance.client;
    final p = await db.from('profiles').select('full_name').eq('id', db.auth.currentUser!.id).maybeSingle();
    final q = await ScanService.queueLength();
    if (mounted) setState(() { _name = p?['full_name'] ?? db.auth.currentUser!.email ?? ''; _queue = q; });
  }

  Widget _mode(BuildContext c, {required String title, required String sub, required IconData icon, required Color color, required String target}) => Card(
        margin: const EdgeInsets.only(bottom: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        child: ListTile(
          contentPadding: const EdgeInsets.all(16),
          leading: Container(width: 54, height: 54, decoration: BoxDecoration(color: color.withOpacity(.15), borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: color, size: 28)),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
          subtitle: Text(sub),
          trailing: const Icon(Icons.arrow_back_ios_new, size: 16),
          onTap: () => Navigator.push(c, MaterialPageRoute(builder: (_) => ScannerScreen(target: target, title: title))).then((_) => _load()),
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
        const Text('اختر وضع المسح', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 10),
        _mode(context, title: 'عرض المنتجات', sub: 'يظهر المنتج في صفحة "استقبال المسح" على الموقع', icon: Icons.visibility, color: Colors.indigo, target: 'products'),
        _mode(context, title: 'نقطة البيع', sub: 'يُضاف المنتج مباشرة إلى سلة الكاشير', icon: Icons.point_of_sale, color: Colors.green, target: 'pos'),
        _mode(context, title: 'الجرد', sub: 'مسح متكرر لحساب الكميات الفعلية', icon: Icons.inventory, color: Colors.orange, target: 'inventory'),
        const SizedBox(height: 14),
        const Card(child: Padding(padding: EdgeInsets.all(14), child: Row(children: [Icon(Icons.info_outline, color: Colors.blueAccent), SizedBox(width: 10), Expanded(child: Text('افتح الموقع على الحاسوب بنفس الحساب، وستظهر عمليات المسح لحظياً. عند انقطاع الإنترنت تُحفظ العمليات وتُرسل لاحقاً.', style: TextStyle(fontSize: 12)))]))),
      ]),
    );
  }
}
