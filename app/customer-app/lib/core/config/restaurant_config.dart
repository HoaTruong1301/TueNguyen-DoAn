import 'package:latlong2/latlong.dart';

/// Nhà hàng chay Tuệ Nguyên - 152 đường Bàu Bàng, Thủ Dầu Một (Bình Dương).
/// Toạ độ lấy từ OpenStreetMap, là điểm GIỮA đường Bàu Bàng (chưa đúng số nhà 152).
/// Muốn chính xác: Google Maps → chạm giữ đúng cửa quán → copy toạ độ → dán vào đây
/// và vào admin/admin-web/src/restaurantConfig.ts.
class RestaurantConfig {
  static const String name = 'Nhà hàng chay Tuệ Nguyên - Bình Dương';
  static const LatLng location = LatLng(10.97344, 106.65524);
}
