
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'auth_service.dart';

class MemberService {
  MemberService._();

  static String get _baseUrl => '${ApiConfig.apiUrl}/members';

  static Future<http.Response> _send(
      Future<http.Response> Function(
          Map<String, String> headers,
          ) request, {
        bool jsonContent = false,
      }) {
    return AuthService.sendWithRefresh(
      headers: {
        'Accept': 'application/json',
        if (jsonContent) 'Content-Type': 'application/json',
      },
      send: request,
    );
  }

  static Map<String, dynamic> _decode(
      http.Response response,
      ) {
    try {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw Exception('Phản hồi từ máy chủ không hợp lệ.');
    }
  }

  static void _checkSuccess(
      http.Response response,
      Map<String, dynamic> body,
      ) {
    if (response.statusCode != 200 || body['success'] != true) {
      throw Exception(
        body['message']?.toString() ??
            'Không thể xử lý yêu cầu hồ sơ khách hàng '
                '(${response.statusCode}).',
      );
    }
  }

  static Future<Map<String, dynamic>> getMyProfile() async {
    final response = await _send(
          (headers) => http
          .get(
        Uri.parse('$_baseUrl/me'),
        headers: headers,
      )
          .timeout(const Duration(seconds: 15)),
    );

    final body = _decode(response);
    _checkSuccess(response, body);

    return Map<String, dynamic>.from(
      body['data'] as Map<String, dynamic>,
    );
  }

  static Future<Map<String, dynamic>> updateMyProfile({
    required String fullName,
    required String phoneNumber,
  }) async {
    final response = await _send(
          (headers) => http
          .put(
        Uri.parse('$_baseUrl/me'),
        headers: headers,
        body: jsonEncode({
          'fullName': fullName.trim(),
          'phoneNumber': phoneNumber.trim(),
        }),
      )
          .timeout(const Duration(seconds: 15)),
      jsonContent: true,
    );

    final body = _decode(response);
    _checkSuccess(response, body);

    return Map<String, dynamic>.from(
      body['data'] as Map<String, dynamic>,
    );
  }
}
