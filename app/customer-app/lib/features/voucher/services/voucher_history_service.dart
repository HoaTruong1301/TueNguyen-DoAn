import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../../core/security/auth_service.dart';
import '../models/voucher_history.dart';

class VoucherHistoryService {
  static String get _url => '${ApiConfig.apiUrl}/promotion/vouchers/my-history';

  Future<Map<String, dynamic>> getMyVoucherHistory({
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri.parse('$_url?page=$page&limit=$limit');

    final response = await AuthService.sendWithRefresh(
      headers: {},
      send: (headers) =>
          http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
    );

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ?? 'Không thể tải lịch sử Voucher.',
      );
    }

    final data = body['data'];

    if (data is! List) {
      throw Exception('Dữ liệu lịch sử Voucher không hợp lệ.');
    }

    final pagination = body['pagination'];

    return {
      'items': data
          .map(
            (item) =>
                VoucherHistory.fromJson(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
      'pagination': pagination is Map
          ? Map<String, dynamic>.from(pagination)
          : <String, dynamic>{},
    };
  }
}
