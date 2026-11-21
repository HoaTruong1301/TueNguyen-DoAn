import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../../core/security/auth_service.dart';

class VoucherService {
  static String get _baseUrl => '${ApiConfig.apiUrl}/promotion/vouchers';

  static Future<Map<String, dynamic>> _request(String path) async {
    final uri = Uri.parse('$_baseUrl$path');

    final response = await AuthService.sendWithRefresh(
      send: (headers) {
        return http.get(uri, headers: headers);
      },
    );

    final decoded = jsonDecode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (decoded is Map<String, dynamic>) {
        throw Exception(
          decoded['message'] ?? 'Không thể tải thông tin khuyến mãi.',
        );
      }

      throw Exception('Không thể tải thông tin khuyến mãi.');
    }

    if (decoded is! Map<String, dynamic>) {
      throw Exception('Dữ liệu khuyến mãi không hợp lệ.');
    }

    return decoded;
  }

  static Future<Map<String, dynamic>> getVouchers({
    int page = 1,
    int limit = 20,
  }) {
    return _request(' ?page=$page&limit=$limit'.trim());
  }

  static Future<Map<String, dynamic>> getVoucherDetail(String voucherId) {
    return _request('/$voucherId');
  }
}
