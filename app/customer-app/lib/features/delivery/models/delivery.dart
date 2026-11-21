class Delivery {
  final String id;
  final String orderId;
  final String recipientName;
  final String recipientPhone;
  final Map<String, dynamic> addressSnapshot;
  final String status;
  final String? driverName;
  final String? driverPhone;
  final double deliveryFee;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Delivery({
    required this.id,
    required this.orderId,
    required this.recipientName,
    required this.recipientPhone,
    required this.addressSnapshot,
    required this.status,
    this.driverName,
    this.driverPhone,
    required this.deliveryFee,
    this.createdAt,
    this.updatedAt,
  });

  factory Delivery.fromJson(Map<String, dynamic> json) {
    return Delivery(
      id: (json['id'] ?? '').toString(),
      orderId: (json['order_id'] ?? '').toString(),
      recipientName: (json['recipient_name'] ?? '').toString(),
      recipientPhone: (json['recipient_phone'] ?? '').toString(),
      addressSnapshot: json['address_snapshot'] is Map
          ? Map<String, dynamic>.from(json['address_snapshot'])
          : {},
      status: (json['status'] ?? 'pending').toString(),
      driverName: json['driver_name']?.toString(),
      driverPhone: json['driver_phone']?.toString(),
      deliveryFee: double.tryParse(
        (json['delivery_fee'] ?? 0).toString(),
      ) ??
          0,
      createdAt: DateTime.tryParse(
        (json['created_at'] ?? '').toString(),
      ),
      updatedAt: DateTime.tryParse(
        (json['updated_at'] ?? '').toString(),
      ),
    );
  }

  String get statusLabel {
    switch (status) {
      case 'pending':
        return 'Chờ phân công';
      case 'assigned':
        return 'Đã phân công người giao';
      case 'picked_up':
        return 'Đã lấy hàng';
      case 'out_for_delivery':
        return 'Đang giao hàng';
      case 'delivered':
        return 'Đã giao hàng';
      case 'failed':
        return 'Giao hàng thất bại';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return 'Không xác định';
    }
  }
}
