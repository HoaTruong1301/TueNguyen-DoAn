import 'dart:async';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter/material.dart';

import '../models/delivery.dart';
import '../services/delivery_service.dart';
import '../services/route_service.dart';
import '../widgets/restaurant_route_card.dart';

class DeliveryDetailPage extends StatefulWidget {
  final String orderId;

  const DeliveryDetailPage({super.key, required this.orderId});

  @override
  State<DeliveryDetailPage> createState() => _DeliveryDetailPageState();
}

class _DeliveryDetailPageState extends State<DeliveryDetailPage> {
  final DeliveryService _service = DeliveryService();
  final RouteService _routeService = RouteService();

  List<LatLng> _routePoints = [];

  double? _remainingDistanceKm;
  double? _estimatedMinutes;

  bool _isLoadingRoute = false;

  Delivery? _delivery;

  // Lịch sử trạng thái giao hàng
  List<Map<String, dynamic>> _tracking = [];

  // Lịch sử tọa độ GPS người giao hàng
  List<Map<String, dynamic>> _gpsTracking = [];

  bool _isLoading = true;
  String? _error;
  Timer? _gpsRefreshTimer;
  bool _isRefreshingGps = false;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  void _startGpsRefresh() {
    _gpsRefreshTimer?.cancel();

    _gpsRefreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _refreshGps(),
    );
  }

  Future<void> _refreshGps() async {
    if (!mounted || _isRefreshingGps) return;

    final status = _delivery?.status;

    if (status != 'picked_up' && status != 'out_for_delivery') {
      _gpsRefreshTimer?.cancel();
      return;
    }

    _isRefreshingGps = true;

    try {
      final tracking = await _service.getDeliveryTracking(widget.orderId);

      if (!mounted) return;

      setState(() {
        _gpsTracking = tracking;
      });

      // Tính lại tuyến đường theo vị trí GPS mới nhất
      if (tracking.isNotEmpty) {
        final latest = tracking.last;

        final latitude = double.tryParse(latest['latitude']?.toString() ?? '');

        final longitude = double.tryParse(
          latest['longitude']?.toString() ?? '',
        );

        final address = _delivery?.addressSnapshot ?? {};

        final destinationLat = double.tryParse(
          address['latitude']?.toString() ?? '',
        );

        final destinationLng = double.tryParse(
          address['longitude']?.toString() ?? '',
        );

        if (latitude != null &&
            longitude != null &&
            destinationLat != null &&
            destinationLng != null) {
          await _loadDeliveryRoute(
            origin: LatLng(latitude, longitude),
            destination: LatLng(destinationLat, destinationLng),
          );
        }
      }
    } catch (e) {
      debugPrint('Lỗi cập nhật GPS: $e');
    } finally {
      _isRefreshingGps = false;
    }
  }

  Future<void> _loadDeliveryRoute({
    required LatLng origin,
    required LatLng destination,
  }) async {
    if (_isLoadingRoute) return;

    _isLoadingRoute = true;

    try {
      final route = await _routeService.getRouteDetails(
        origin: origin,
        destination: destination,
      );

      if (!mounted) return;

      setState(() {
        _routePoints = route.points;
        _remainingDistanceKm = route.distanceKm;
        _estimatedMinutes = route.durationMinutes;
      });
    } catch (e) {
      debugPrint('Lỗi lấy tuyến đường giao hàng: $e');
    } finally {
      _isLoadingRoute = false;
    }
  }

  Future<void> _loadDetail() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        _service.getDeliveryDetail(widget.orderId),
        _service.getDeliveryTracking(widget.orderId),
      ]);

      final detail = results[0] as Map<String, dynamic>;
      final tracking = results[1] as List<Map<String, dynamic>>;

      // Backend có thể trả delivery trực tiếp hoặc bọc trong delivery.
      final deliveryData = detail['delivery'] is Map
          ? Map<String, dynamic>.from(detail['delivery'])
          : detail;

      if (!mounted) return;

      setState(() {
        _delivery = Delivery.fromJson(deliveryData);

        final history =
            deliveryData['status_history'] ??
            deliveryData['history'] ??
            detail['status_history'] ??
            detail['history'];

        _tracking = history is List
            ? history
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : [];

        _gpsTracking = tracking;

        _isLoading = false;
      });
      _startGpsRefresh();
      // Tải tuyến đường ngay khi mở chi tiết đơn hàng
      if (_gpsTracking.isNotEmpty && _delivery != null) {
        final latest = _gpsTracking.last;

        final latitude = double.tryParse(latest['latitude']?.toString() ?? '');

        final longitude = double.tryParse(
          latest['longitude']?.toString() ?? '',
        );

        final address = _delivery!.addressSnapshot;

        final destinationLat = double.tryParse(
          address['latitude']?.toString() ?? '',
        );

        final destinationLng = double.tryParse(
          address['longitude']?.toString() ?? '',
        );

        if (latitude != null &&
            longitude != null &&
            destinationLat != null &&
            destinationLng != null) {
          await _loadDeliveryRoute(
            origin: LatLng(latitude, longitude),
            destination: LatLng(destinationLat, destinationLng),
          );
        }
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  String _statusLabel(String status) {
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
        return status;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'delivered':
        return Colors.green;
      case 'failed':
      case 'cancelled':
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

  String _formatDate(dynamic value) {
    if (value == null) return 'Chưa cập nhật';

    final date = DateTime.tryParse(value.toString());

    if (date == null) return value.toString();

    final local = date.toLocal();

    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  String _formatPrice(double price) {
    return '${price.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')} đ';
  }

  /// Toạ độ địa chỉ nhận hàng của đơn (null nếu khách chưa ghim vị trí).
  LatLng? _destinationLatLng() {
    final address = _delivery?.addressSnapshot ?? {};
    final lat = double.tryParse(address['latitude']?.toString() ?? '');
    final lng = double.tryParse(address['longitude']?.toString() ?? '');

    if (lat == null ||
        lng == null ||
        !lat.isFinite ||
        !lng.isFinite ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180) {
      return null;
    }
    return LatLng(lat, lng);
  }

  Widget _buildGpsMap() {
    final points = _gpsTracking
        .map((item) {
          final lat = double.tryParse(item['latitude']?.toString() ?? '');
          final lng = double.tryParse(item['longitude']?.toString() ?? '');

          if (lat == null ||
              lng == null ||
              !lat.isFinite ||
              !lng.isFinite ||
              lat < -90 ||
              lat > 90 ||
              lng < -180 ||
              lng > 180) {
            return null;
          }

          return LatLng(lat, lng);
        })
        .whereType<LatLng>()
        .toList();

    if (points.isEmpty) {
      final fallbackDestination = _destinationLatLng();

      final noTrackingCard = Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Vị trí người giao hàng',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text('Chưa có dữ liệu vị trí người giao hàng.'),
            ],
          ),
        ),
      );

      // Chưa có shipper: vẫn cho khách xem đường từ nhà hàng đến địa chỉ đã ghim
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          noTrackingCard,
          if (fallbackDestination != null)
            RestaurantRouteCard(destination: fallbackDestination),
        ],
      );
    }

    final latest = points.last;

    // Lấy tọa độ địa chỉ nhận hàng
    final address = _delivery?.addressSnapshot ?? {};

    final destinationLat = double.tryParse(
      address['latitude']?.toString() ?? '',
    );

    final destinationLng = double.tryParse(
      address['longitude']?.toString() ?? '',
    );

    final LatLng? destination =
        destinationLat != null &&
            destinationLng != null &&
            destinationLat.isFinite &&
            destinationLng.isFinite &&
            destinationLat >= -90 &&
            destinationLat <= 90 &&
            destinationLng >= -180 &&
            destinationLng <= 180
        ? LatLng(destinationLat, destinationLng)
        : null;

    debugPrint('ĐỊA CHỈ SNAPSHOT: $address');
    debugPrint('LATITUDE: $destinationLat');
    debugPrint('LONGITUDE: $destinationLng');

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Vị trí người giao hàng',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 12),

            // Thông tin khoảng cách và thời gian dự kiến
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        const Icon(
                          Icons.route_rounded,
                          color: Colors.blue,
                          size: 26,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Khoảng cách còn lại',
                                style: TextStyle(fontSize: 11),
                              ),
                              Text(
                                _remainingDistanceKm != null
                                    ? '${_remainingDistanceKm!.toStringAsFixed(1)} km'
                                    : '-- km',
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  Container(
                    width: 1,
                    height: 42,
                    color: Colors.grey.withValues(alpha: 0.3),
                  ),

                  const SizedBox(width: 12),

                  Expanded(
                    child: Row(
                      children: [
                        const Icon(
                          Icons.access_time_rounded,
                          color: Colors.green,
                          size: 26,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Dự kiến đến nơi',
                                style: TextStyle(fontSize: 11),
                              ),
                              Text(
                                _estimatedMinutes != null
                                    ? (_estimatedMinutes! < 1
                                          ? 'Dưới 1 phút'
                                          : '${_estimatedMinutes!.ceil()} phút')
                                    : '-- phút',
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 8),

            if (_isLoadingRoute)
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Đang cập nhật tuyến đường...',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
              ),

            SizedBox(
              height: 260,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: latest,
                  initialZoom: 15,
                  initialCameraFit: destination == null
                      ? null
                      : CameraFit.coordinates(
                          coordinates: [latest, destination],
                          padding: const EdgeInsets.all(40),
                        ),
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.example.customer_app',
                  ),

                  // Đường nối người giao hàng và người nhận
                  if (destination != null)
                    PolylineLayer(
                      polylines: [
                        Polyline(
                          points: _routePoints.length >= 2
                              ? _routePoints
                              : [latest, destination],
                          strokeWidth: 5,
                          color: Colors.blue,
                          borderStrokeWidth: 2,
                          borderColor: Colors.white,
                        ),
                      ],
                    ),
                  MarkerLayer(
                    markers: [
                      // Vị trí người giao hàng
                      Marker(
                        point: latest,
                        width: 44,
                        height: 44,
                        child: const Icon(
                          Icons.location_pin,
                          color: Colors.red,
                          size: 42,
                        ),
                      ),

                      // Địa chỉ nhận hàng
                      if (destination != null)
                        Marker(
                          point: destination,
                          width: 52,
                          height: 58,
                          child: Container(
                            alignment: Alignment.topCenter,
                            child: Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.22),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                                border: Border.all(
                                  color: Colors.green,
                                  width: 2,
                                ),
                              ),
                              child: const Icon(
                                Icons.home_rounded,
                                color: Colors.green,
                                size: 28,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Builder(
              builder: (context) {
                final recordedAt = DateTime.tryParse(
                  _gpsTracking.last['recorded_at']?.toString() ?? '',
                );

                final age = recordedAt == null
                    ? null
                    : DateTime.now().difference(recordedAt.toLocal());

                final isFresh = age != null && age.inSeconds < 30;

                final isDelayed =
                    age != null && age.inSeconds >= 30 && age.inSeconds <= 60;

                final statusText = age == null
                    ? 'Không xác định được thời gian cập nhật'
                    : isFresh
                    ? 'Vị trí vừa được cập nhật'
                    : isDelayed
                    ? 'Vị trí đang cập nhật chậm'
                    : 'Vị trí đã lâu chưa cập nhật';

                final statusColor = isFresh
                    ? Colors.green
                    : isDelayed
                    ? Colors.orange
                    : Colors.red;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Cập nhật lúc: ${recordedAt?.toLocal().toString() ?? 'Chưa rõ'}',
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.circle, size: 10, color: statusColor),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            statusText,
                            style: TextStyle(
                              color: statusColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
            Text('Vĩ độ: ${latest.latitude.toStringAsFixed(7)}'),
            Text('Kinh độ: ${latest.longitude.toStringAsFixed(7)}'),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _gpsRefreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết giao hàng')),
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
            Text(_error!),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadDetail,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    if (_delivery == null) {
      return const Center(child: Text('Không tìm thấy thông tin giao hàng.'));
    }

    final delivery = _delivery!;

    return RefreshIndicator(
      onRefresh: _loadDetail,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCurrentStatus(delivery),
          const SizedBox(height: 16),
          _buildProgress(delivery.status),
          const SizedBox(height: 16),
          _buildRecipient(delivery),
          const SizedBox(height: 16),
          _buildDriver(delivery),
          if (['picked_up', 'out_for_delivery'].contains(delivery.status)) ...[
            const SizedBox(height: 16),
            _buildGpsMap(),
          ],
          const SizedBox(height: 16),
          _buildHistory(),
        ],
      ),
    );
  }

  Widget _buildCurrentStatus(Delivery delivery) {
    final color = _statusColor(delivery.status);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Trạng thái giao hàng',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.local_shipping, color: color, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    delivery.statusLabel,
                    style: TextStyle(
                      color: color,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text('Mã đơn hàng: ${delivery.orderId}'),
            const SizedBox(height: 6),
            Text('Phí giao hàng: ${_formatPrice(delivery.deliveryFee)}'),
          ],
        ),
      ),
    );
  }

  Widget _buildProgress(String status) {
    const steps = [
      ('pending', 'Chờ phân công'),
      ('assigned', 'Đã phân công'),
      ('picked_up', 'Đã lấy hàng'),
      ('out_for_delivery', 'Đang giao hàng'),
      ('delivered', 'Đã giao hàng'),
    ];

    final currentIndex = steps.indexWhere((step) => step.$1 == status);

    final isTerminal = status == 'failed' || status == 'cancelled';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tiến trình giao hàng',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            for (int i = 0; i < steps.length; i++)
              _buildStep(
                steps[i].$2,
                i <= currentIndex && !isTerminal,
                i == steps.length - 1,
              ),
            if (isTerminal) ...[
              const Divider(),
              Text(
                _statusLabel(status),
                style: TextStyle(
                  color: _statusColor(status),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStep(String title, bool completed, bool isLast) {
    final color = completed ? Colors.green : Colors.grey;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Icon(
              completed ? Icons.check_circle : Icons.radio_button_unchecked,
              color: color,
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 30,
                color: color.withValues(alpha: 0.4),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            title,
            style: TextStyle(
              color: completed ? Colors.green : Colors.grey,
              fontWeight: completed ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRecipient(Delivery delivery) {
    final address = delivery.addressSnapshot;

    final addressText =
        [
              address['address_line'],
              address['ward'],
              address['district'],
              address['province'],
            ]
            .where(
              (value) => value != null && value.toString().trim().isNotEmpty,
            )
            .join(', ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Thông tin người nhận',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text('Họ tên: ${delivery.recipientName}'),
            const SizedBox(height: 8),
            Text('Điện thoại: ${delivery.recipientPhone}'),
            const SizedBox(height: 8),
            Text(
              'Địa chỉ: ${addressText.isEmpty ? 'Chưa có thông tin' : addressText}',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDriver(Delivery delivery) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Thông tin người giao hàng',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text('Họ tên: ${delivery.driverName ?? 'Chưa phân công'}'),
            const SizedBox(height: 8),
            Text('Điện thoại: ${delivery.driverPhone ?? 'Chưa có'}'),
          ],
        ),
      ),
    );
  }

  Widget _buildHistory() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Lịch sử cập nhật',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            if (_tracking.isEmpty)
              const Text(
                'Chưa có lịch sử cập nhật.',
                style: TextStyle(color: Colors.grey),
              )
            else
              for (final item in _tracking) _buildHistoryItem(item),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryItem(Map<String, dynamic> item) {
    final status = item['new_status']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.history, color: Colors.blue),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _statusLabel(status),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(item['note']?.toString() ?? ''),
                const SizedBox(height: 4),
                Text(
                  _formatDate(item['created_at']),
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
