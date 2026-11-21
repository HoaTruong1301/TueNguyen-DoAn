import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

class RouteInfo {
  final List<LatLng> points;
  final double distanceKm;
  final double durationMinutes;

  RouteInfo({
    required this.points,
    required this.distanceKm,
    required this.durationMinutes,
  });
}

class RouteService {
  static const String _baseUrl =
      'https://router.project-osrm.org/route/v1/driving';

  Future<List<LatLng>> getRoute({
    required LatLng origin,
    required LatLng destination,
  }) async {
    final url = Uri.parse(
      '$_baseUrl/'
      '${origin.longitude},${origin.latitude};'
      '${destination.longitude},${destination.latitude}'
      '?overview=full&geometries=geojson&steps=false',
    );

    final response = await http.get(url).timeout(const Duration(seconds: 20));

    if (response.statusCode != 200) {
      throw Exception('Không thể lấy tuyến đường giao hàng.');
    }

    final body = jsonDecode(response.body);

    if (body['code'] != 'Ok' ||
        body['routes'] == null ||
        (body['routes'] as List).isEmpty) {
      throw Exception('Không tìm thấy tuyến đường phù hợp.');
    }

    final coordinates = body['routes'][0]['geometry']['coordinates'] as List;

    return coordinates.map((coordinate) {
      return LatLng(
        (coordinate[1] as num).toDouble(),
        (coordinate[0] as num).toDouble(),
      );
    }).toList();
  }

  Future<RouteInfo> getRouteDetails({
    required LatLng origin,
    required LatLng destination,
  }) async {
    final url = Uri.parse(
      '$_baseUrl/'
      '${origin.longitude},${origin.latitude};'
      '${destination.longitude},${destination.latitude}'
      '?overview=full&geometries=geojson&steps=false',
    );

    final response = await http.get(url).timeout(const Duration(seconds: 20));

    if (response.statusCode != 200) {
      throw Exception('Không thể lấy thông tin tuyến đường.');
    }

    final body = jsonDecode(response.body);

    if (body['code'] != 'Ok' ||
        body['routes'] == null ||
        (body['routes'] as List).isEmpty) {
      throw Exception('Không tìm thấy tuyến đường.');
    }

    final route = body['routes'][0];

    final coordinates = route['geometry']['coordinates'] as List;

    final points = coordinates.map((coordinate) {
      return LatLng(
        (coordinate[1] as num).toDouble(),
        (coordinate[0] as num).toDouble(),
      );
    }).toList();

    return RouteInfo(
      points: points,
      distanceKm: (route['distance'] as num).toDouble() / 1000,
      durationMinutes: (route['duration'] as num).toDouble() / 60,
    );
  }
}
