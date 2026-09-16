import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: AppConfig.supabaseUrl, anonKey: AppConfig.supabaseAnonKey);
  runApp(const ScannerApp());
}

class ScannerApp extends StatelessWidget {
  const ScannerApp({super.key});
  @override
  Widget build(BuildContext context) {
    final base = ThemeData(useMaterial3: true, colorSchemeSeed: const Color(0xFF4F46E5), brightness: Brightness.dark);
    return MaterialApp(
      title: 'ماسح كاشير برو',
      debugShowCheckedModeBanner: false,
      theme: base.copyWith(textTheme: GoogleFonts.cairoTextTheme(base.textTheme)),
      locale: const Locale('ar'),
      builder: (c, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
      home: Supabase.instance.client.auth.currentSession == null ? const LoginScreen() : const HomeScreen(),
    );
  }
}
