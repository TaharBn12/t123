import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/scan_service.dart';

class ScannerScreen extends StatefulWidget {
  final String target, title;
  const ScannerScreen({super.key, required this.target, required this.title});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _ctrl = MobileScannerController(detectionSpeed: DetectionSpeed.normal, facing: CameraFacing.back);
  final List<_Scan> _history = [];
  String? _last;
  DateTime _lastAt = DateTime(2000);
  bool _continuous = true, _torch = false, _busy = false;
  double _qty = 1;

  Future<void> _onDetect(BarcodeCapture cap) async {
    if (_busy || cap.barcodes.isEmpty) return;
    final raw = cap.barcodes.first.rawValue;
    if (raw == null || raw.isEmpty) return;
    final code = ScanService.clean(raw);
    if (code.isEmpty) return;
    final now = DateTime.now();
    // منع تكرار نفس الباركود خلال ثانيتين
    if (code == _last && now.difference(_lastAt).inMilliseconds < 2000) return;
    _last = code;
    _lastAt = now;
    _busy = true;
    try {
      try {
        await HapticFeedback.mediumImpact(); // اهتزاز/لمسة تأكيد عند المسح
      } catch (_) {/* بعض الأجهزة لا تدعم الاهتزاز */}
      Map<String, dynamic>? product;
      try {
        product = await ScanService.lookup(code);
      } catch (_) {
        product = null; // لا يمنع الإرسال/الحفظ المحلي
      }
      final ok = await ScanService.send(code, target: widget.target, qty: _qty);
      if (!mounted) return;
      setState(() {
        _history.insert(0, _Scan(code, product, ok));
        if (_history.length > 50) _history.removeLast();
      });
    } finally {
      if (!_continuous) {
        try { await _ctrl.stop(); } catch (_) {}
      }
      _busy = false;
    }
    if (!_continuous && mounted) {
      await showModalBottomSheet(context: context, builder: (_) => _sheet(_history.first.product, code, _history.first.sent));
      if (mounted) {
        try { await _ctrl.start(); } catch (_) {}
      }
    }
  }

  Widget _sheet(Map<String, dynamic>? p, String code, bool ok) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Icon(p != null ? Icons.check_circle : Icons.help, color: p != null ? Colors.green : Colors.orange, size: 32), const SizedBox(width: 10), Expanded(child: Text(p?['name'] ?? 'منتج غير مسجل', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)))]),
          const SizedBox(height: 8),
          Text(code, textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.grey)),
          if (p != null) ...[const SizedBox(height: 8), Text('السعر: ${p['sale_price']}   |   المخزون: ${p['stock']} ${p['unit'] ?? ''}')],
          const SizedBox(height: 8),
          Text(ok ? '✅ تم الإرسال إلى الموقع' : '⏳ حُفظ محلياً وسيُرسل لاحقاً', style: TextStyle(color: ok ? Colors.green : Colors.orange)),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: () => Navigator.pop(context), child: const Text('متابعة المسح'))),
        ]),
      );

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title), actions: [
        IconButton(icon: Icon(_torch ? Icons.flash_on : Icons.flash_off), onPressed: () { _ctrl.toggleTorch(); setState(() => _torch = !_torch); }),
        IconButton(icon: const Icon(Icons.cameraswitch), onPressed: () => _ctrl.switchCamera()),
      ]),
      body: Column(children: [
        Expanded(flex: 5, child: Stack(fit: StackFit.expand, children: [
          MobileScanner(controller: _ctrl, onDetect: _onDetect),
          Center(child: Container(width: 260, height: 160, decoration: BoxDecoration(border: Border.all(color: const Color(0xFF4F46E5), width: 3), borderRadius: BorderRadius.circular(16)))),
          Positioned(bottom: 12, left: 12, right: 12, child: Row(children: [
            Expanded(child: Card(color: Colors.black54, child: SwitchListTile(dense: true, title: const Text('مسح متواصل', style: TextStyle(color: Colors.white, fontSize: 13)), value: _continuous, onChanged: (v) => setState(() => _continuous = v)))),
            if (widget.target != 'products') Card(color: Colors.black54, child: Row(children: [IconButton(icon: const Icon(Icons.remove, color: Colors.white), onPressed: () => setState(() => _qty = (_qty - 1).clamp(1, 999))), Text('×${_qty.toInt()}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)), IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => setState(() => _qty += 1))])),
          ])),
        ])),
        Expanded(flex: 4, child: Container(
          decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(22))),
          child: Column(children: [
            Padding(padding: const EdgeInsets.fromLTRB(16, 14, 16, 4), child: Row(children: [const Text('آخر العمليات', style: TextStyle(fontWeight: FontWeight.w800)), const Spacer(), Text('${_history.length}', style: const TextStyle(color: Colors.grey))])),
            Expanded(child: _history.isEmpty
                ? const Center(child: Text('وجّه الكاميرا نحو الباركود', style: TextStyle(color: Colors.grey)))
                : ListView.builder(itemCount: _history.length, itemBuilder: (_, i) {
                    final s = _history[i];
                    return ListTile(
                      leading: CircleAvatar(backgroundColor: (s.product != null ? Colors.green : Colors.orange).withOpacity(.15), child: Icon(s.product != null ? Icons.inventory_2 : Icons.help_outline, color: s.product != null ? Colors.green : Colors.orange)),
                      title: Text(s.product?['name'] ?? 'غير مسجل', style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(s.code, textDirection: TextDirection.ltr, textAlign: TextAlign.right),
                      trailing: s.product != null ? Text('${s.product!['sale_price']}', style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF818CF8))) : Icon(s.sent ? Icons.cloud_done : Icons.cloud_off, size: 18, color: s.sent ? Colors.green : Colors.orange),
                    );
                  })),
          ]),
        )),
      ]),
    );
  }
}

class _Scan {
  final String code; final Map<String, dynamic>? product; final bool sent;
  _Scan(this.code, this.product, this.sent);
}
