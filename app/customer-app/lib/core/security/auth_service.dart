
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class AuthService {
  AuthService._();

  static String get _baseUrl => '${ApiConfig.apiUrl}/auth';

  static const FlutterSecureStorage _storage =
      FlutterSecureStorage();

  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';



  static Future<Map<String, dynamic>> register({
    String? email,
    String? phone,
    required String password,
    required String confirmPassword,
  }) async {
    final normalizedEmail = email?.trim().toLowerCase();
    final normalizedPhone = phone?.trim();

    if ((normalizedEmail == null || normalizedEmail.isEmpty) &&
        (normalizedPhone == null || normalizedPhone.isEmpty)) {
      throw Exception('Vui lòng nhập email hoặc số điện thoại.');
    }

    final response = await http
        .post(
      Uri.parse('$_baseUrl/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': normalizedEmail?.isEmpty == true
            ? null
            : normalizedEmail,
        'phone': normalizedPhone?.isEmpty == true
            ? null
            : normalizedPhone,
        'password': password,
        'confirmPassword': confirmPassword,
      }),
    )
        .timeout(const Duration(seconds: 15));

    final decoded = jsonDecode(response.body);

    if (decoded is! Map<String, dynamic> ||
        response.statusCode != 201 ||
        decoded['success'] != true) {
      final message = decoded is Map<String, dynamic>
          ? decoded['message']?.toString()
          : null;

      throw Exception(message ?? 'Đăng ký tài khoản thất bại.');
    }

    return Map<String, dynamic>.from(
      decoded['data'] as Map<String, dynamic>,
    );
  }


  static Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final response = await http
        .post(
      Uri.parse('$_baseUrl/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identifier': identifier.trim(),
        'password': password,
      }),
    )
        .timeout(const Duration(seconds: 15));

    final Map<String, dynamic> body =
    jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 403 &&
        body['code']?.toString() == 'EMAIL_NOT_VERIFIED') {
      throw Exception('EMAIL_NOT_VERIFIED');
    }

    if (response.statusCode == 429 &&
        body['code']?.toString() == 'ACCOUNT_TEMPORARILY_LOCKED') {
      throw Exception('ACCOUNT_TEMPORARILY_LOCKED');
    }

    if (response.statusCode != 200 || body['success'] != true) {
      throw Exception(
        body['message']?.toString() ?? 'Đăng nhập thất bại.',
      );
    }

    final data = body['data'] as Map<String, dynamic>;
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();

    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty) {
      throw Exception('Backend không trả về token đăng nhập hợp lệ.');
    }

    await _storage.write(
      key: _accessTokenKey,
      value: accessToken,
    );

    await _storage.write(
      key: _refreshTokenKey,
      value: refreshToken,
    );

    return Map<String, dynamic>.from(
      data['user'] as Map<String, dynamic>,
    );
  }


  static Future<String?> getAccessToken() async {
    return _storage.read(key: _accessTokenKey);
  }

  static Future<String?> getRefreshToken() async {
    return _storage.read(key: _refreshTokenKey);
  }

  static Future<bool>? _refreshInFlight;

  static Future<bool> refreshAccessToken() {
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    final future = _performRefreshAccessToken();
    _refreshInFlight = future;

    return future.whenComplete(() {
      if (identical(_refreshInFlight, future)) {
        _refreshInFlight = null;
      }
    });
  }

  static Future<bool> _performRefreshAccessToken() async {
    final refreshToken = await getRefreshToken();

    if (refreshToken == null || refreshToken.isEmpty) {
      return false;
    }

    try {
      final response = await http
          .post(
        Uri.parse('$_baseUrl/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      )
          .timeout(const Duration(seconds: 15));

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic> ||
          response.statusCode != 200 ||
          decoded['success'] != true) {
        return false;
      }

      final data = decoded['data'];
      if (data is! Map<String, dynamic>) return false;

      final newAccessToken = data['accessToken']?.toString();
      final newRefreshToken = data['refreshToken']?.toString();

      if (newAccessToken == null ||
          newAccessToken.isEmpty ||
          newRefreshToken == null ||
          newRefreshToken.isEmpty) {
        return false;
      }

      await _storage.write(
        key: _accessTokenKey,
        value: newAccessToken,
      );
      await _storage.write(
        key: _refreshTokenKey,
        value: newRefreshToken,
      );

      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<http.Response> sendWithRefresh({
    required Future<http.Response> Function(
        Map<String, String> headers,
        ) send,
    Map<String, String> headers = const {},
  }) async {
    Future<Map<String, String>> buildHeaders() async {
      final token = await getAccessToken();

      if (token == null || token.isEmpty) {
        throw Exception('Vui lòng đăng nhập lại.');
      }

      return {
        ...headers,
        'Authorization': 'Bearer $token',
      };
    }

    final originalToken = await getAccessToken();

    if (originalToken == null || originalToken.isEmpty) {
      throw Exception('Vui lòng đăng nhập lại.');
    }

    var response = await send(await buildHeaders());

    if (response.statusCode != 401) {
      return response;
    }

    // Một API khác có thể đã refresh token trong lúc chờ phản hồi.
    var currentToken = await getAccessToken();

    if (currentToken == null || currentToken.isEmpty) {
      throw Exception('Vui lòng đăng nhập lại.');
    }

    if (currentToken == originalToken) {
      final refreshed = await refreshAccessToken();

      if (!refreshed) {
        // Kiểm tra lại để tránh đăng xuất nếu token vừa được cập nhật.
        currentToken = await getAccessToken();

        if (currentToken == null ||
            currentToken.isEmpty ||
            currentToken == originalToken) {
          await logout();
          throw Exception(
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          );
        }
      }
    }

    // Thử lại đúng một lần với access token hiện tại.
    response = await send(await buildHeaders());

    return response;
  }


  static Future<Map<String, dynamic>> verifyEmail({
    required String userId,
    required String token,
  }) async {
    final response = await http
        .post(
      Uri.parse('$_baseUrl/verify-email'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'userId': userId,
        'token': token.trim(),
      }),
    )
        .timeout(const Duration(seconds: 15));

    final decoded = jsonDecode(response.body);


    if (decoded is! Map<String, dynamic> ||
        response.statusCode != 200 ||
        decoded['success'] != true) {
      if (decoded is Map<String, dynamic>) {
        final code = decoded['code']?.toString();

        if (code == 'VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED') {
          throw Exception('VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED');
        }

        throw Exception(
          decoded['message']?.toString() ??
              'Xác minh email thất bại.',
        );
      }

      throw Exception('Xác minh email thất bại.');
    }


    final data = decoded['data'];

    if (data is Map<String, dynamic>) {
      return Map<String, dynamic>.from(data);
    }

    return {};
  }

  static Future<Map<String, dynamic>> resendVerificationWithPassword({
    required String identifier,
    required String password,
  }) async {
    final response = await http
        .post(
      Uri.parse('$_baseUrl/resend-verification-with-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identifier': identifier.trim(),
        'password': password,
      }),
    )
        .timeout(const Duration(seconds: 15));

    final decoded = jsonDecode(response.body);

    if (decoded is! Map<String, dynamic> ||
        response.statusCode != 200 ||
        decoded['success'] != true) {
      if (decoded is Map<String, dynamic>) {
        final code = decoded['code']?.toString();

        if (code == 'OTP_RESEND_TOO_SOON') {
          throw Exception('OTP_RESEND_TOO_SOON');
        }

        if (code == 'OTP_RESEND_LIMIT_EXCEEDED') {
          throw Exception('OTP_RESEND_LIMIT_EXCEEDED');
        }

        throw Exception(
          decoded['message']?.toString() ??
              'Không thể gửi lại mã xác minh.',
        );
      }

      throw Exception('Không thể gửi lại mã xác minh.');
    }

    final data = decoded['data'];

    if (data is! Map<String, dynamic>) {
      throw Exception('Dữ liệu phản hồi không hợp lệ.');
    }

    return Map<String, dynamic>.from(data);
  }

  static Future<Map<String, dynamic>> resendVerification() async {
    final response = await sendWithRefresh(
      send: (headers) {
        return http.post(
          Uri.parse('$_baseUrl/resend-verification'),
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
        ).timeout(const Duration(seconds: 15));
      },
    );

    final decoded = jsonDecode(response.body);

    if (decoded is! Map<String, dynamic> ||
        response.statusCode != 200 ||
        decoded['success'] != true) {
      throw Exception(
        decoded is Map<String, dynamic>
            ? decoded['message']?.toString() ??
            'Không thể gửi lại mã xác minh.'
            : 'Không thể gửi lại mã xác minh.',
      );
    }

    final data = decoded['data'];

    if (data is! Map<String, dynamic>) {
      throw Exception('Dữ liệu phản hồi không hợp lệ.');
    }

    return Map<String, dynamic>.from(data);
  }


  static Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await sendWithRefresh(
      send: (headers) {
        return http.post(
          Uri.parse('$_baseUrl/change-password'),
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'currentPassword': currentPassword,
            'newPassword': newPassword,
          }),
        ).timeout(const Duration(seconds: 15));
      },
    );

    final decoded = jsonDecode(response.body);

    if (decoded is! Map<String, dynamic> ||
        response.statusCode != 200 ||
        decoded['success'] != true) {
      throw Exception(
        decoded is Map<String, dynamic>
            ? decoded['message']?.toString() ??
            'Không thể đổi mật khẩu.'
            : 'Không thể đổi mật khẩu.',
      );
    }

    final data = decoded['data'];

    if (data is! Map<String, dynamic>) {
      throw Exception('Dữ liệu phản hồi không hợp lệ.');
    }

    return Map<String, dynamic>.from(data);
  }



  static Future<void> logout() async {
    final refreshToken = await getRefreshToken();

    if (refreshToken != null && refreshToken.isNotEmpty) {
      try {
        await http.post(
          Uri.parse('$_baseUrl/logout'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': refreshToken}),
        ).timeout(const Duration(seconds: 10));
      } catch (_) {
        // Vẫn xóa token cục bộ nếu mất kết nối.
      }
    }

    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
