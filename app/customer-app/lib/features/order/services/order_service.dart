import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/order.dart';

import '../../../core/config/api_config.dart';
import '../../../core/security/auth_service.dart';

class OrderService {
  static String get _url => '${ApiConfig.apiUrl}/orders';

  Future<Map<String, dynamic>> validateVoucher({
    required String voucherCode,
    required List<Map<String, dynamic>> items,
  }) async {
    final url = '${ApiConfig.apiUrl}/promotion/vouchers/validate';

    final response = await AuthService.sendWithRefresh(
      headers: {'Content-Type': 'application/json'},
      send: (headers) => http
          .post(
            Uri.parse(url),
            headers: headers,
            body: jsonEncode({
              'voucherCode': voucherCode.trim().toUpperCase(),
              'items': items,
            }),
          )
          .timeout(const Duration(seconds: 20)),
    );

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ??
            'Không thể kiểm tra Voucher (${response.statusCode}).',
      );
    }

    final data = body['data'];

    if (data is! Map) {
      throw Exception('Dữ liệu Voucher không hợp lệ.');
    }

    return Map<String, dynamic>.from(data);
  }

  Future<Map<String, dynamic>> createOrder({
    required String addressId,
    required List<Map<String, dynamic>> items,
    String? voucherCode,
    String? note,
  }) async {
    final response = await AuthService.sendWithRefresh(
      headers: {'Content-Type': 'application/json'},
      send: (headers) => http
          .post(
            Uri.parse(_url),
            headers: headers,
            body: jsonEncode({
              'orderType': 'delivery',
              'addressId': addressId,
              'paymentMethod': 'cash',
              'items': items,
              if (voucherCode != null && voucherCode.trim().isNotEmpty)
                'voucherCode': voucherCode.trim().toUpperCase(),
              if (note != null && note.isNotEmpty) 'note': note,
            }),
          )
          .timeout(const Duration(seconds: 20)),
    );

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ??
            body['error']?.toString() ??
            'Không thể tạo đơn hàng (${response.statusCode}).',
      );
    }

    final data = body['data'];

    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  Future<List<Order>> getMyOrders({int page = 1, int limit = 10}) async {
    final uri = Uri.parse(
      _url,
    ).replace(queryParameters: {'page': '$page', 'limit': '$limit'});

    final response = await AuthService.sendWithRefresh(
      headers: {},
      send: (headers) =>
          http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
    );

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ?? 'Không thể tải lịch sử đơn hàng.',
      );
    }

    final data = body['data'];

    if (data is! List) {
      return [];
    }

    return data
        .map((item) => Order.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<Map<String, dynamic>> getOrderDetail(String orderId) async {
    final uri = Uri.parse('$_url/$orderId');

    final response = await AuthService.sendWithRefresh(
      headers: {},
      send: (headers) =>
          http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
    );

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ?? 'Không thể tải chi tiết đơn hàng.',
      );
    }

    final data = body['data'];

    if (data is! Map) {
      throw Exception('Dữ liệu chi tiết đơn hàng không hợp lệ.');
    }

    return Map<String, dynamic>.from(data);
  }

  Future<void> cancelOrder({required String orderId, String? reason}) async {
    final uri = Uri.parse('$_url/$orderId/cancel');

    final response = await AuthService.sendWithRefresh(
      headers: {'Content-Type': 'application/json'},
      send: (headers) => http
          .post(
            uri,
            headers: headers,
            body: jsonEncode({
              if (reason != null && reason.trim().isNotEmpty)
                'reason': reason.trim(),
            }),
          )
          .timeout(const Duration(seconds: 20)),
    );

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['message']?.toString() ?? 'Không thể hủy đơn hàng.');
    }
  }
}
