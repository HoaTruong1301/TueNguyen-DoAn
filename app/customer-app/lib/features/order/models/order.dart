class Order {
  final String id;
  final String orderCode;
  final String orderType;
  final String customerName;
  final double subtotal;
  final double grandTotal;
  final String status;
  final DateTime createdAt;

  const Order({
    required this.id,
    required this.orderCode,
    required this.orderType,
    required this.customerName,
    required this.subtotal,
    required this.grandTotal,
    required this.status,
    required this.createdAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id']?.toString() ?? '',
      orderCode: json['order_code']?.toString() ?? '',
      orderType: json['order_type']?.toString() ?? '',
      customerName: json['customer_name']?.toString() ?? '',
      subtotal: double.tryParse(
        json['subtotal']?.toString() ?? '0',
      ) ??
          0,
      grandTotal: double.tryParse(
        json['grand_total']?.toString() ?? '0',
      ) ??
          0,
      status: json['status']?.toString() ?? '',
      createdAt: DateTime.tryParse(
        json['created_at']?.toString() ?? '',
      ) ??
          DateTime.now(),
    );
  }
}