import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/app_settings.dart';
import '../services/scan_service.dart';
import '../services/scan_targets.dart';

class ScannerScreen extends StatefulWidget {
  final String target, title;
  const ScannerScreen({super.key, required this.target, required this.title});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  late final MobileScannerController _ctrl;
  final List<_Scan> _history = [];
  late String _target;
  String? _last;
  DateTime _lastAt = DateTime(2000);
  bool _continuous = true, _busy = false, _haptics = true, _beep = true, _scanning = true;
  int _duplicateMs = 2000;
  double _qty = 1;

  @override
  void initState() {
    super.initState();
    _target = widget.target;
    _ctrl = MobileScannerController(detectionSpeed: DetectionSpeed.normal, facing: CameraFacing.back);
    _loadSettings();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final dup = await AppSettings.duplicateMs();
    final hap = await AppSettings.haptics();
    final bep = await AppSettings.beep();
    final cont = await AppSettings.continuous();
    final q = await AppSettings.qty();
    if (!mounted) return;
    setState(() {
      _duplicateMs = dup;
      _haptics = hap;
      _beep = bep;
      _continuous = cont;
      _qty = q;
    });
  }

  // ===== معالجة باركود (كاميرا أو إدخال يدوي أو إعادة إرسال) =====
  Future<void> _handle(String rawCode) async {
    if (_busy) return;
    final code = ScanService.clean(rawCode);
    if (code.isEmpty) return;
    final now = DateTime.now();
    // تجاهل تكرار نفس الباركود خلال المهلة المحددة في الإعدادات
    if (code == _last && now.difference(_lastAt).inMilliseconds < _duplicateMs) return;
    _last = code;
    _lastAt = now;
    _busy = true;
    try {
      if (_haptics) {
        try {
          await HapticFeedback.mediumImpact();
        } catch (_) {}
      }
      if (_beep) {
        try {
          await SystemSound.play(SystemSoundType.click);
        } catch (_) {}
      }
      Map<String, dynamic>? product;
      try {
        product = await ScanService.lookup(code);
      } catch (_) {
        product = null; // لا يمنع الإرسال/الحفظ المحلي
      }
      final ok = await ScanService.send(code, target: _target, qty: _qty);
      if (!mounted) return;
      setState(() {
        _history.insert(0, _Scan(code, product, ok, _qty, error: ok ? null : ScanService.lastError));
        if (_history.length > 50) _history.removeLast();
      });
    } finally {
      _busy = false;
    }
    if (!_continuous && mounted) {
      try {
        await _ctrl.stop();
      } catch (_) {}
      if (!mounted) return;
      await showModalBottomSheet<void>(context: context, builder: (_) => _sheet(_history.first));
      if (mounted) {
        try {
          await _ctrl.start();
        } catch (_) {}
      }
    }
  }

  // ===== أوامر الكاميرا =====
  Future<void> _restart() async {
    try {
      await _ctrl.stop();
    } catch (_) {}
    try {
      await _ctrl.start();
      if (mounted) setState(() => _scanning = true);
    } catch (e) {
      _snack('تعذّر تشغيل الكاميرا: $e');
    }
  }

  Future<void> _toggleScanning() async {
    try {
      if (_scanning) {
        await _ctrl.stop();
      } else {
        await _ctrl.start();
      }
      if (mounted) setState(() => _scanning = !_scanning);
    } catch (_) {
      _snack('تعذّر ${_scanning ? "إيقاف" : "تشغيل"} الكاميرا');
    }
  }

  Future<void> _toggleTorch() async {
    try {
      await _ctrl.toggleTorch();
    } catch (_) {
      _snack('الكشاف غير متاح في هذا الجهاز');
    }
  }

  Future<void> _switchCamera() async {
    try {
      await _ctrl.switchCamera();
    } catch (_) {
      _snack('تعذّر تبديل الكاميرا');
    }
  }

  void _snack(String m) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  Future<void> _setTarget(ScanTarget t) async {
    if (t.id == _target) return;
    setState(() => _target = t.id);
    await AppSettings.setTarget(t.id);
    _snack('الوجهة الآن: ${t.label}');
  }

