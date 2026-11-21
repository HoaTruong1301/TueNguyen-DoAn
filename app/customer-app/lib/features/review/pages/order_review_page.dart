import 'package:flutter/material.dart';

import '../models/order_review_status.dart';
import '../services/review_service.dart';

class OrderReviewPage extends StatefulWidget {
  final String orderId;

  const OrderReviewPage({super.key, required this.orderId});

  @override
  State<OrderReviewPage> createState() => _OrderReviewPageState();
}

class _OrderReviewPageState extends State<OrderReviewPage> {
  final ReviewService _reviewService = ReviewService();

  final TextEditingController _orderController = TextEditingController();
  final TextEditingController _serviceController = TextEditingController();
  final TextEditingController _deliveryController = TextEditingController();

  OrderReviewStatus? _status;

  int _orderRating = 0;
  int _serviceRating = 0;
  int _deliveryRating = 0;

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _orderController.dispose();
    _serviceController.dispose();
    _deliveryController.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await _reviewService.getOrderReviewStatus(
        orderId: widget.orderId,
      );

      if (!mounted) return;

      final status = OrderReviewStatus.fromJson(data);

      setState(() {
        _status = status;
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

  Future<void> _submit() async {
    final status = _status;

    if (status == null) return;

    if (_orderRating == 0 || _serviceRating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đánh giá đơn hàng và dịch vụ.')),
      );
      return;
    }

    if (status.isDelivery && _deliveryRating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng đánh giá chất lượng giao hàng.'),
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      await _reviewService.createOrderReview(
        orderId: widget.orderId,
        orderRating: _orderRating,
        serviceRating: _serviceRating,
        deliveryRating: status.isDelivery ? _deliveryRating : null,
        orderContent: _orderController.text.trim(),
        serviceContent: _serviceController.text.trim(),
        deliveryContent: status.isDelivery
            ? _deliveryController.text.trim()
            : null,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cảm ơn bạn đã gửi đánh giá!')),
      );

      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));

      setState(() {
        _isSubmitting = false;
      });
    }
  }

  Widget _buildRatingSection({
    required String title,
    required String description,
    required int rating,
    required ValueChanged<int> onChanged,
    required TextEditingController controller,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0E6DE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            description,
            style: const TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const SizedBox(height: 12),
          Row(
            children: List.generate(5, (index) {
              final star = index + 1;

              return IconButton(
                onPressed: _isSubmitting ? null : () => onChanged(star),
                icon: Icon(
                  star <= rating ? Icons.star : Icons.star_border,
                  color: const Color(0xFFFFB400),
                  size: 34,
                ),
              );
            }),
          ),
          if (rating > 0)
            Text(
              '$rating/5 sao',
              style: const TextStyle(
                color: Color(0xFFB77936),
                fontWeight: FontWeight.w600,
              ),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            enabled: !_isSubmitting,
            maxLength: 2000,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Chia sẻ cảm nhận của bạn (không bắt buộc)',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewedView() {
    final status = _status!;

    Widget item(String title, OrderReviewItemStatus review) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Expanded(child: Text(title)),
            const Icon(Icons.star, color: Color(0xFFFFB400), size: 18),
            const SizedBox(width: 4),
            Text('${review.rating ?? 0}/5'),
            const SizedBox(width: 8),
            Text(
              review.status == 'approved'
                  ? 'Đã duyệt'
                  : review.status == 'rejected'
                  ? 'Từ chối'
                  : 'Chờ duyệt',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 48),
          const SizedBox(height: 12),
          const Text(
            'Bạn đã gửi đánh giá cho đơn hàng này',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          item('Đánh giá đơn hàng', status.order),
          item('Đánh giá dịch vụ', status.service),
          if (status.isDelivery) item('Đánh giá giao hàng', status.delivery),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final alreadyReviewed = _status?.hasReviewedAll ?? false;

    return Scaffold(
      backgroundColor: const Color(0xFFFFF9F4),
      appBar: AppBar(
        title: const Text('Đánh giá đơn hàng'),
        backgroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadStatus,
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            )
          : alreadyReviewed
          ? SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _buildReviewedView(),
            )
          : _status == null
          ? const Center(child: Text('Không tải được thông tin đánh giá.'))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Chia sẻ trải nghiệm của bạn',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Đánh giá của bạn giúp Tuệ Nguyên cải thiện chất lượng phục vụ.',
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 20),
                  _buildRatingSection(
                    title: 'Đánh giá đơn hàng',
                    description: 'Chất lượng món ăn và trải nghiệm đơn hàng',
                    rating: _orderRating,
                    onChanged: (value) {
                      setState(() => _orderRating = value);
                    },
                    controller: _orderController,
                  ),
                  _buildRatingSection(
                    title: 'Đánh giá dịch vụ nhà hàng',
                    description: 'Thái độ phục vụ và chất lượng dịch vụ',
                    rating: _serviceRating,
                    onChanged: (value) {
                      setState(() => _serviceRating = value);
                    },
                    controller: _serviceController,
                  ),
                  if (_status!.isDelivery)
                    _buildRatingSection(
                      title: 'Đánh giá giao hàng',
                      description:
                          'Tốc độ giao hàng và thái độ nhân viên giao hàng',
                      rating: _deliveryRating,
                      onChanged: (value) {
                        setState(() => _deliveryRating = value);
                      },
                      controller: _deliveryController,
                    ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFB77936),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Text(
                              'Gửi đánh giá',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }
}
