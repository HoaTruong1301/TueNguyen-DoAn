import 'package:flutter/material.dart';

import '../models/voucher_history.dart';
import '../services/voucher_history_service.dart';

class VoucherHistoryPage extends StatefulWidget {
  const VoucherHistoryPage({super.key});

  @override
  State<VoucherHistoryPage> createState() => _VoucherHistoryPageState();
}

class _VoucherHistoryPageState extends State<VoucherHistoryPage> {
  final VoucherHistoryService _service = VoucherHistoryService();
  final List<VoucherHistory> _items = [];

  bool _isLoading = true;
  bool _isLoadingMore = false;
  String? _error;

  int _page = 1;
  int _totalPages = 1;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory({bool refresh = false}) async {
    if (_isLoadingMore) return;

    if (refresh) {
      _page = 1;
      _totalPages = 1;
      _items.clear();
    }

    setState(() {
      _isLoading = !refresh && _items.isEmpty;
      _isLoadingMore = refresh;
      _error = null;
    });

    try {
      final result = await _service.getMyVoucherHistory(page: 1, limit: 20);

      if (!mounted) return;

      final pagination = result['pagination'] as Map<String, dynamic>;

      setState(() {
        _items
          ..clear()
          ..addAll(result['items'] as List<VoucherHistory>);

        _page = (pagination['page'] as num?)?.toInt() ?? 1;
        _totalPages = (pagination['totalPages'] as num?)?.toInt() ?? 1;
        _total = (pagination['total'] as num?)?.toInt() ?? 0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isLoadingMore = false;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || _page >= _totalPages) return;

    setState(() => _isLoadingMore = true);

    try {
      final result = await _service.getMyVoucherHistory(
        page: _page + 1,
        limit: 20,
      );

      if (!mounted) return;

      final pagination = result['pagination'] as Map<String, dynamic>;

      setState(() {
        _items.addAll(result['items'] as List<VoucherHistory>);
        _page = (pagination['page'] as num?)?.toInt() ?? _page + 1;
        _totalPages =
            (pagination['totalPages'] as num?)?.toInt() ?? _totalPages;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoadingMore = false);
      }
    }
  }

  String _formatMoney(double value) {
    final amount = value.round().toString();
    final buffer = StringBuffer();

    for (int i = 0; i < amount.length; i++) {
      buffer.write(amount[i]);
      final remaining = amount.length - i - 1;
      if (remaining > 0 && remaining % 3 == 0) {
        buffer.write('.');
      }
    }

    return '${buffer.toString()} đ';
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Không rõ thời gian';

    final local = date.toLocal();
    String two(int value) => value.toString().padLeft(2, '0');

    return '${two(local.day)}/${two(local.month)}/${local.year} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  Widget _buildHistoryCard(VoucherHistory item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0E6DE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1E8),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.local_offer_rounded,
                  color: Color(0xFFE87532),
                  size: 25,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.voucherName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.voucherCode,
                      style: const TextStyle(
                        color: Color(0xFFE87532),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Đã tiết kiệm', style: TextStyle(color: Colors.grey)),
              Text(
                _formatMoney(item.discountAmount),
                style: const TextStyle(
                  color: Colors.green,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Mã đơn hàng', style: TextStyle(color: Colors.grey)),
              Flexible(
                child: Text(
                  item.orderCode ?? 'Không có',
                  textAlign: TextAlign.end,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Thời gian sử dụng',
                style: TextStyle(color: Colors.grey),
              ),
              Text(
                _formatDate(item.usedAt),
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFAF6),
      appBar: AppBar(
        title: const Text(
          'Lịch sử Voucher',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF3D3028),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _items.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => _loadHistory(refresh: true),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () => _loadHistory(refresh: true),
              child: _items.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 140),
                        Icon(
                          Icons.confirmation_number_outlined,
                          size: 64,
                          color: Colors.grey,
                        ),
                        SizedBox(height: 16),
                        Center(
                          child: Text(
                            'Bạn chưa sử dụng Voucher nào',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      ],
                    )
                  : ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      children: [
                        Text(
                          'Bạn đã sử dụng $_total Voucher',
                          style: const TextStyle(
                            fontSize: 14,
                            color: Colors.grey,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 14),
                        ..._items.map(_buildHistoryCard),
                        if (_page < _totalPages)
                          Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: OutlinedButton(
                                onPressed: _isLoadingMore ? null : _loadMore,
                                child: _isLoadingMore
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Text('Tải thêm'),
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
    );
  }
}
