
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../core/constants/app_colors.dart';

class Branch {
  final String name;
  final String address;
  final LatLng location;

  const Branch(this.name, this.address, this.location);
}

const List<Branch> kBranches = [
  Branch(
    'CN1 - Bình Dương',
    '152 Bàu Bàng, P. Thủ Dầu Một, Bình Dương',
    LatLng(10.973334, 106.6550884),
  ),
  Branch(
    'CN2 - Nha Trang',
    '12C Đ. 23 tháng 10, Tây Nha Trang, Khánh Hoà',
    LatLng(12.2498539, 109.1813509),
  ),
  Branch(
    'CN3 - TP. Hồ Chí Minh',
    '203 Đ. Trần Văn Kiểu, Khu IV, Bình Phú, TP. Hồ Chí Minh',
    LatLng(10.7410231, 106.6278387),
  ),
];

class DeliveryInfoCard extends StatelessWidget {
  final Branch branch;
  final ValueChanged<Branch> onBranchChanged;
  final Map<String, dynamic>? address;
  final VoidCallback onChangeAddress;

  const DeliveryInfoCard({
    super.key,
    required this.branch,
    required this.onBranchChanged,
    required this.address,
    required this.onChangeAddress,
  });

  String _addressText() {
    if (address == null) return 'Chưa có địa chỉ giao hàng';

    final parts = [
      address!['address_line'],
      address!['ward'],
      address!['district'],
      address!['province'],
    ].where((e) => e != null && e.toString().trim().isNotEmpty);

    return parts.join(', ');
  }

  String? _distanceText() {
    final lat = double.tryParse('${address?['latitude']}');
    final lng = double.tryParse('${address?['longitude']}');

    if (lat == null || lng == null) return null;

    final km = const Distance().as(
      LengthUnit.Kilometer,
      branch.location,
      LatLng(lat, lng),
    );

    return 'Cách chi nhánh khoảng ${km.toStringAsFixed(1)} km';
  }

  @override
  Widget build(BuildContext context) {
    final distance = _distanceText();

    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.brown.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Chi nhánh nhận đơn',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<Branch>(
            initialValue: branch,
            isExpanded: true,
            items: kBranches
                .map((b) => DropdownMenuItem(
              value: b,
              child: Text(b.name),
            ))
                .toList(),
            onChanged: (b) {
              if (b != null) onBranchChanged(b);
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.location_on, color: primaryColor),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'Địa chỉ giao hàng',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              TextButton(
                onPressed: onChangeAddress,
                child: const Text('Đổi / thêm'),
              ),
            ],
          ),
          Text(_addressText()),
          if (distance != null)
            Text(
              distance,
              style: const TextStyle(
                color: Colors.grey,
                fontSize: 12,
              ),
            ),
        ],
      ),
    );
  }
}
