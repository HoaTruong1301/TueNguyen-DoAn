import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../../core/security/auth_service.dart';

class NotificationService {
  static String get _baseUrl => '${ApiConfig.apiUrl}/notifications';

  static Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');

    final response = await AuthService.sendWithRefresh(
      send: (headers) {
        return switch (method) {
          'GET' => http.get(uri, headers: headers),
          'POST' => http.post(
            uri,
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
            body: body == null ? null : jsonEncode(body),
          ),
          'PATCH' => http.patch(
              uri,
              headers: {
                ...headers,
                'Content-Type': 'application/json',
              },
              body: body == null ? null : jsonEncode(body),
            ),
          _ => throw Exception('HTTP method không được hỗ trợ'),
        };
      },
    );

    final decoded = jsonDecode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (decoded is Map<String, dynamic>) {
        throw Exception(
          decoded['message'] ?? 'Không thể thực hiện thao tác thông báo.',
        );
      }

      throw Exception('Không thể thực hiện thao tác thông báo.');
    }

    if (decoded is! Map<String, dynamic>) {
      throw Exception('Dữ liệu thông báo không hợp lệ.');
    }

    return decoded;
  }

  static Future<Map<String, dynamic>> getNotifications({
    int limit = 20,
    int offset = 0,
  }) {
    return _request(
      method: 'GET',
      path: '?limit=$limit&offset=$offset',
    );
  }

  static Future<Map<String, dynamic>> getUnreadCount() {
    return _request(
      method: 'GET',
      path: '/unread-count',
    );
  }

  static Future<Map<String, dynamic>> markAsRead(
    String notificationId,
  ) {
    return _request(
      method: 'PATCH',
      path: '/$notificationId/read',
    );
  }

  static Future<Map<String, dynamic>> markAllAsRead() {
    return _request(
      method: 'PATCH',
      path: '/read-all',
    );
  }
  static Future<Map<String, dynamic>> registerDeviceToken(
      String token,
      ) {
    return _request(
      method: 'POST',
      path: '/device-token',
      body: {
        'token': token,
        'platform': 'android',
      },
    );
  }
}
