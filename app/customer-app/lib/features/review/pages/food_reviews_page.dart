import 'package:flutter/material.dart';

import '../models/food_review.dart';
import '../services/review_service.dart';

class FoodReviewsPage extends StatefulWidget {
  final String foodId;
  final String foodName;

  const FoodReviewsPage({
    super.key,
    required this.foodId,
    required this.foodName,
  });

  @override
  State<FoodReviewsPage> createState() => _FoodReviewsPageState();
}

class _FoodReviewsPageState extends State<FoodReviewsPage> {
  final ReviewService _reviewService = ReviewService();
  final ScrollController _scrollController = ScrollController();

  final List<FoodReview> _reviews = [];

  bool _isLoading = false;
  bool _hasError = false;
  int _page = 1;
  int _totalPages = 0;

  // Bộ lọc đánh giá
  int? _selectedRating;
  bool _onlyWithImages = false;

  double _averageRating = 0;
  int _totalReviews = 0;

  int _rating5 = 0;
  int _rating4 = 0;
  int _rating3 = 0;
  int _rating2 = 0;
  int _rating1 = 0;

  int _reviewsWithImages = 0;
  double _imagePercentage = 0;

  @override
  void initState() {
    super.initState();
    _loadReviews();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadReviews({bool refresh = false}) async {
    if (_isLoading) return;

    if (refresh) {
      _page = 1;
      _reviews.clear();
      _hasError = false;
    }

    if (!refresh && _totalPages > 0 && _page > _totalPages) {
      return;
    }

    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      final result = await _reviewService.getFoodReviews(
        foodId: widget.foodId,
        page: _page,
        limit: 10,
        rating: _selectedRating,
        hasImages: _onlyWithImages,
      );

      if (!mounted) return;

      setState(() {
        _reviews.addAll(result.items);
        _averageRating = result.averageRating;
        _totalReviews = result.totalReviews;

        _rating5 = result.rating5;
        _rating4 = result.rating4;
        _rating3 = result.rating3;
        _rating2 = result.rating2;
        _rating1 = result.rating1;

        _reviewsWithImages = result.reviewsWithImages;
        _imagePercentage = result.imagePercentage;

        _totalPages = result.totalPages;
        _page++;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _hasError = true;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _applyFilters({int? rating, bool? onlyWithImages}) async {
    setState(() {
      if (rating != null || _selectedRating != null) {
        _selectedRating = rating;
      }

      if (onlyWithImages != null) {
        _onlyWithImages = onlyWithImages;
      }

      _page = 1;
      _totalPages = 0;
      _reviews.clear();
      _hasError = false;
    });

    await _loadReviews();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (!_isLoading && _page <= _totalPages) {
        _loadReviews();
      }
    }
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();

    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year}';
  }

  Widget _buildStars(double rating, {double size = 20}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        return Icon(
          index < rating.round() ? Icons.star : Icons.star_border,
          color: Colors.orange,
          size: size,
        );
      }),
    );
  }

  Widget _buildSummary() {
    final total = _totalReviews;

    Widget ratingRow(int stars, int count) {
      final progress = total > 0 ? count / total : 0.0;

      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            SizedBox(
              width: 35,
              child: Text('$stars sao', style: const TextStyle(fontSize: 12)),
            ),
            const Icon(Icons.star, color: Colors.orange, size: 13),
            const SizedBox(width: 8),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(5),
                child: LinearProgressIndicator(
                  value: progress.clamp(0.0, 1.0),
                  minHeight: 8,
                  backgroundColor: Colors.grey.shade200,
                  color: Colors.orange,
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 25,
              child: Text(
                '$count',
                textAlign: TextAlign.end,
                style: const TextStyle(fontSize: 12),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.orange.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Column(
                children: [
                  Text(
                    _averageRating.toStringAsFixed(1),
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  _buildStars(_averageRating, size: 19),
                  const SizedBox(height: 4),
                  Text(
                    '$_totalReviews đánh giá',
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(width: 24),
              const Expanded(
                child: Text(
                  'Đánh giá từ khách hàng đã sử dụng món ăn tại Tuệ Nguyên.',
                  style: TextStyle(fontSize: 13, color: Colors.black87),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(),
          const SizedBox(height: 8),
          const Text(
            'Phân bố đánh giá',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          ratingRow(5, _rating5),
          ratingRow(4, _rating4),
          ratingRow(3, _rating3),
          ratingRow(2, _rating2),
          ratingRow(1, _rating1),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.photo_library_outlined, color: Colors.orange),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '$_reviewsWithImages đánh giá có hình ảnh',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
                Text(
                  '${_imagePercentage.toStringAsFixed(1)}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.orange,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewFilters() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Lọc đánh giá',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),

        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: const Text('Tất cả'),
              selected: _selectedRating == null,
              onSelected: (_) => _applyFilters(rating: null),
            ),
            for (int star = 5; star >= 1; star--)
              ChoiceChip(
                label: Text('$star ⭐'),
                selected: _selectedRating == star,
                onSelected: (_) => _applyFilters(rating: star),
              ),
          ],
        ),

        const SizedBox(height: 8),

        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Chỉ xem đánh giá có hình ảnh'),
          value: _onlyWithImages,
          onChanged: (value) {
            _applyFilters(onlyWithImages: value);
          },
        ),
      ],
    );
  }

  Widget _buildReviewItem(FoodReview review) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 19,
                child: Text(
                  (review.customerName?.isNotEmpty == true
                      ? review.customerName![0].toUpperCase()
                      : 'K'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.customerName ?? 'Khách hàng',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      _formatDate(review.createdAt),
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (review.isVerifiedPurchase)
                const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.verified, color: Colors.green, size: 15),
                    SizedBox(width: 3),
                    Text(
                      'Đã mua',
                      style: TextStyle(color: Colors.green, fontSize: 11),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 10),
          _buildStars(review.rating.toDouble()),
          if (review.title?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              review.title!,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ],
          if (review.content?.isNotEmpty == true) ...[
            const SizedBox(height: 5),
            Text(review.content!),
            _buildOfficialReply(review),
          ],
        ],
      ),
    );
  }

  Widget _buildOfficialReply(FoodReview review) {
    if (review.replyStatus != 'published' ||
        review.replyContent?.trim().isEmpty != false) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF2F7F3),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFD8E9DC)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.storefront_outlined,
                color: Color(0xFF27834A),
                size: 18,
              ),
              SizedBox(width: 7),
              Text(
                'Phản hồi từ Tuệ Nguyên',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF27834A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            review.replyContent!.trim(),
            style: const TextStyle(
              fontSize: 13,
              color: Colors.black87,
              height: 1.5,
            ),
          ),
          if (review.replyUpdatedAt != null) ...[
            const SizedBox(height: 6),
            Text(
              _formatDate(review.replyUpdatedAt!),
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F8F8),
      appBar: AppBar(title: Text('Đánh giá ${widget.foodName}')),
      body: _hasError && _reviews.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Không thể tải đánh giá.'),
                  const SizedBox(height: 10),
                  ElevatedButton(
                    onPressed: () => _loadReviews(refresh: true),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () => _loadReviews(refresh: true),
              child: ListView(
                controller: _scrollController,
                padding: const EdgeInsets.all(16),
                children: [
                  _buildSummary(),
                  const SizedBox(height: 20),
                  _buildReviewFilters(),
                  const SizedBox(height: 20),
                  const Text(
                    'Đánh giá của khách hàng',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 14),
                  if (_reviews.isEmpty && !_isLoading)
                    const Padding(
                      padding: EdgeInsets.all(30),
                      child: Center(child: Text('Chưa có đánh giá nào.')),
                    ),
                  ..._reviews.map(_buildReviewItem),
                  if (_isLoading)
                    const Padding(
                      padding: EdgeInsets.all(20),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                ],
              ),
            ),
    );
  }
}
