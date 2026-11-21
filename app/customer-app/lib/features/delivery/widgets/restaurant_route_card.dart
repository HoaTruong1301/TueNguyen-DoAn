import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/restaurant_config.dart';
import '../services/route_service.dart';

/// Bản đồ đường đi từ nhà hàng đến địa chỉ khách đã ghim.
/// Dùng OpenStreetMap + OSRM (miễn phí, không cần API key) và nút mở
/// Google Maps chỉ đường (không cần API key).
class RestaurantRouteCard extends StatefulWidget {
  final LatLng destination;

  const RestaurantRouteCard({super.key, required this.destination});

  @override
  State<RestaurantRouteCard> createState() => _RestaurantRouteCardState();
}

class _RestaurantRouteCardState extends State<RestaurantRouteCard> {
  final RouteService _routeService = RouteService();

  List<LatLng> _routePoints = [];
  double? _distanceKm;
  double? _minutes;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  @override
  void didUpdateWidget(covariant RestaurantRouteCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.destination != widget.destination) {
      _loadRoute();
    }
  }

  Future<void> _loadRoute() async {
    setState(() {
      _loading = true;
      _failed = false;
    });

    try {
      final route = await _routeService.getRouteDetails(
        origin: RestaurantConfig.location,
        destination: widget.destination,
      );
      if (!mounted) return;
      setState(() {
        _routePoints = route.points;
        _distanceKm = route.distanceKm;
        _minutes = route.durationMinutes;
        _loading = false;
      });
    } catch (e) {
      debugPrint('Lỗi lấy đường đi từ nhà hàng: $e');
      if (!mounted) return;
      setState(() {
        _failed = true;
        _loading = false;
      });
    }
  }

  Future<void> _openGoogleMaps() async {
    final origin = RestaurantConfig.location;
    final destination = widget.destination;
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'origin': '${origin.latitude},${origin.longitude}',
      'destination': '${destination.latitude},${destination.longitude}',
      'travelmode': 'driving',
    });

    var opened = false;
    try {
      opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('Không mở được Google Maps: $e');
    }

    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không mở được Google Maps trên thiết bị này.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final restaurant = RestaurantConfig.location;
    final destination = widget.destination;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Đường đi từ nhà hàng đến bạn',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _loading
                  ? 'Đang tính quãng đường...'
                  : _distanceKm == null
                  ? 'Chưa tính được quãng đường.'
                  : 'Quãng đường: ${_distanceKm!.toStringAsFixed(1)} km'
                        ' · khoảng ${_minutes!.ceil()} phút',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            if (_failed)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text(
                  'Không tải được tuyến đường, đang hiển thị đường thẳng.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ),
            const SizedBox(height: 10),
            SizedBox(
              height: 240,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: destination,
                    initialZoom: 14,
                    initialCameraFit: CameraFit.coordinates(
                      coordinates: [restaurant, destination],
                      padding: const EdgeInsets.all(40),
                    ),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.example.customer_app',
                    ),
                    PolylineLayer(
                      polylines: [
                        Polyline(
                          points: _routePoints.length >= 2
                              ? _routePoints
                              : [restaurant, destination],
                          strokeWidth: 5,
                          color: Colors.blue,
                          borderStrokeWidth: 2,
                          borderColor: Colors.white,
                        ),
                      ],
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: restaurant,
                          width: 44,
                          height: 44,
                          child: const Icon(
                            Icons.storefront_rounded,
                            color: Color(0xFF8B3A25),
                            size: 38,
                          ),
                        ),
                        Marker(
                          point: destination,
                          width: 44,
                          height: 44,
                          child: const Icon(
                            Icons.home_rounded,
                            color: Colors.green,
                            size: 38,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _openGoogleMaps,
                icon: const Icon(Icons.map_outlined),
                label: const Text('Mở chỉ đường trong Google Maps'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
