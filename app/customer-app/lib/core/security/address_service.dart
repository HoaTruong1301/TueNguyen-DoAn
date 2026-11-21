import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_service.dart';

class AddressService {
  AddressService._();

  static String get _baseUrl => '${ApiConfig.apiUrl}/members';

  static Future<http.Response> _sendWithRefresh(
    Future<http.Response> Function(Map<String, String> headers) send,
  ) {
    return AuthService.sendWithRefresh(
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      send: send,
    );
  }

  static Map<String, dynamic> _decodeBody(http.Response response) {
    try {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw Exception('Phản hồi từ máy chủ không hợp lệ.');
    }
  }

  static void _checkSuccess(
    http.Response response,
    Map<String, dynamic> body, {
    List<int> acceptedStatusCodes = const [200],
  }) {
    if (!acceptedStatusCodes.contains(response.statusCode) ||
        body['success'] != true) {
      throw Exception(
        'HTTP ${response.statusCode}: '
        '${body['message'] ?? response.body}',
      );
    }
  }

  static Future<List<Map<String, dynamic>>> getAddresses() async {
    final response = await _sendWithRefresh(
      (headers) => http
          .get(Uri.parse('$_baseUrl/addresses'), headers: headers)
          .timeout(const Duration(seconds: 15)),
    );

    final body = _decodeBody(response);
    _checkSuccess(response, body);

    final data = body['data'];

    if (data is List) {
      return data
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
    }

    if (data is Map && data['items'] is List) {
      return (data['items'] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
    }

    return [];
  }

  static Future<Map<String, dynamic>> createAddress({
    required String recipientName,
    required String phone,
    required String addressLine,
    required double latitude,
    required double longitude,

    String? ward,
    String? district,
    String? province,
    bool isDefault = false,
  }) async {
    final requestBody = jsonEncode({
      'recipientName': recipientName.trim(),
      'phone': phone.trim(),
      'addressLine': addressLine.trim(),
      'latitude': latitude,
      'longitude': longitude,
      if (ward != null && ward.trim().isNotEmpty) 'ward': ward.trim(),
      if (district != null && district.trim().isNotEmpty)
        'district': district.trim(),
      if (province != null && province.trim().isNotEmpty)
        'province': province.trim(),
      'isDefault': isDefault,
    });

    final response = await _sendWithRefresh(
      (headers) => http
          .post(
            Uri.parse('$_baseUrl/addresses'),
            headers: headers,
            body: requestBody,
          )
          .timeout(const Duration(seconds: 15)),
    );

    final body = _decodeBody(response);
    _checkSuccess(response, body, acceptedStatusCodes: [200, 201]);

    return Map<String, dynamic>.from(body['data'] as Map);
  }

  static Future<void> setDefaultAddress(String id) async {
    final response = await _sendWithRefresh(
      (headers) => http
          .put(Uri.parse('$_baseUrl/addresses/$id/default'), headers: headers)
          .timeout(const Duration(seconds: 15)),
    );

    final body = _decodeBody(response);
    _checkSuccess(response, body);
  }

  static Future<void> deleteAddress(String id) async {
    final response = await _sendWithRefresh(
      (headers) => http
          .delete(Uri.parse('$_baseUrl/addresses/$id'), headers: headers)
          .timeout(const Duration(seconds: 15)),
    );

    if (response.statusCode == 204) return;

    final body = _decodeBody(response);
    _checkSuccess(response, body);
  }
}
