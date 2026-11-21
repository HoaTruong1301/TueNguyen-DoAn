import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/voucher.dart';
import '../services/voucher_service.dart';
import 'voucher_history_page.dart';

class VoucherPage extends StatefulWidget {
  const VoucherPage({super.key});

  @override
  State<VoucherPage> createState() => _VoucherPageState();
}

class _VoucherPageState extends State<VoucherPage> {
  List<Voucher> _vouchers = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadVouchers();
  }

  Future<void> _loadVouchers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await VoucherService.getVouchers();

      if (result['success'] != true) {
        throw Exception('Không thể tải danh sách ưu đãi.');
      }

      final data = result['data'] as List<dynamic>? ?? [];

      final vouchers = data
          .map(
            (item) => Voucher.fromJson(Map<String, dynamic>.from(item as Map)),
          )
          .toList();

      if (!mounted) return;

      setState(() {
        _vouchers = vouchers;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  String _formatCurrency(double value) {
    return '${value.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')}đ';
  }

  String _formatDiscount(Voucher voucher) {
    if (voucher.isPercentage) {
      return 'Giảm ${voucher.discountValue.toStringAsFixed(0)}%';
    }

    return 'Giảm ${_formatCurrency(voucher.discountValue)}';
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Đã sao chép mã ưu đãi'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _openVoucherDetail(Voucher voucher) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => VoucherDetailPage(voucherId: voucher.id),
      ),
    );
  }

  Widget _buildVoucherCard(Voucher voucher) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      elevation: 2,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () => _openVoucherDetail(voucher),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              color: const Color(0xFFFFF3E8),
              child: Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: Colors.deepOrange,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.local_offer,
                      color: Colors.white,
                      size: 34,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _formatDiscount(voucher),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.deepOrange,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          voucher.name,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.grey),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Đơn tối thiểu: ${_formatCurrency(voucher.minOrderAmount)}',
                    style: const TextStyle(fontSize: 13),
                  ),
                  if (voucher.maxDiscountAmount != null) ...[
                    const SizedBox(height: 5),
                    Text(
                      'Giảm tối đa: ${_formatCurrency(voucher.maxDiscountAmount!)}',
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: Text(
                            voucher.code,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      OutlinedButton(
                        onPressed: () => _copyCode(voucher.code),
                        child: const Text('Sao chép'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Hết hạn: ${_formatDate(voucher.endsAt)}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();

    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Ưu đãi & Khuyến mãi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Lịch sử Voucher',
            icon: const Icon(Icons.history_rounded),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const VoucherHistoryPage()),
              );
            },
          ),
        ],
      ),

      backgroundColor: const Color(0xFFF7F7F7),
      body: RefreshIndicator(
        onRefresh: _loadVouchers,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? ListView(
                children: [
                  const SizedBox(height: 140),
                  Center(child: Text(_error!)),
                  Center(
                    child: TextButton(
                      onPressed: _loadVouchers,
                      child: const Text('Thử lại'),
                    ),
                  ),
                ],
              )
            : _vouchers.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 140),
                  Icon(
                    Icons.local_offer_outlined,
                    size: 64,
                    color: Colors.grey,
                  ),
                  SizedBox(height: 16),
                  Center(child: Text('Hiện chưa có ưu đãi nào')),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Ưu đãi dành cho bạn',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  ..._vouchers.map(_buildVoucherCard),
                ],
              ),
      ),
    );
  }
}

class VoucherDetailPage extends StatefulWidget {
  final String voucherId;

  const VoucherDetailPage({super.key, required this.voucherId});

  @override
  State<VoucherDetailPage> createState() => _VoucherDetailPageState();
}

class _VoucherDetailPageState extends State<VoucherDetailPage> {
  Voucher? _voucher;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    try {
      final result = await VoucherService.getVoucherDetail(widget.voucherId);

      if (result['success'] != true || result['data'] == null) {
        throw Exception('Không tìm thấy ưu đãi.');
      }

      final voucher = Voucher.fromJson(
        Map<String, dynamic>.from(result['data'] as Map),
      );

      if (!mounted) return;

      setState(() {
        _voucher = voucher;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  String _formatCurrency(double value) {
    return '${value.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')}đ';
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();

    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year}';
  }

  void _copyCode() {
    final voucher = _voucher;
    if (voucher == null) return;

    Clipboard.setData(ClipboardData(text: voucher.code));

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Đã sao chép mã ưu đãi')));
  }

  @override
  Widget build(BuildContext context) {
    final voucher = _voucher;

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết ưu đãi')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : voucher == null
          ? const Center(child: Text('Không có dữ liệu'))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Icon(
                  Icons.local_offer,
                  size: 72,
                  color: Colors.deepOrange,
                ),
                const SizedBox(height: 16),
                Text(
                  voucher.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Text(voucher.description, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                _detailRow('Mã ưu đãi', voucher.code),
                _detailRow(
                  'Mức giảm',
                  voucher.discountType == 'percentage'
                      ? '${voucher.discountValue.toStringAsFixed(0)}%'
                      : _formatCurrency(voucher.discountValue),
                ),
                if (voucher.maxDiscountAmount != null)
                  _detailRow(
                    'Giảm tối đa',
                    _formatCurrency(voucher.maxDiscountAmount!),
                  ),
                _detailRow(
                  'Đơn hàng tối thiểu',
                  _formatCurrency(voucher.minOrderAmount),
                ),
                _detailRow(
                  'Lượt sử dụng',
                  voucher.usageLimit == null
                      ? 'Không giới hạn'
                      : '${voucher.usedCount}/${voucher.usageLimit}',
                ),
                if (voucher.perUserLimit != null)
                  _detailRow(
                    'Giới hạn mỗi khách',
                    '${voucher.perUserLimit} lượt',
                  ),
                _detailRow('Ngày bắt đầu', _formatDate(voucher.startsAt)),
                _detailRow('Ngày kết thúc', _formatDate(voucher.endsAt)),
                const SizedBox(height: 24),
                if (voucher.categories.isNotEmpty || voucher.foods.isNotEmpty)
                  const Text(
                    'Điều kiện áp dụng theo danh mục hoặc món ăn được chỉ định.',
                    style: TextStyle(color: Colors.grey),
                  )
                else
                  const Text(
                    'Áp dụng theo điều kiện đơn hàng của chương trình.',
                    style: TextStyle(color: Colors.grey),
                  ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _copyCode,
                    icon: const Icon(Icons.copy),
                    label: const Text('Sao chép mã ưu đãi'),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: Colors.grey)),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
