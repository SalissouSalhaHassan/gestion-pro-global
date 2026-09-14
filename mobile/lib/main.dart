import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'providers/auth_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/supplier_provider.dart';
import 'providers/purchase_provider.dart';
import 'providers/rent_provider.dart';
import 'providers/ciment_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'utils/session_timer.dart';

import 'api/supabase_service.dart';
import 'api/api_service.dart';
import 'config/app_config.dart';
import 'services/offline_queue_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.init();
  await SupabaseService().init();
  
  // Initialize offline queue and auto-sync when online
  final queue = OfflineQueueService();
  queue.syncPendingInvoices(
    customSyncHandler: (payload, {double? paymentAmount, String? paymentMethod, String? advanceClientId}) async {
      await ApiService().createInvoice(payload, '', paymentAmount: paymentAmount, paymentMethod: paymentMethod, advanceClientId: advanceClientId);
    },
  );
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => DashboardProvider()),
        ChangeNotifierProvider(create: (_) => SupplierProvider()),
        ChangeNotifierProvider(create: (_) => PurchaseProvider()),
        ChangeNotifierProvider(create: (_) => RentProvider()),
        ChangeNotifierProvider(create: (_) => CimentProvider()),
      ],
      child: Consumer2<AuthProvider, ThemeProvider>(
        builder: (context, auth, themeProvider, _) {
          return MaterialApp(
            title: 'Gestion Pro',
            debugShowCheckedModeBanner: false,
            locale: const Locale('fr', 'FR'),
            supportedLocales: const [Locale('fr', 'FR')],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            theme: AppThemes.lightTheme,
            darkTheme: AppThemes.darkTheme,
            themeMode: themeProvider.themeMode,
            home: auth.isAuth
                ? const SessionTimer(child: HomeScreen())
                : FutureBuilder(
                    future: auth.tryAutoLogin(),
                    builder: (ctx, snapshot) =>
                        snapshot.connectionState == ConnectionState.waiting
                        ? const Scaffold(
                            body: Center(child: CircularProgressIndicator()),
                          )
                        : (auth.isAuth
                            ? const SessionTimer(child: HomeScreen())
                            : const LoginScreen()),
                  ),
          );
        },
      ),
    );
  }
}
