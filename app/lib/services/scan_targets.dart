import 'package:flutter/material.dart';

/// وجهات المسح - مطابقة للوجهات في الموقع (scan_events.target)
/// لكل صفحة في الموقع قناة خاصة بها، والتطبيق يختار الوجهة قبل المسح.
class ScanTarget {
  final String id;
  final String label;
  final String hint;
  final IconData icon;
  final Color color;
  const ScanTarget(this.id, this.label, this.hint, this.icon, this.color);

  static const List<ScanTarget> all = <ScanTarget>[
    ScanTarget('pos', 'نقطة البيع', 'يُضاف المنتج مباشرة إلى سلة الكاشير', Icons.point_of_sale, Colors.green),
    ScanTarget('product', 'إضافة / تعديل منتج', 'يملأ حقل الباركود في صفحة المنتج', Icons.add_circle_outline, Colors.indigo),
    ScanTarget('purchase', 'فاتورة شراء', 'يضيف سطراً إلى فاتورة الشراء المفتوحة', Icons.local_shipping, Colors.brown),
    ScanTarget('inventory', 'الجرد والمخزون', 'يفتح نافذة تعديل المخزون بالكمية الممسوحة', Icons.inventory_2, Colors.orange),
    ScanTarget('returns', 'المرتجعات', 'يبحث عن الفاتورة التي تحوي هذا المنتج', Icons.undo, Colors.redAccent),
    ScanTarget('products', 'استقبال المسح', 'يعرض المنتج في صفحة الاستقبال العامة', Icons.visibility, Colors.blueGrey),
  ];

  static ScanTarget byId(String? id) =>
      all.firstWhere((ScanTarget t) => t.id == id, orElse: () => all.first);
}
