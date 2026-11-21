
import '../core/config/api_config.dart';

class FoodOption {
  final String id;
  final String group;
  final String name;
  final int priceAdjustment;
  final bool isDefault;
  final bool isAvailable;

  const FoodOption({
    required this.id,
    required this.group,
    required this.name,
    required this.priceAdjustment,
    required this.isDefault,
    this.isAvailable = true,
  });

  factory FoodOption.fromJson(Map<String, dynamic> json) {
    return FoodOption(
      id: json['id'].toString(),
      group: json['option_group']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      priceAdjustment:
      double.tryParse(json['price_adjustment']?.toString() ?? '0')
          ?.round() ??
          0,
      isDefault: json['is_default'] == true,
      isAvailable: json['is_available'] != false,
    );
  }
}

class FoodOptionGroup {
  final String id;
  final String name;
  final String selectionType;
  final bool isRequired;
  final int minSelect;
  final int? maxSelect;
  final int sortOrder;
  final List<FoodOption> options;

  const FoodOptionGroup({
    required this.id,
    required this.name,
    required this.selectionType,
    required this.isRequired,
    required this.minSelect,
    required this.maxSelect,
    required this.sortOrder,
    required this.options,
  });

  factory FoodOptionGroup.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'] as List? ?? [];

    return FoodOptionGroup(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      selectionType:
      json['selection_type']?.toString() ?? 'multiple',
      isRequired: json['is_required'] == true,
      minSelect: int.tryParse(
        json['min_select']?.toString() ?? '0',
      ) ??
          0,
      maxSelect: json['max_select'] == null
          ? null
          : int.tryParse(json['max_select'].toString()),
      sortOrder:
      int.tryParse(json['sort_order']?.toString() ?? '0') ?? 0,
      options: rawOptions
          .whereType<Map>()
          .map(
            (item) => FoodOption.fromJson(
          Map<String, dynamic>.from(item),
        ),
      )
          .toList(),
    );
  }
}

class Food {
  final String id;
  final String name;
  final String description;
  final int price;
  final String emoji;
  final String category;
  final String? imageUrl;

  const Food({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.emoji,
    required this.category,
    this.imageUrl,
  });

  factory Food.fromJson(Map<String, dynamic> json) {
    final category = json['category_name']?.toString() ?? 'Khác';
    final salePrice = json['sale_price'];
    final rawPrice = salePrice ?? json['price'] ?? 0;
    final rawImage = json['image_url']?.toString();

    final imageUrl = rawImage == null || rawImage.isEmpty
        ? null
        : (rawImage.startsWith('http://') ||
        rawImage.startsWith('https://')
        ? rawImage
        : '${ApiConfig.baseUrl}${rawImage.startsWith('/') ? '' : '/'}$rawImage');

    return Food(
      id: json['id'].toString(),
      name: json['name']?.toString() ?? 'Món ăn',
      description: json['description']?.toString() ?? '',
      price: double.tryParse(rawPrice.toString())?.round() ?? 0,
      category: category,
      imageUrl: imageUrl,
      emoji: '🍽️',
    );
  }
}
