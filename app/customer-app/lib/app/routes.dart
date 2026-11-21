import 'package:flutter/material.dart';

import '../features/delivery/pages/delivery_history_page.dart';
import '../features/delivery/pages/delivery_detail_page.dart';
import '../features/order/pages/order_detail_page.dart';

class AppRoutes {
  static const String home = '/';
  static const String deliveryHistory = '/delivery-history';
  static const String deliveryDetail = '/delivery-detail';
  static const String orderDetail = '/order-detail';

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case home:
        return MaterialPageRoute(
          builder: (_) =>
              const Scaffold(body: Center(child: Text('Home Page'))),
        );

      case deliveryHistory:
        return MaterialPageRoute(builder: (_) => const DeliveryHistoryPage());

      case deliveryDetail:
        final orderId = settings.arguments as String?;

        if (orderId == null || orderId.isEmpty) {
          return MaterialPageRoute(
            builder: (_) => const Scaffold(
              body: Center(child: Text('Mã đơn hàng không hợp lệ')),
            ),
          );
        }

        return MaterialPageRoute(
          builder: (_) => DeliveryDetailPage(orderId: orderId),
        );
      case orderDetail:
        final orderId = settings.arguments as String?;

        if (orderId == null || orderId.isEmpty) {
          return MaterialPageRoute(
            builder: (_) => const Scaffold(
              body: Center(child: Text('Mã đơn hàng không hợp lệ')),
            ),
          );
        }

        return MaterialPageRoute(
          builder: (_) => OrderDetailPage(orderId: orderId),
        );

      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(child: Text('No route defined for ${settings.name}')),
          ),
        );
    }
  }
}
