import 'package:flutter/material.dart';

import '../models/delivery.dart';
import '../services/delivery_service.dart';
import 'delivery_detail_page.dart';

class DeliveryHistoryPage extends StatefulWidget {
  const DeliveryHistoryPage({super.key});

  @override
  State<DeliveryHistoryPage> createState() =>
      _DeliveryHistoryPageState();
}

class _DeliveryHistoryPageState extends State<DeliveryHistoryPage> {
  final DeliveryService _deliveryService = DeliveryService();

  List<Delivery> _deliveries = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDeliveries();
  }

  Future<void> _loadDeliveries() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await _deliveryService.getMyDeliveryOrders();

      if (!mounted) return;

      setState(() {
        _deliveries = data.map(Delivery.fromJson).toList();
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  String _formatPrice(double price) {
    return '${price.toStringAsFixed(0).replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
          (match) => '.',
    )} đ';
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'delivered':
        return Colors.green;
      case 'cancelled':
      case 'failed':
        return Colors.red;
      case 'picked_up':
      case 'out_for_delivery':
        return Colors.orange;
      case 'assigned':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Chưa cập nhật';

    final local = date.toLocal();

    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lịch sử giao hàng'),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadDeliveries,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    if (_deliveries.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadDeliveries,
        child: ListView(
          children: const [
            SizedBox(height: 180),
            Icon(
              Icons.local_shipping_outlined,
              size: 64,
              color: Colors.grey,
            ),
            SizedBox(height: 16),
            Center(
              child: Text('Bạn chưa có đơn giao hàng nào'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDeliveries,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _deliveries.length,
        separatorBuilder: (_, _) =>
        const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final delivery = _deliveries[index];
          final color = _statusColor(delivery.status);

          return Card(
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              title: Text(
                'Đơn hàng: ${delivery.orderId}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                ),
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Người nhận: ${delivery.recipientName}',
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Số điện thoại: ${delivery.recipientPhone}',
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Ngày tạo: ${_formatDate(delivery.createdAt)}',
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Phí giao hàng: ${_formatPrice(delivery.deliveryFee)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      delivery.statusLabel,
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                _showDeliveryDetail(delivery);
              },
            ),
          );
        },
      ),
    );
  }

  void _showDeliveryDetail(Delivery delivery) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DeliveryDetailPage(
          orderId: delivery.orderId,
        ),
      ),
    );

    if (!mounted) return;

    await _loadDeliveries();
  }
}