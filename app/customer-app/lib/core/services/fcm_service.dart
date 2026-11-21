import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/widgets.dart';
import 'dart:convert';

import '../../features/notification/services/notification_service.dart';
import '../../../app/app.dart';
import '../../../app/routes.dart';

class FcmService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static String? _currentToken;
  static bool _isLoggedIn = false;
  static final ValueNotifier<int> notificationReadNotifier = ValueNotifier<int>(
    0,
  );

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'default',
    'Thông báo Tuệ Nguyên',
    description: 'Thông báo về đơn hàng và giao hàng',
    importance: Importance.max,
  );

  static Future<void> initialize() async {
    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );

    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );

    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();

    await androidPlugin?.createNotificationChannel(_channel);

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    debugPrint('FCM permission: ${settings.authorizationStatus}');

    _messaging.onRegistered.listen((token) {
      if (token.isNotEmpty) {
        _currentToken = token;

        debugPrint('FCM token đã được cấp.');

        if (_isLoggedIn) {
          registerDeviceToken();
        }
      }
    });

    await _messaging.register();

    FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
      debugPrint('FCM foreground message: ${message.messageId}');

      final notification = message.notification;

      if (notification == null) return;

      debugPrint('FCM title: ${notification.title}');
      debugPrint('FCM body: ${notification.body}');

      await _localNotifications.show(
        id: DateTime.now().millisecondsSinceEpoch.remainder(2147483647),
        title: notification.title,
        body: notification.body,
        payload: jsonEncode(message.data),
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _channel.id,
            _channel.name,
            channelDescription: _channel.description,
            importance: Importance.max,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
        ),
      );
    });

    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('FCM notification opened: ${message.messageId}');
      _handleNotificationTap(message.data);
    });

    final initialMessage = await _messaging.getInitialMessage();

    if (initialMessage != null) {
      debugPrint(
        'FCM app opened from terminated state: ${initialMessage.messageId}',
      );

      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleNotificationTap(initialMessage.data);
      });
    }
  }

  static void _onLocalNotificationTap(NotificationResponse response) {
    final payload = response.payload;

    if (payload == null || payload.isEmpty) return;

    try {
      final decoded = jsonDecode(payload);

      if (decoded is Map) {
        _handleNotificationTap(Map<String, dynamic>.from(decoded));
      }
    } catch (error) {
      debugPrint('Không đọc được dữ liệu thông báo: $error');
    }
  }

  static Future<void> _handleNotificationTap(Map<String, dynamic> data) async {
    // Đánh dấu thông báo đã đọc trên Backend.
    final notificationId = data['notificationId']?.toString();

    if (_isLoggedIn && notificationId != null && notificationId.isNotEmpty) {
      try {
        final result = await NotificationService.markAsRead(notificationId);

        if (result['success'] == true) {
          notificationReadNotifier.value++;
        }

        debugPrint('Đánh dấu thông báo đã đọc: ${result['success']}');
      } catch (error) {
        debugPrint('Không thể đánh dấu thông báo đã đọc: $error');
      }
    }

    // Điều hướng đến chi tiết đơn giao hàng.
    final type = data['type']?.toString();
    final orderId = data['orderId']?.toString();

    if (orderId == null || orderId.isEmpty) {
      return;
    }

    switch (type) {
      case 'delivery_status':
        appNavigatorKey.currentState?.pushNamed(
          AppRoutes.deliveryDetail,
          arguments: orderId,
        );
        break;

      case 'order_status':
        appNavigatorKey.currentState?.pushNamed(
          AppRoutes.orderDetail,
          arguments: orderId,
        );
        break;

      default:
        break;
    }
  }

  static Future<void> onUserLoggedIn() async {
    _isLoggedIn = true;

    final token = _currentToken;

    if (token != null && token.isNotEmpty) {
      await registerDeviceToken();
    }
  }

  static Future<void> onUserLoggedOut() async {
    _isLoggedIn = false;
  }

  static Future<void> registerDeviceToken() async {
    final token = _currentToken;

    if (!_isLoggedIn || token == null || token.isEmpty) {
      return;
    }

    try {
      final result = await NotificationService.registerDeviceToken(token);

      if (result['success'] == true) {
        debugPrint('Đã đăng ký FCM token với backend.');
      }
    } catch (error) {
      debugPrint('Không thể đăng ký FCM token: $error');
    }
  }
}
