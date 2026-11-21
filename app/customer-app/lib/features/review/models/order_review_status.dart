class OrderReviewItemStatus {
  final bool hasReviewed;
  final int? rating;
  final String? status;
  final DateTime? createdAt;

  const OrderReviewItemStatus({
    required this.hasReviewed,
    this.rating,
    this.status,
    this.createdAt,
  });

  factory OrderReviewItemStatus.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const OrderReviewItemStatus(hasReviewed: false);
    }

    final review = json['review'] as Map<String, dynamic>?;

    return OrderReviewItemStatus(
      hasReviewed: json['hasReviewed'] == true,
      rating: (review?['rating'] as num?)?.toInt(),
      status: review?['status']?.toString(),
      createdAt: review?['created_at'] != null
          ? DateTime.tryParse(review!['created_at'].toString())
          : null,
    );
  }
}

class OrderReviewStatus {
  final String orderType;
  final OrderReviewItemStatus order;
  final OrderReviewItemStatus service;
  final OrderReviewItemStatus delivery;

  const OrderReviewStatus({
    required this.orderType,
    required this.order,
    required this.service,
    required this.delivery,
  });

  bool get isDelivery => orderType == 'delivery';

  bool get hasReviewedAll =>
      order.hasReviewed &&
      service.hasReviewed &&
      (!isDelivery || delivery.hasReviewed);

  factory OrderReviewStatus.fromJson(Map<String, dynamic> json) {
    final reviews = Map<String, dynamic>.from(json['reviews'] ?? {});

    return OrderReviewStatus(
      orderType: json['orderType']?.toString() ?? '',
      order: OrderReviewItemStatus.fromJson(
        reviews['order'] == null
            ? null
            : Map<String, dynamic>.from(reviews['order']),
      ),
      service: OrderReviewItemStatus.fromJson(
        reviews['service'] == null
            ? null
            : Map<String, dynamic>.from(reviews['service']),
      ),
      delivery: OrderReviewItemStatus.fromJson(
        reviews['delivery'] == null
            ? null
            : Map<String, dynamic>.from(reviews['delivery']),
      ),
    );
  }
}
