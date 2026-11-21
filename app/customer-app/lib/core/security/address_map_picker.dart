import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../config/restaurant_config.dart';

class AddressMapPicker extends StatefulWidget {
  final double? initialLatitude;
  final double? initialLongitude;

  const AddressMapPicker({
    super.key,
    this.initialLatitude,
    this.initialLongitude,
  });

  @override
  State<AddressMapPicker> createState() => _AddressMapPickerState();
}

class _AddressMapPickerState extends State<AddressMapPicker> {
  late final MapController _mapController;
  late LatLng _selectedPosition;

  static const LatLng _defaultPosition = LatLng(10.762622, 106.660172);

  @override
  void initState() {
    super.initState();
    _mapController = MapController();

    _selectedPosition = LatLng(
      widget.initialLatitude ?? _defaultPosition.latitude,
      widget.initialLongitude ?? _defaultPosition.longitude,
    );
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  bool _locating = false;

  /// Lấy vị trí hiện tại của điện thoại (GPS) và đặt ghim tại đó.
  Future<void> _useCurrentLocation() async {
    if (_locating) return;
    setState(() => _locating = true);

    String? error;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        error = 'Vui lòng bật Định vị (GPS) trên điện thoại.';
      } else {
        var permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }

        if (permission == LocationPermission.denied) {
          error = 'Bạn chưa cho phép ứng dụng dùng vị trí.';
        } else if (permission == LocationPermission.deniedForever) {
          error = 'Quyền vị trí đã bị tắt. Hãy bật lại trong Cài đặt của điện thoại.';
        } else {
          final position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 15),
            ),
          );
          final here = LatLng(position.latitude, position.longitude);
          if (!mounted) return;
          _selectPosition(here);
          _mapController.move(here, 17);
        }
      }
    } catch (e) {
      error = 'Không lấy được vị trí. Hãy thử lại hoặc chạm vào bản đồ để chọn.';
    }

    if (!mounted) return;
    setState(() => _locating = false);
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
    }
  }

  void _selectPosition(LatLng position) {
    setState(() {
      _selectedPosition = position;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chọn vị trí giao hàng'),
        backgroundColor: const Color(0xFF8B3A25),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text(
              'Di chuyển bản đồ và chạm vào vị trí nhận hàng để đặt ghim.',
              textAlign: TextAlign.center,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _locating ? null : _useCurrentLocation,
                icon: _locating
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location),
                label: Text(
                  _locating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại của tôi',
                ),
              ),
            ),
          ),
          Expanded(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _selectedPosition,
                initialZoom: 15,
                onTap: (_, position) => _selectPosition(position),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.customer_app',
                ),
                MarkerLayer(
                  markers: [
                    const Marker(
                      point: RestaurantConfig.location,
                      width: 40,
                      height: 40,
                      child: Icon(
                        Icons.storefront_rounded,
                        size: 36,
                        color: Color(0xFF8B3A25),
                      ),
                    ),
                    Marker(
                      point: _selectedPosition,
                      width: 48,
                      height: 48,
                      child: const Icon(
                        Icons.location_pin,
                        size: 46,
                        color: Colors.red,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(
                  'Cách ${RestaurantConfig.name} khoảng '
                  '${const Distance().as(LengthUnit.Kilometer, RestaurantConfig.location, _selectedPosition).toStringAsFixed(1)} km (đường chim bay)',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                Text(
                  'Vĩ độ: ${_selectedPosition.latitude.toStringAsFixed(7)}\n'
                  'Kinh độ: ${_selectedPosition.longitude.toStringAsFixed(7)}',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF8B3A25),
                    ),
                    onPressed: () {
                      Navigator.pop(context, {
                        'latitude': _selectedPosition.latitude,
                        'longitude': _selectedPosition.longitude,
                      });
                    },
                    child: const Text('Xác nhận vị trí'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
