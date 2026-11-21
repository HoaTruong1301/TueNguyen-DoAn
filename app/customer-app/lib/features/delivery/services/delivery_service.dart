import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../../core/security/auth_service.dart';

class DeliveryService {
  static String get _url => '${ApiConfig.apiUrl}/delivery';

  Future<Map<String, dynamic>> _getResponse(
    Future<http.Response> Function(Map<String, String>) request,
  ) async {
    final response = await AuthService.sendWithRefresh(
      headers: {},
      send: request,
    ).timeout(const Duration(seconds: 20));

    final decoded = jsonDecode(response.body);

    if (decoded is! Map) {
      throw Exception('Phản hồi từ máy chủ không hợp lệ.');
    }

    final body = Map<String, dynamic>.from(decoded);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ?? 'Không thể thực hiện yêu cầu Delivery.',
      );
    }

    return body;
  }

  List<Map<String, dynamic>> _extractList(dynamic data) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }

    if (data is Map) {
      final list = data['items'] ?? data['orders'] ?? data['rows'];

      if (list is List) {
        return list
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
      }
    }

    return [];
  }

  // Danh sách đơn giao hàng của khách hàng
  Future<List<Map<String, dynamic>>> getMyDeliveryOrders({
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri.parse(
      '$_url/my-orders',
    ).replace(queryParameters: {'page': '$page', 'limit': '$limit'});

    final body = await _getResponse(
      (headers) =>
          http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
    );

    return _extractList(body['data']);
  }

  // Chi tiết giao hàng
  Future<Map<String, dynamic>> getDeliveryDetail(String orderId) async {
    final uri = Uri.parse('$_url/orders/${Uri.encodeComponent(orderId)}');

    final body = await _getResponse(
      (headers) =>
          http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
    );

    final data = body['data'];

    if (data is! Map) {
      throw Exception('Dữ liệu giao hàng không hợp lệ.');
    }

    return Map<String, dynamic>.from(data);
  }

  // Lịch sử tọa độ GPS người giao hàng
  Future<List<Map<String, dynamic>>> getDeliveryTracking(String orderId) async {
    final uri = Uri.parse(
      '$_url/orders/${Uri.encodeComponent(orderId)}/tracking',
    );

    final body = await _getResponse(
      (headers) =>
          http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
    );

    final data = body['data'];

    if (data is! Map) {
      throw Exception('Dữ liệu theo dõi GPS không hợp lệ.');
    }

    final tracking = data['tracking'];

    if (tracking is! List) {
      return [];
    }

    return tracking
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }
}
