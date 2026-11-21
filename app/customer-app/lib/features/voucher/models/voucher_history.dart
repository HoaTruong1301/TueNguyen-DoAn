class VoucherHistory {
  final String id;
  final String voucherId;
  final String voucherCode;
  final String voucherName;
  final String discountType;
  final double discountValue;
  final String? orderId;
  final String? orderCode;
  final double discountAmount;
  final DateTime? usedAt;

  const VoucherHistory({
    required this.id,
    required this.voucherId,
    required this.voucherCode,
    required this.voucherName,
    required this.discountType,
    required this.discountValue,
    this.orderId,
    this.orderCode,
    required this.discountAmount,
    this.usedAt,
  });

  factory VoucherHistory.fromJson(Map<String, dynamic> json) {
    return VoucherHistory(
      id: json['id']?.toString() ?? '',
      voucherId: json['voucher_id']?.toString() ?? '',
      voucherCode: json['voucher_code']?.toString() ?? '',
      voucherName: json['voucher_name']?.toString() ?? '',
      discountType: json['discount_type']?.toString() ?? '',
      discountValue:
          double.tryParse(json['discount_value']?.toString() ?? '') ?? 0,
      orderId: json['order_id']?.toString(),
      orderCode: json['order_code']?.toString(),
      discountAmount:
          double.tryParse(json['discount_amount']?.toString() ?? '') ?? 0,
      usedAt: json['used_at'] != null
          ? DateTime.tryParse(json['used_at'].toString())
          : null,
    );
  }
}
