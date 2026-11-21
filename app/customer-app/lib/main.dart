import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'app/app.dart';
import 'app/routes.dart';

import 'core/constants/app_colors.dart';
import 'core/services/fcm_service.dart';
import 'features/home/home_page.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Đã nhận thông báo nền: ${message.messageId}');
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp();

  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  await FcmService.initialize();

  runApp(const TueNguyenApp());
}

class TueNguyenApp extends StatelessWidget {
  const TueNguyenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: appNavigatorKey,
      onGenerateRoute: AppRoutes.generateRoute,
      title: 'Tuệ Nguyên',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: backgroundColor,
        colorScheme: ColorScheme.fromSeed(seedColor: primaryColor),
        fontFamily: 'Roboto',
      ),
      home: const HomePage(),
    );
  }
}
