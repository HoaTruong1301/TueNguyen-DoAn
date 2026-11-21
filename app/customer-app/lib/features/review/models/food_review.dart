class FoodReview {
  final String id;
  final String userId;
  final String? customerName;
  final int rating;
  final String? title;
  final String? content;
  final bool isVerifiedPurchase;
  final DateTime createdAt;
  final List<ReviewImage> images;

  // Phản hồi chính thức từ nhà hàng
  final String? replyContent;
  final String? replyStatus;
  final DateTime? replyUpdatedAt;

  const FoodReview({
    required this.id,
    required this.userId,
    this.customerName,
    required this.rating,
    this.title,
    this.content,
    required this.isVerifiedPurchase,
    required this.createdAt,
    this.images = const [],
    this.replyContent,
    this.replyStatus,
    this.replyUpdatedAt,
  });

  factory FoodReview.fromJson(Map<String, dynamic> json) {
    return FoodReview(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      customerName: json['customer_name']?.toString(),
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      title: json['title']?.toString(),
      content: json['content']?.toString(),
      isVerifiedPurchase: json['is_verified_purchase'] == true,
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
      images: (json['images'] as List<dynamic>? ?? [])
          .map(
            (image) => ReviewImage.fromJson(Map<String, dynamic>.from(image)),
          )
          .toList(),
      replyContent: json['reply_content']?.toString(),
      replyStatus: json['reply_status']?.toString(),
      replyUpdatedAt: DateTime.tryParse(
        json['reply_updated_at']?.toString() ?? '',
      ),
    );
  }
}

class ReviewImage {
  final String id;
  final String? imageUrl;

  const ReviewImage({required this.id, this.imageUrl});

  factory ReviewImage.fromJson(Map<String, dynamic> json) {
    return ReviewImage(
      id: json['id']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString(),
    );
  }
}

class FoodReviewResponse {
  final List<FoodReview> items;
  final double averageRating;
  final int totalReviews;
  final int rating5;
  final int rating4;
  final int rating3;
  final int rating2;
  final int rating1;
  final int reviewsWithImages;
  final double imagePercentage;
  final int totalPages;

  const FoodReviewResponse({
    required this.items,
    required this.averageRating,
    required this.totalReviews,
    required this.rating5,
    required this.rating4,
    required this.rating3,
    required this.rating2,
    required this.rating1,
    required this.reviewsWithImages,
    required this.imagePercentage,
    required this.totalPages,
  });

  factory FoodReviewResponse.fromJson(Map<String, dynamic> json) {
    final summary = Map<String, dynamic>.from(json['summary'] ?? {});
    final pagination = Map<String, dynamic>.from(json['pagination'] ?? {});

    int toInt(dynamic value) => (value as num?)?.toInt() ?? 0;
    double toDouble(dynamic value) =>
        double.tryParse(value?.toString() ?? '') ?? 0;

    return FoodReviewResponse(
      items: (json['data'] as List<dynamic>? ?? [])
          .map((item) => FoodReview.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      averageRating: toDouble(summary['average_rating']),
      totalReviews: toInt(summary['total_reviews']),
      rating5: toInt(summary['rating_5']),
      rating4: toInt(summary['rating_4']),
      rating3: toInt(summary['rating_3']),
      rating2: toInt(summary['rating_2']),
      rating1: toInt(summary['rating_1']),
      reviewsWithImages: toInt(summary['reviews_with_images']),
      imagePercentage: toDouble(summary['image_percentage']),
      totalPages: toInt(pagination['totalPages']),
    );
  }
}
