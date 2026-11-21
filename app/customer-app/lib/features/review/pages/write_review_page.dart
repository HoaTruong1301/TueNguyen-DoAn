import 'package:flutter/material.dart';

import '../services/review_service.dart';

class WriteReviewPage extends StatefulWidget {
  final String orderId;
  final String foodId;
  final String foodName;

  const WriteReviewPage({
    super.key,
    required this.orderId,
    required this.foodId,
    required this.foodName,
  });

  @override
  State<WriteReviewPage> createState() => _WriteReviewPageState();
}

class _WriteReviewPageState extends State<WriteReviewPage> {
  final ReviewService _reviewService = ReviewService();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _contentController = TextEditingController();

  int _rating = 5;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _submitReview() async {
    if (_contentController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập nội dung đánh giá.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await _reviewService.createFoodReview(
        orderId: widget.orderId,
        foodId: widget.foodId,
        rating: _rating,
        title: _titleController.text.trim(),
        content: _contentController.text.trim(),
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đánh giá đã được gửi và đang chờ duyệt.'),
        ),
      );

      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;

      final errorMessage = e.toString().replaceFirst('Exception: ', '');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          width: MediaQuery.of(context).size.width - 32,
          content: Text(
            errorMessage.length > 150
                ? '${errorMessage.substring(0, 150)}...'
                : errorMessage,
            softWrap: true,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đánh giá món ăn'), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            widget.foodName,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 24),
          const Center(
            child: Text(
              'Bạn cảm thấy món ăn thế nào?',
              style: TextStyle(fontSize: 16),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (index) {
              final selected = index < _rating;

              return IconButton(
                onPressed: () {
                  setState(() => _rating = index + 1);
                },
                icon: Icon(
                  selected ? Icons.star : Icons.star_border,
                  color: Colors.orange,
                  size: 38,
                ),
              );
            }),
          ),
          Center(
            child: Text(
              '$_rating/5 sao',
              style: const TextStyle(
                color: Colors.orange,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(height: 28),
          TextField(
            controller: _titleController,
            maxLength: 150,
            decoration: const InputDecoration(
              labelText: 'Tiêu đề đánh giá',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contentController,
            maxLines: 5,
            maxLength: 2000,
            decoration: const InputDecoration(
              labelText: 'Chia sẻ trải nghiệm của bạn',
              hintText: 'Hương vị, chất lượng, cách phục vụ...',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submitReview,
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Gửi đánh giá'),
            ),
          ),
        ],
      ),
    );
  }
}
