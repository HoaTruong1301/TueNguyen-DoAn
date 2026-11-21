import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String _computerIp = '10.0.2.2';
  static const int _port = 3000;

  // Có thể ghi đè địa chỉ API khi chạy app.
  static const String _customBaseUrl =
  String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_customBaseUrl.isNotEmpty) {
      return _customBaseUrl;
    }

    if (kIsWeb) {
      return 'http://localhost:$_port';
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
        return 'http://$_computerIp:$_port';

      case TargetPlatform.windows:
      case TargetPlatform.macOS:
      case TargetPlatform.linux:
        return 'http://localhost:$_port';

      default:
        return 'http://$_computerIp:$_port';
    }
  }

  static String get apiUrl => '$baseUrl/api/v1';
}