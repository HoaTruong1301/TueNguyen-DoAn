import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';

import '../../../models/food.dart';

class FoodService {
  static String get _url => '${ApiConfig.apiUrl}/menu/foods';

  Future<List<Food>> getFoods() async {
    final response = await http
        .get(Uri.parse(_url))
        .timeout(const Duration(seconds: 15));

    if (response.statusCode != 200) {
      throw Exception('Máy chủ trả về mã ${response.statusCode}');
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final items = decoded['data'] as List<dynamic>;

    return items
        .map((item) => Food.fromJson(item as Map<String, dynamic>))
        .toList();
  }
  Future<Map<String, dynamic>> getFoodDetail(String foodId) async {
    final response = await http
        .get(Uri.parse('$_url/$foodId'))
        .timeout(const Duration(seconds: 15));

    if (response.statusCode != 200) {
      throw Exception('Không thể tải chi tiết món ăn');
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final data = decoded['data'];

    if (data is! Map) {
      throw Exception('Dữ liệu món ăn không hợp lệ');
    }

    return Map<String, dynamic>.from(data);
  }
}