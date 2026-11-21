import 'package:flutter/material.dart';

import '../services/order_service.dart';
import '../../review/pages/order_review_page.dart';
import '../../review/services/review_service.dart';
import '../../review/models/order_review_status.dart';

class OrderDetailPage extends StatefulWidget {
  final String orderId;

  const OrderDetailPage({super.key, required this.orderId});

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  final OrderService _orderService = OrderService();
  final ReviewService _reviewService = ReviewService();

  OrderReviewStatus? _orderReviewStatus;
  bool _isCheckingOrderReview = false;

  Map<String, dynamic>? _order;
  bool _isLoading = true;
  bool _isCancelling = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _checkOrderReviewStatus() async {
    if (_isCheckingOrderReview) return;

    setState(() {
      _isCheckingOrderReview = true;
    });

    try {
      final data = await _reviewService.getOrderReviewStatus(
        orderId: widget.orderId,
      );

      if (!mounted) return;

      setState(() {
        _orderReviewStatus = OrderReviewStatus.fromJson(data);
        _isCheckingOrderReview = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isCheckingOrderReview = false;
      });
    }
  }

  Future<void> _loadDetail() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await _orderService.getOrderDetail(widget.orderId);

      if (!mounted) return;

      setState(() {
        _order = data;
        _isLoading = false;
      });

      final status = data['status']?.toString().toLowerCase() ?? '';

