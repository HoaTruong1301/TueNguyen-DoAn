class Voucher {
  final String id;
  final String code;
  final String name;
  final String description;
  final String discountType;
  final double discountValue;
  final double? maxDiscountAmount;
  final double minOrderAmount;
  final int? usageLimit;
  final int usedCount;
  final int? perUserLimit;
  final DateTime startsAt;
  final DateTime endsAt;
  final List<String> categories;
  final List<String> foods;

  const Voucher({
    required this.id,
    required this.code,
    required this.name,
    required this.description,
    required this.discountType,
    required this.discountValue,
    this.maxDiscountAmount,
    required this.minOrderAmount,
    this.usageLimit,
    required this.usedCount,
    this.perUserLimit,
    required this.startsAt,
    required this.endsAt,
    this.categories = const [],
    this.foods = const [],
  });

  factory Voucher.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic value) {
      if (value == null) return 0;
      return double.tryParse(value.toString()) ?? 0;
    }

    int? toNullableInt(dynamic value) {
      if (value == null) return null;
      return int.tryParse(value.toString());
    }

    return Voucher(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      discountType: json['discount_type']?.toString() ?? '',
      discountValue: toDouble(json['discount_value']),
      maxDiscountAmount: json['max_discount_amount'] == null
          ? null
          : toDouble(json['max_discount_amount']),
      minOrderAmount: toDouble(json['min_order_amount']),
      usageLimit: toNullableInt(json['usage_limit']),
      usedCount: toNullableInt(json['used_count']) ?? 0,
      perUserLimit: toNullableInt(json['per_user_limit']),
      startsAt:
          DateTime.tryParse(json['starts_at']?.toString() ?? '') ??
          DateTime.now(),
      endsAt:
          DateTime.tryParse(json['ends_at']?.toString() ?? '') ??
          DateTime.now(),
      categories:
          (json['categories'] as List<dynamic>?)
              ?.map((item) {
                if (item is Map<String, dynamic>) {
                  return item['category_id']?.toString() ?? '';
                }
                return item.toString();
              })
              .where((id) => id.isNotEmpty)
              .toList() ??
          const [],
      foods:
          (json['foods'] as List<dynamic>?)
              ?.map((item) {
                if (item is Map<String, dynamic>) {
                  return item['food_id']?.toString() ?? '';
                }
                return item.toString();
              })
              .where((id) => id.isNotEmpty)
              .toList() ??
          const [],
    );
  }

  bool get isPercentage => discountType == 'percentage';

  bool get isUnlimited => usageLimit == null;

  int get remainingUses {
    if (usageLimit == null) return -1;
    return (usageLimit! - usedCount).clamp(0, usageLimit!);
  }
}