  // ===== إدخال يدوي =====
  Future<void> _manualEntry() async {
    final ctl = TextEditingController();
    final v = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إدخال باركود يدوياً'),
        content: TextField(
          controller: ctl,
          autofocus: true,
          keyboardType: TextInputType.text,
          textDirection: TextDirection.ltr,
          decoration: const InputDecoration(hintText: 'اكتب أو الصق الباركود'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctl.text), child: const Text('إرسال')),
        ],
      ),
    );
    if (v != null && v.trim().isNotEmpty) await _handle(v);
  }

  // ===== الإعدادات =====
  Future<void> _openSettings() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('إعدادات المسح', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('مسح متواصل'),
              subtitle: const Text('بدون نافذة تأكيد بعد كل عملية'),
              value: _continuous,
              onChanged: (v) {
                setSheet(() => _continuous = v);
                setState(() => _continuous = v);
                AppSettings.setContinuous(v);
              },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('اهتزاز عند المسح'),
              value: _haptics,
              onChanged: (v) {
                setSheet(() => _haptics = v);
                setState(() => _haptics = v);
                AppSettings.setHaptics(v);
              },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('صوت عند المسح'),
              value: _beep,
              onChanged: (v) {
                setSheet(() => _beep = v);
                setState(() => _beep = v);
                AppSettings.setBeep(v);
              },
            ),
            const SizedBox(height: 6),
            Text('تجاهل تكرار نفس الباركود: ${(_duplicateMs / 1000).toStringAsFixed(1)} ثانية',
                style: const TextStyle(fontWeight: FontWeight.w700)),
            Slider(
              value: _duplicateMs.clamp(0, 10000).toDouble(),
              min: 0,
              max: 10000,
              divisions: 20,
              label: '${(_duplicateMs / 1000).toStringAsFixed(1)} ث',
              onChanged: (v) {
                setSheet(() => _duplicateMs = v.round());
                setState(() => _duplicateMs = v.round());
                AppSettings.setDuplicateMs(v.round());
              },
            ),
            const SizedBox(height: 4),
            Text('الكمية الافتراضية لكل عملية مسح: ${_qty.toStringAsFixed(0)}',
                style: const TextStyle(fontWeight: FontWeight.w700)),
            Slider(
              value: _qty.clamp(1, 50),
              min: 1,
              max: 50,
              divisions: 49,
              label: _qty.toStringAsFixed(0),
              onChanged: (v) {
                setSheet(() => _qty = v);
                setState(() => _qty = v);
                AppSettings.setQty(v);
              },
            ),
            const SizedBox(height: 8),
            const Text('الوجهة الحالية', style: TextStyle(fontWeight: FontWeight.w700)),
            Wrap(
              spacing: 8,
              children: ScanTarget.all
                  .map((t) => ChoiceChip(
                        label: Text(t.label),
                        selected: t.id == _target,
                        onSelected: (_) {
                          setSheet(() {});
                          _setTarget(t);
                        },
                      ))
                  .toList(),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('تم')),
            ),
          ]),
        ),
      ),
    );
  }

  // ===== واجهات بديلة للكاميرا =====
  Widget _cameraPlaceholder(BuildContext context) => const ColoredBox(
        color: Colors.black,
        child: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            CircularProgressIndicator(color: Colors.white),
            SizedBox(height: 14),
            Text('جارٍ تشغيل الكاميرا...', style: TextStyle(color: Colors.white70)),
          ]),
        ),
      );

  Widget _cameraError(BuildContext context, MobileScannerException error) {
    String title = 'تعذّر تشغيل الكاميرا';
    String hint = 'أغلق أي تطبيق آخر يستخدم الكاميرا ثم أعد المحاولة';
    switch (error.errorCode) {
      case MobileScannerErrorCode.permissionDenied:
        title = 'الوصول إلى الكاميرا مرفوض';
        hint = 'افتح إعدادات التطبيق ← الأذونات ← الكاميرا، ثم أعد فتح التطبيق';
        break;
      case MobileScannerErrorCode.unsupported:
        title = 'المسح غير مدعوم على هذا الجهاز';
        hint = 'لا توجد كاميرا صالحة للاستخدام، أو أن تطبيقاً آخر يستحوذ عليها';
        break;
      case MobileScannerErrorCode.controllerInitializing:
        title = 'الكاميرا قيد التهيئة';
        hint = 'انتظر لحظة ثم اضغط إعادة التشغيل';
        break;
      case MobileScannerErrorCode.controllerUninitialized:
      case MobileScannerErrorCode.controllerNotAttached:
        title = 'الكاميرا لم تُشغَّل';
        hint = 'اضغط «إعادة تشغيل الكاميرا» بالأسفل';
        break;
      case MobileScannerErrorCode.controllerDisposed:
        title = 'أُغلقت الكاميرا';
        hint = 'أعد فتح صفحة المسح';
        break;
      case MobileScannerErrorCode.controllerAlreadyInitialized:
      case MobileScannerErrorCode.genericError:
        title = 'تعذّر تشغيل الكاميرا';
        hint = 'أغلق أي تطبيق آخر يستخدم الكاميرا ثم أعد المحاولة';
        break;
    }
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.no_photography_outlined, color: Colors.white70, size: 46),
            const SizedBox(height: 14),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(hint, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 12),
            Text('${error.errorCode.name}: ${error.errorDetails?.message ?? ''}',
                textAlign: TextAlign.center,
                textDirection: TextDirection.ltr,
                style: const TextStyle(color: Colors.white38, fontSize: 11)),
            const SizedBox(height: 18),
            FilledButton.icon(
                onPressed: _restart, icon: const Icon(Icons.refresh), label: const Text('إعادة تشغيل الكاميرا')),
          ]),
        ),
      ),
    );
  }

  Widget _sheet(_Scan s) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(s.product != null ? Icons.check_circle : Icons.help,
                color: s.product != null ? Colors.green : Colors.orange, size: 32),
            const SizedBox(width: 10),
            Expanded(
                child: Text(s.product?['name'] ?? 'منتج غير مسجل',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
          ]),
          const SizedBox(height: 8),
          Text(s.code, textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.grey)),
          if (s.product != null) ...[
            const SizedBox(height: 8),
            Text('السعر: ${s.product!['sale_price']}   |   المخزون: ${s.product!['stock']} ${s.product!['unit'] ?? ''}'),
          ],
          const SizedBox(height: 8),
          Row(children: [
            Icon(s.sent ? Icons.cloud_done : Icons.cloud_off,
                size: 18, color: s.sent ? Colors.green : Colors.orange),
            const SizedBox(width: 6),
            Text(s.sent ? 'تم الإرسال إلى الموقع' : 'حُفظ محلياً وسيُرسل لاحقاً',
                style: TextStyle(color: s.sent ? Colors.green : Colors.orange)),
          ]),
          const SizedBox(height: 12),
          SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: () => Navigator.pop(context), child: const Text('متابعة المسح'))),
        ]),
      );

  // ===== أجزاء الواجهة =====
  Widget _targetBar(ScanTarget t) => Container(
        color: Theme.of(context).colorScheme.surface,
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: ScanTarget.all.map((x) {
              final sel = x.id == t.id;
              return Padding(
                padding: const EdgeInsets.only(left: 8),
                child: ChoiceChip(
                  avatar: Icon(x.icon, size: 16, color: sel ? Colors.white : x.color),
                  label: Text(x.label),
                  selected: sel,
                  selectedColor: x.color,
                  labelStyle: TextStyle(color: sel ? Colors.white : null, fontWeight: FontWeight.w700),
                  onSelected: (_) => _setTarget(x),
                ),
              );
            }).toList(),
          ),
        ),
      );

  Widget _zoomSlider() => ValueListenableBuilder<MobileScannerState>(
        valueListenable: _ctrl,
        builder: (context, state, _) {
          if (!state.isRunning) return const SizedBox.shrink();
          final z = state.zoomScale < 1 ? 1.0 : state.zoomScale;
          return Row(children: [
            const Icon(Icons.zoom_out, color: Colors.white70, size: 18),
            Expanded(
              child: Slider(
                value: z.clamp(1.0, 10.0),
                min: 1,
                max: 10,
                divisions: 18,
                label: '×${z.toStringAsFixed(1)}',
                onChanged: (v) async {
                  try {
                    await _ctrl.setZoomScale(v);
                  } catch (_) {}
                },
              ),
            ),
            const Icon(Icons.zoom_in, color: Colors.white70, size: 18),
          ]);
        },
      );

  Widget _controls() => Container(
        color: Theme.of(context).colorScheme.surface,
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
        child: Row(children: [
          // الكمية
          Container(
            decoration: BoxDecoration(border: Border.all(color: Colors.white24), borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              IconButton(
                  icon: const Icon(Icons.remove, size: 18),
                  onPressed: () {
                    setState(() => _qty = (_qty - 1).clamp(1, 999));
                    AppSettings.setQty(_qty);
                  }),
              Text('×${_qty.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800)),
              IconButton(
                  icon: const Icon(Icons.add, size: 18),
                  onPressed: () {
                    setState(() => _qty += 1);
                    AppSettings.setQty(_qty);
                  }),
            ]),
          ),
          const SizedBox(width: 8),
          // إيقاف/تشغيل مؤقت
          IconButton.filledTonal(
            tooltip: _scanning ? 'إيقاف مؤقت' : 'استئناف',
            onPressed: _toggleScanning,
            icon: Icon(_scanning ? Icons.pause : Icons.play_arrow),
          ),
          const SizedBox(width: 8),
          IconButton.filledTonal(
            tooltip: 'إدخال يدوي',
            onPressed: _manualEntry,
            icon: const Icon(Icons.keyboard),
          ),
          const Spacer(),
          Row(children: [
            const Text('متواصل', style: TextStyle(fontSize: 12)),
            Switch(value: _continuous, onChanged: (v) { setState(() => _continuous = v); AppSettings.setContinuous(v); }),
          ]),
        ]),
      );

  Widget _historyList(ScanTarget t) => Container(
        decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22))),
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 4),
            child: Row(children: [
              const Text('آخر العمليات', style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(width: 8),
              Text('(${_history.length})', style: const TextStyle(color: Colors.grey)),
              const Spacer(),
              Text('إلى: ${t.label}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
              if (_history.isNotEmpty)
                IconButton(
                    tooltip: 'مسح القائمة',
                    icon: const Icon(Icons.delete_sweep, size: 20),
                    onPressed: () => setState(_history.clear)),
            ]),
          ),
          Expanded(
            child: _history.isEmpty
                ? const Center(child: Text('وجّه الكاميرا نحو الباركود', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _history.length,
                    itemBuilder: (_, i) {
                      final s = _history[i];
                      return ListTile(
                        dense: true,
                        leading: CircleAvatar(
                            backgroundColor: (s.product != null ? Colors.green : Colors.orange).withOpacity(.15),
                            child: Icon(s.product != null ? Icons.inventory_2 : Icons.help_outline,
                                color: s.product != null ? Colors.green : Colors.orange, size: 20)),
                        title: Text(s.product?['name'] ?? 'غير مسجل',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${s.code}  ·  ×${s.qty.toStringAsFixed(0)}',
                              textDirection: TextDirection.rtl, textAlign: TextAlign.right),
                          if (s.error != null && s.error!.isNotEmpty)
                            Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(s.error!,
                                    style: const TextStyle(fontSize: 10, color: Colors.redAccent),
                                    textAlign: TextAlign.right)),
                        ]),
                        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(s.sent ? Icons.cloud_done : Icons.cloud_off,
                              size: 18, color: s.sent ? Colors.green : Colors.orange),
                          if (!s.sent)
                            IconButton(
                                tooltip: 'إعادة الإرسال',
                                icon: const Icon(Icons.refresh, size: 18),
                                onPressed: () async {
                                  final ok = await ScanService.send(s.code, target: _target, qty: s.qty);
                                  if (!mounted) return;
                                  setState(() {
                                    _history[i] = _Scan(s.code, s.product, ok, s.qty,
                                        error: ok ? null : ScanService.lastError);
                                  });
                                  _snack(ok ? 'تم الإرسال' : 'ما زال بلا اتصال');
                                }),
                          IconButton(
                              tooltip: 'حذف',
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () => setState(() => _history.removeAt(i))),
                        ]),
                      );
                    },
                  ),
          ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final t = ScanTarget.byId(_target);
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('ماسح كاشير برو', style: TextStyle(fontSize: 11, color: Colors.white70)),
          Text(t.label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        ]),
        actions: [
          ValueListenableBuilder<MobileScannerState>(
            valueListenable: _ctrl,
            builder: (context, state, _) => IconButton(
              tooltip: 'الكشاف',
              icon: Icon(state.torchState == TorchState.on ? Icons.flash_on : Icons.flash_off),
              onPressed: state.torchState == TorchState.unavailable ? null : _toggleTorch,
            ),
          ),
          IconButton(tooltip: 'تبديل الكاميرا', icon: const Icon(Icons.cameraswitch), onPressed: _switchCamera),
          IconButton(tooltip: 'الإعدادات', icon: const Icon(Icons.tune), onPressed: _openSettings),
        ],
      ),
      body: Column(children: [
        _targetBar(t),
        Expanded(
          flex: 5,
          child: Stack(fit: StackFit.expand, children: [
            MobileScanner(
              controller: _ctrl,
              onDetect: (BarcodeCapture cap) {
                if (cap.barcodes.isEmpty) return;
                final raw = cap.barcodes.first.rawValue;
                if (raw != null && raw.isNotEmpty) _handle(raw);
              },
              errorBuilder: _cameraError,
              placeholderBuilder: _cameraPlaceholder,
            ),
            IgnorePointer(
              child: Center(
                child: Container(
                    width: 260,
                    height: 160,
                    decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFF4F46E5), width: 3),
                        borderRadius: BorderRadius.circular(16))),
              ),
            ),
            if (!_scanning)
              Positioned.fill(
                child: ColoredBox(
                  color: Colors.black.withOpacity(.55),
                  child: Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.pause_circle_outline, color: Colors.white, size: 44),
                      const SizedBox(height: 8),
                      const Text('المسح متوقف مؤقتاً', style: TextStyle(color: Colors.white)),
                      const SizedBox(height: 10),
                      FilledButton.icon(
                          onPressed: _toggleScanning,
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('استئناف')),
                    ]),
                  ),
                ),
              ),
            Positioned(bottom: 4, left: 12, right: 12, child: _zoomSlider()),
          ]),
        ),
        _controls(),
        Expanded(flex: 4, child: _historyList(t)),
      ]),
    );
  }
}

class _Scan {
  final String code;
  final Map<String, dynamic>? product;
  final bool sent;
  final double qty;
  final String? error;
  _Scan(this.code, this.product, this.sent, this.qty, {this.error});
}
