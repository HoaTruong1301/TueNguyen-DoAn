import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/food_review.dart';
import '../../../core/config/api_config.dart';
import '../../../core/security/auth_service.dart';

class ReviewService {
  Future<void> createFoodReview({
    required String orderId,
    required String foodId,
    required int rating,
    String? title,
    String? content,
  }) async {
    final url = '${ApiConfig.apiUrl}/review/food';

    final response = await AuthService.sendWithRefresh(
      headers: {'Content-Type': 'application/json'},
      send: (headers) => http
          .post(
            Uri.parse(url),
            headers: headers,
            body: jsonEncode({
              'orderId': orderId,
              'foodId': foodId,
              'rating': rating,
              'title': title?.trim(),
              'content': content?.trim(),
            }),
          )
          .timeout(const Duration(seconds: 20)),
    );

    final Map<String, dynamic> json = jsonDecode(
      utf8.decode(response.bodyBytes),
    );

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        json['success'] != true) {
      throw Exception(json['message'] ?? 'Không thể gửi đánh giá món ăn.');
    }
  }

  Future<FoodReviewResponse> getFoodReviews({
    required String foodId,
    int page = 1,
    int limit = 10,
    int? rating,
    bool hasImages = false,
  }) async {
    final queryParameters = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (rating != null) {
      queryParameters['rating'] = rating.toString();
    }

    if (hasImages) {
      queryParameters['hasImages'] = 'true';
    }

    final uri = Uri.parse(
      '${ApiConfig.apiUrl}/review/food/$foodId',
    ).replace(queryParameters: queryParameters);

    final response = await http.get(uri);

    final Map<String, dynamic> json = jsonDecode(
      utf8.decode(response.bodyBytes),
    );

    if (response.statusCode != 200 || json['success'] != true) {
      throw Exception(json['message'] ?? 'Không thể tải đánh giá món ăn.');
    }

    return FoodReviewResponse.fromJson(json);
  }

  Future<bool> hasReviewedFood({
    required String orderId,
    required String foodId,
  }) async {
    final uri = Uri.parse(
      '${ApiConfig.apiUrl}/review/food/status',
    ).replace(queryParameters: {'orderId': orderId, 'foodId': foodId});

    final response = await AuthService.sendWithRefresh(
      send: (token) => http.get(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ),
    );

    final body = jsonDecode(utf8.decode(response.bodyBytes));

    if (response.statusCode != 200 || body['success'] != true) {
      throw Exception(
        body['message'] ?? 'Không thể kiểm tra trạng thái đánh giá.',
      );
    }

    return body['data']?['hasReviewed'] == true;
  }

  Future<Map<String, dynamic>> createOrderReview({
    required String orderId,
    required int orderRating,
    required int serviceRating,
    int? deliveryRating,
    String? orderContent,
    String? serviceContent,
    String? deliveryContent,
  }) async {
    final url = '${ApiConfig.apiUrl}/review/order';

    final body = <String, dynamic>{
      'orderId': orderId,
      'orderRating': orderRating,
      'serviceRating': serviceRating,
      'orderContent': orderContent?.trim(),
      'serviceContent': serviceContent?.trim(),
      'deliveryRating': ?deliveryRating,
      'deliveryContent': ?deliveryContent?.trim(),
    };

    final response = await AuthService.sendWithRefresh(
      headers: {'Content-Type': 'application/json'},
      send: (headers) => http
          .post(Uri.parse(url), headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 20)),
    );

    final Map<String, dynamic> json = jsonDecode(
      utf8.decode(response.bodyBytes),
    );

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        json['success'] != true) {
      throw Exception(json['message'] ?? 'Không thể gửi đánh giá đơn hàng.');
    }

    return Map<String, dynamic>.from(json);
  }

  Future<Map<String, dynamic>> getOrderReviewStatus({
    required String orderId,
  }) async {
    final uri = Uri.parse(
      '${ApiConfig.apiUrl}/review/order/status',
    ).replace(queryParameters: {'orderId': orderId});

    final response = await AuthService.sendWithRefresh(
      send: (headers) =>
          http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
    );

    final Map<String, dynamic> json = jsonDecode(
      utf8.decode(response.bodyBytes),
    );

    if (response.statusCode != 200 || json['success'] != true) {
      throw Exception(
        json['message'] ?? 'Không thể kiểm tra trạng thái đánh giá.',
      );
    }

    return Map<String, dynamic>.from(json['data']);
  }
}
