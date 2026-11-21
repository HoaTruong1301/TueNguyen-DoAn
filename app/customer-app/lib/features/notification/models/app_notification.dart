class AppNotification {
  final String id;
  final String type;
  final String title;
  final String content;
  final Map<String, dynamic>? data;
  final String? imageUrl;
  final bool isRead;
  final DateTime? readAt;
  final int priority;
  final DateTime? publishedAt;
  final DateTime? createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.content,
    this.data,
    this.imageUrl,
    required this.isRead,
    this.readAt,
    required this.priority,
    this.publishedAt,
    this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      data: json['data'] is Map
          ? Map<String, dynamic>.from(json['data'])
          : null,
      imageUrl: json['image_url']?.toString(),
      isRead: json['is_read'] == true,
      readAt: DateTime.tryParse(json['read_at']?.toString() ?? ''),
      priority: int.tryParse(json['priority']?.toString() ?? '') ?? 0,
      publishedAt:
          DateTime.tryParse(json['published_at']?.toString() ?? ''),
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? ''),
    );
  }
}
