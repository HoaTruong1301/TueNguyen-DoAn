# Thay đổi: Kho, Giám sát nhân viên, Đường đi đến khách

## Chạy migration (theo thứ tự, sau seeds/001_rbac_defaults.sql)
    psql -d <db> -f database/migrations/031_inventory.sql
    psql -d <db> -f database/migrations/032_staff_audit.sql
Đăng nhập lại tài khoản admin để nhận quyền mới.

## Kho (admin → "Quản lý kho")
- Tồn kho theo 3 kho mẫu (Kho tổng / Kho bếp / Kho quầy). Cảnh báo sắp hết, âm kho.
- Trừ kho TỰ ĐỘNG khi đơn chuyển sang `completed` (bấm hoàn tất bill) theo công thức món; trừ ở "Kho bếp" (kho có cờ is_sales_warehouse). Chống trừ 2 lần.
- Đặt hàng NCC: lưu chờ nhận → bấm "Nhận hàng" thì tự cộng kho; hoặc "Đặt & nhận hàng luôn".
- Nhập hàng: phiếu nhập trực tiếp, cộng kho ngay.
- Điều chuyển giữa kho (trừ kho xuất, cộng kho nhận, rollback nếu thiếu hàng). Huỷ hàng (bắt buộc lý do).
- Công thức món sửa ngay trong tab "Công thức món". Công thức mẫu trong 031 là số tự đặt.

## Giám sát nhân viên (admin → "Giám sát nhân viên")
- Ai huỷ bill, ai giảm giá, ai huỷ hàng kho; lọc theo ngày/loại/nhân viên; gắn cờ ⚠ thao tác đáng chú ý.
- Nút "Giảm giá thủ công" trong chi tiết đơn (ghi vết). Nhân viên thường tối đa 20% tiền hàng; ADMIN/MANAGER không giới hạn.

## Đường đi từ nhà hàng đến khách
- Admin (Giao hàng) và app khách (chi tiết giao hàng) hiện bản đồ + đường đi + km/phút + nút mở Google Maps.
- Dùng OpenStreetMap + OSRM + deep link Google Maps → KHÔNG cần API key Google.
- Toạ độ hiện là điểm giữa đường Bàu Bàng (152 Bàu Bàng, Bình Dương), nên chỉnh cho đúng cửa quán ở: `admin/admin-web/src/restaurantConfig.ts` và `app/customer-app/lib/core/config/restaurant_config.dart`.
