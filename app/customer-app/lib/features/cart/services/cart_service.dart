
import '../../../models/food.dart';

class CartItem {
  final Food food;
  int quantity;
  final List<FoodOption> options;
  String note;

  CartItem({
    required this.food,
    this.quantity = 1,
    List<FoodOption>? options,
    this.note = '',
  }) : options = List.unmodifiable(options ?? []);

  int get unitPrice {
    return food.price +
        options.fold<int>(
          0,
              (sum, option) => sum + option.priceAdjustment,
        );
  }

  int get totalPrice => unitPrice * quantity;
}

class CartService {
  final List<CartItem> _items = [];

  List<CartItem> get cartItems => List.unmodifiable(_items);

  Map<String, int> get items {
    final result = <String, int>{};

    for (final item in _items) {
      result[item.food.name] =
          (result[item.food.name] ?? 0) + item.quantity;
    }

    return Map.unmodifiable(result);
  }

  bool get isEmpty => _items.isEmpty;

  int get totalQuantity =>
      _items.fold(0, (sum, item) => sum + item.quantity);

  int quantityOf(String foodName) {
    return _items
        .where((item) => item.food.name == foodName)
        .fold(0, (sum, item) => sum + item.quantity);
  }

  void add(
      Food food, {
        List<FoodOption> options = const [],
        String note = '',
      }) {
    final sortedIds = options.map((e) => e.id).toList()..sort();

    final existingIndex = _items.indexWhere((item) {
      final existingIds = item.options.map((e) => e.id).toList()..sort();

      return item.food.id == food.id &&
          existingIds.join(',') == sortedIds.join(',') &&
          item.note == note;
    });

    if (existingIndex >= 0) {
      _items[existingIndex].quantity++;
    } else {
      _items.add(
        CartItem(
          food: food,
          options: options,
          note: note,
        ),
      );
    }
  }

  void increaseItem(CartItem item) {
    final index = _items.indexOf(item);
    if (index < 0) return;

    _items[index].quantity++;
  }

  void decreaseItem(CartItem item) {
    final index = _items.indexOf(item);
    if (index < 0) return;

    if (_items[index].quantity <= 1) {
      _items.removeAt(index);
    } else {
      _items[index].quantity--;
    }
  }

  void removeItem(CartItem item) {
    _items.remove(item);
  }

  void decrease(String foodName) {
    final index = _items.lastIndexWhere(
          (item) => item.food.name == foodName,
    );

    if (index < 0) return;

    decreaseItem(_items[index]);
  }

  void remove(String foodName) {
    _items.removeWhere((item) => item.food.name == foodName);
  }

  void clear() {
    _items.clear();
  }

  int totalPrice(List<Food> foods) {
    return _items.fold(0, (sum, item) => sum + item.totalPrice);
  }

  List<Food> getCartFoods(List<Food> foods) {
    return _items.map((item) => item.food).toSet().toList();
  }
}