      if (['completed', 'delivered'].contains(status)) {
        await _checkOrderReviewStatus();
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  String _price(dynamic value) {
    final number = double.tryParse(value?.toString() ?? '0') ?? 0;

    return '${number.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')} đ';
  }

  String _statusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Chờ xác nhận';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'preparing':
        return 'Đang chuẩn bị';
      case 'ready':
        return 'Đã chuẩn bị xong';
      case 'assigned':
        return 'Đã phân công người giao';
      case 'picked_up':
        return 'Người giao đã nhận món';
      case 'out_for_delivery':
        return 'Đang giao hàng';
      case 'delivered':
      case 'completed':
        return 'Đã giao thành công';
      case 'failed':
        return 'Giao hàng thất bại';
      case 'cancelled':
        return 'Đã hủy';
      case 'rejected':
        return 'Bị từ chối';
      default:
        return status;
    }
  }

  String _paymentMethodLabel(String method) {
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Tiền mặt khi nhận hàng';
      case 'card':
        return 'Thẻ ngân hàng';
      case 'bank_transfer':
        return 'Chuyển khoản ngân hàng';
      case 'e_wallet':
        return 'Ví điện tử';
      default:
        return method.isEmpty ? 'Chưa có thông tin' : method;
    }
  }

  String _paymentStatusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'unpaid':
        return 'Chưa thanh toán';
      case 'pending':
        return 'Đang chờ thanh toán';
      case 'paid':
        return 'Đã thanh toán';
      case 'failed':
        return 'Thanh toán thất bại';
      case 'refunded':
        return 'Đã hoàn tiền';
      default:
        return status.isEmpty ? 'Chưa có thông tin' : status;
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
        return Colors.green;
      case 'cancelled':
      case 'rejected':
        return Colors.red;
      case 'preparing':
      case 'delivering':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }

  Future<void> _confirmCancelOrder() async {
    FocusScope.of(context).unfocus();

    final String? reason = await showDialog<String>(
      context: context,
      useRootNavigator: false,
      builder: (ctx) => const _CancelOrderDialog(),
    );

    if (reason == null || !mounted) return;

    setState(() => _isCancelling = true);

    try {
      await _orderService.cancelOrder(
        orderId: widget.orderId,
        reason: reason.isEmpty ? null : reason,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi yêu cầu hủy đơn hàng.')),
      );

      await _loadDetail();
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Hủy đơn thất bại: ${e.toString().replaceFirst('Exception: ', '')}',
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isCancelling = false);
      }
    }
  }

  Widget _buildStatusHistory(List<dynamic> history) {
    if (history.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('Chưa có lịch sử cập nhật trạng thái.'),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tiến trình đơn hàng',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ...history.map((item) {
              final status = item['new_status']?.toString() ?? '';
              final note = item['note']?.toString() ?? '';
              final rawDate = item['created_at']?.toString() ?? '';

              final date = DateTime.tryParse(rawDate);

              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.check_circle,
                      color: Colors.green,
                      size: 22,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _statusLabel(status),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          if (note.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(note),
                          ],
                          if (date != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              date.toLocal().toString().substring(0, 16),
                              style: const TextStyle(
                                color: Colors.grey,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết đơn hàng'), centerTitle: true),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(_error!, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadDetail,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    final order = _order!;
    final items = order['items'] is List ? order['items'] as List : [];

    final status = order['status']?.toString() ?? '';

    final address = order['delivery_address_snapshot'] is Map
        ? Map<String, dynamic>.from(order['delivery_address_snapshot'])
        : <String, dynamic>{};

    final payments = order['payments'] is List
        ? order['payments'] as List
        : [];

    final payment = payments.isNotEmpty && payments.first is Map
        ? Map<String, dynamic>.from(payments.first)
        : <String, dynamic>{};

    final addressParts = [
      address['addressLine'],
      address['ward'],
      address['district'],
      address['province'],
    ].where((value) => value != null && value.toString().trim().isNotEmpty);

    final fullAddress = addressParts.join(', ');

    final canReview = ['completed', 'delivered'].contains(status.toLowerCase());

    return RefreshIndicator(
      onRefresh: _loadDetail,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFF0E6DE)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mã đơn: ${order['order_code'] ?? ''}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Text('Trạng thái: '),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: _statusColor(status).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _statusLabel(status),
                          style: TextStyle(
                            color: _statusColor(status),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Khách hàng: ${order['customer_name'] ?? ''}'),
                  const SizedBox(height: 8),
                  Text('Loại đơn: ${order['order_type'] ?? ''}'),
                  const SizedBox(height: 8),
                  Text('Ngày đặt: ${order['created_at'] ?? ''}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _buildStatusHistory(
            order['statusHistory'] is List
                ? order['statusHistory'] as List
                : [],
          ),
          const SizedBox(height: 16),

// THÔNG TIN GIAO HÀNG
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.location_on, color: Colors.red),
                      SizedBox(width: 8),
                      Text(
                        'Thông tin giao hàng',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('Người nhận: ${address['recipientName'] ?? order['customer_name'] ?? 'Chưa có'}'),
                  const SizedBox(height: 6),
                  Text('Số điện thoại: ${address['phone'] ?? 'Chưa có'}'),
                  const SizedBox(height: 6),
                  Text(
                    'Địa chỉ: ${fullAddress.isNotEmpty ? fullAddress : 'Chưa có thông tin'}',
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

// THÔNG TIN THANH TOÁN
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.payment, color: Colors.green),
                      SizedBox(width: 8),
                      Text(
                        'Thông tin thanh toán',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Phương thức: ${_paymentMethodLabel(payment['payment_method']?.toString() ?? '')}',
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Trạng thái: ${_paymentStatusLabel(payment['payment_status']?.toString() ?? '')}',
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Số tiền: ${payment['amount'] ?? 0} ${payment['currency'] ?? 'VND'}',
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),
          const Text(
            'Các món đã đặt',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Không có thông tin món ăn.'),
              ),
            )
          else
            ...items.map((item) {
              final name = item['food_name_snapshot'] ?? 'Món ăn';
              final quantity = item['quantity'] ?? 0;
              final price = item['unit_price'];
              final total = item['line_total'];
              final note = item['note']?.toString() ?? '';

              final options = item['options'] is List
                  ? item['options'] as List
                  : [];

              return Card(
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFF0E6DE)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              name.toString(),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          Text(
                            _price(total),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('${_price(price)} × $quantity'),

                      if (options.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        const Text(
                          'Tùy chọn:',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        ...options.map((option) {
                          final group = option['group']?.toString() ?? '';
                          final optionName = option['name']?.toString() ?? '';
                          final optionQuantity = option['quantity'] ?? 1;
                          final adjustment = option['priceAdjustment'] ?? 0;

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              '• $group: $optionName × $optionQuantity '
                                  '(+${_price(adjustment)})',
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 13,
                              ),
                            ),
                          );
                        }),
                      ],

                      if (note.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Ghi chú: $note',
                          style: const TextStyle(
                            color: Colors.black54,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          if (canReview) ...[
            const SizedBox(height: 16),
            _buildOrderReviewCard(),
          ],

          const SizedBox(height: 16),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFF0E6DE)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _summaryRow('Tạm tính', order['subtotal']),
                  const SizedBox(height: 12),

                  if ((double.tryParse(
                            order['discount_total']?.toString() ?? '0',
                          ) ??
                          0) >
                      0) ...[
                    _summaryRow(
                      'Giảm giá Voucher',
                      -(double.tryParse(
                            order['discount_total']?.toString() ?? '0',
                          ) ??
                          0),
                    ),
                    if ((order['voucher_code']?.toString() ?? '')
                        .isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Mã Voucher',
                            style: TextStyle(color: Colors.grey),
                          ),
                          Text(
                            order['voucher_code'].toString(),
                            style: const TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 12),
                  ],

                  _summaryRow('Phí giao hàng', order['delivery_fee']),
                  const SizedBox(height: 12),
                  const Divider(color: Color(0xFFF0E6DE)),
                  _summaryRow(
                    'Tổng thanh toán',
                    order['grand_total'],
                    isBold: true,
                  ),
                ],
              ),
            ),
          ),
          if (status.toLowerCase() == 'pending')
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isCancelling ? null : _confirmCancelOrder,
                  icon: _isCancelling
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.red,
                          ),
                        )
                      : const Icon(Icons.cancel_outlined),
                  label: Text(_isCancelling ? 'Đang xử lý...' : 'Hủy đơn hàng'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildOrderReviewCard() {
    final reviewStatus = _orderReviewStatus;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFF0E6DE)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Đánh giá trải nghiệm',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Hãy chia sẻ cảm nhận của bạn về đơn hàng, '
              'dịch vụ nhà hàng và giao hàng.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 12),
            if (_isCheckingOrderReview)
              const Center(child: CircularProgressIndicator())
            else if (reviewStatus == null)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _checkOrderReviewStatus,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Kiểm tra trạng thái đánh giá'),
                ),
              )
            else if (reviewStatus.hasReviewedAll)
              const Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.green),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Bạn đã gửi đánh giá cho đơn hàng này.',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              )
            else
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final submitted = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            OrderReviewPage(orderId: widget.orderId),
                      ),
                    );

                    if (submitted == true && mounted) {
                      await _checkOrderReviewStatus();
                    }
                  },
                  icon: const Icon(Icons.star_outline),
                  label: const Text('Đánh giá đơn hàng'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFB77936),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _summaryRow(String label, dynamic value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        Text(
          _price(value),
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            color: isBold ? const Color(0xFF8B3A25) : null,
          ),
        ),
      ],
    );
  }
}

class _CancelOrderDialog extends StatefulWidget {
  const _CancelOrderDialog();

  @override
  State<_CancelOrderDialog> createState() => _CancelOrderDialogState();
}

class _CancelOrderDialogState extends State<_CancelOrderDialog> {
  final _reasonController = TextEditingController();

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Hủy đơn hàng'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Bạn có chắc chắn muốn hủy đơn hàng này?'),
          const SizedBox(height: 16),
          TextField(
            controller: _reasonController,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Lý do hủy đơn',
              hintText: 'Nhập lý do hủy...',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Quay lại'),
        ),
        FilledButton(
          onPressed: () {
            final reason = _reasonController.text.trim();
            Navigator.pop(context, reason);
          },
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('Xác nhận hủy'),
        ),
      ],
    );
  }
}
