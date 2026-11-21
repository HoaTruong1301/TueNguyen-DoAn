import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../models/app_notification.dart';
import '../services/notification_service.dart';

class NotificationPage extends StatefulWidget {
  const NotificationPage({super.key});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage> {
  List<AppNotification> notifications = [];
  bool isLoading = true;
  bool isUpdating = false;
  String? errorMessage;
  int unreadCount = 0;

  @override
  void initState() {
    super.initState();
    loadNotifications();
  }

  Future<void> loadNotifications() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final result = await NotificationService.getNotifications();
      final data = result['data'];

      if (data is! Map) {
        throw Exception('Dữ liệu thông báo không hợp lệ.');
      }

      final rawNotifications = data['notifications'];

      if (!mounted) return;

      setState(() {
        notifications = rawNotifications is List
            ? rawNotifications
                .whereType<Map>()
                .map(
                  (item) => AppNotification.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
            : [];

        unreadCount =
            int.tryParse(data['unreadCount']?.toString() ?? '') ?? 0;

        isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        errorMessage = e.toString().replaceFirst('Exception: ', '');
        isLoading = false;
      });
    }
  }

  Future<void> markAsRead(AppNotification notification) async {
    if (notification.isRead || isUpdating) return;

    setState(() => isUpdating = true);

    try {
      await NotificationService.markAsRead(notification.id);
      await loadNotifications();
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể cập nhật: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => isUpdating = false);
      }
    }
  }

  Future<void> markAllAsRead() async {
    if (unreadCount == 0 || isUpdating) return;

    setState(() => isUpdating = true);

    try {
      await NotificationService.markAllAsRead();
      await loadNotifications();
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể cập nhật: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => isUpdating = false);
      }
    }
  }

  String formatDate(DateTime? date) {
    if (date == null) return '';

    final local = date.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');

    return '$hour:$minute - $day/$month/${local.year}';
  }

  IconData notificationIcon(String type) {
    switch (type) {
      case 'delivery_status':
        return Icons.local_shipping_outlined;
      case 'order_status':
        return Icons.receipt_long_outlined;
      default:
        return Icons.notifications_none;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F6F3),
      appBar: AppBar(
        title: const Text(
          'Thông báo',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: primaryColor,
        elevation: 0,
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: isUpdating ? null : markAllAsRead,
              child: const Text(
                'Đọc tất cả',
                style: TextStyle(
                  color: primaryColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadNotifications,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (errorMessage != null) {
      return ListView(
        children: [
          const SizedBox(height: 120),
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 12),
          Center(child: Text(errorMessage!)),
          Center(
            child: TextButton(
              onPressed: loadNotifications,
              child: const Text('Thử lại'),
            ),
          ),
        ],
      );
    }

    if (notifications.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 140),
          Icon(
            Icons.notifications_none,
            size: 72,
            color: Colors.black26,
          ),
          SizedBox(height: 16),
          Center(
            child: Text(
              'Bạn chưa có thông báo nào',
              style: TextStyle(color: Colors.black54),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: notifications.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final notification = notifications[index];

        return Material(
          color: notification.isRead
              ? Colors.white
              : const Color(0xFFFFF1E8),
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => markAsRead(notification),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    backgroundColor: primaryColor.withValues(alpha: 0.12),
                    child: Icon(
                      notificationIcon(notification.type),
                      color: primaryColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notification.title,
                          style: TextStyle(
                            fontWeight: notification.isRead
                                ? FontWeight.w500
                                : FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          notification.content,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          formatDate(
                            notification.publishedAt ??
                                notification.createdAt,
                          ),
                          style: const TextStyle(
                            fontSize: 11,
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (!notification.isRead)
                    Container(
                      width: 9,
                      height: 9,
                      margin: const EdgeInsets.only(top: 5, left: 8),
                      decoration: const BoxDecoration(
                        color: primaryColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
