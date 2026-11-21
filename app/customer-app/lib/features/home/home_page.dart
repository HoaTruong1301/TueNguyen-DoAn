import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../../core/security/auth_service.dart';
import '../../core/security/address_service.dart';
import '../../core/security/account_login_section.dart';
import '../../models/food.dart';
import '../../core/utils/formatters.dart';
import '../../core/constants/app_colors.dart';
import '../food/services/food_service.dart';
import '../order/services/order_service.dart';
import '../cart/services/cart_service.dart';
import '../order/pages/order_history_page.dart';
import '../notification/pages/notification_page.dart';
import '../notification/services/notification_service.dart';
import '../../core/services/fcm_service.dart';
import '../voucher/pages/voucher_page.dart';
import '../review/pages/food_reviews_page.dart';
import '../../core/config/api_config.dart';
import '../cart/delivery_info_card.dart';


class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  String selectedCategory = 'Tất cả';
  int selectedTab = 0;
  Branch selectedBranch = kBranches.first;
  Map<String, dynamic>? selectedAddress;

  Future<void> loadAddresses() async {
    try {
      final list = await AddressService.getAddresses();
      if (!mounted) return;
      setState(() {
        if (list.isEmpty) {
          selectedAddress = null;
          return;
        }
        final stillThere = list.where((a) => a['id'] == selectedAddress?['id']);
        selectedAddress = stillThere.isNotEmpty
            ? stillThere.first
            : list.firstWhere(
              (a) => a['is_default'] == true || a['isDefault'] == true,
          orElse: () => list.first,
        );
      });
    } catch (_) {}
  }
  final CartService _cartService = CartService();
  int unreadNotificationCount = 0;

  Map<String, int> get cart => _cartService.items;
  List<Food> menuFoods = [];
  List<Map<String, dynamic>> banners = [];
  bool isLoadingBanners = true;
  int currentBannerIndex = 0;
  Timer? _bannerTimer;
  final PageController _bannerPageController = PageController();

  void _startBannerAutoPlay() {
    _bannerTimer?.cancel();

    if (banners.length <= 1) return;

    _bannerTimer = Timer.periodic(
      const Duration(seconds: 4),
          (timer) {
        if (!mounted || !_bannerPageController.hasClients) return;

        final nextIndex = (currentBannerIndex + 1) % banners.length;

        _bannerPageController.animateToPage(
          nextIndex,
          duration: const Duration(milliseconds: 700),
          curve: Curves.easeInOutCubic,
        );
      },
    );
  }
  Future<void> _handleBannerTap(Map<String, dynamic> banner) async {
    final actionType = banner['action_type']?.toString();
    final actionValue = banner['action_value']?.toString();

    switch (actionType) {
      case 'none':
        return;

      case 'promotion':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const VoucherPage(),
          ),
        );
        break;

      case 'category':
        if (actionValue == null || actionValue.isEmpty) return;

        setState(() {
          selectedCategory = actionValue;
          selectedTab = 0;
        });
        break;

      case 'url':
        if (actionValue == null || actionValue.isEmpty) return;

        final uri = Uri.tryParse(actionValue);

        if (uri == null ||
            (uri.scheme != 'https' && uri.scheme != 'http') ||
            uri.host.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Đường dẫn không hợp lệ.'),
            ),
          );
          return;
        }

        try {
          final launched = await launchUrl(
            uri,
            mode: LaunchMode.externalApplication,
          );

          if (!launched && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Không thể mở đường dẫn.'),
              ),
            );
          }
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Không thể mở đường dẫn.'),
              ),
            );
          }
        }
        break;

      case 'product':
        if (actionValue == null || actionValue.isEmpty) return;

        final food = menuFoods.where(
              (item) => item.id == actionValue,
        ).firstOrNull;

        if (food == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Món ăn hiện không còn khả dụng.'),
            ),
          );
          return;
        }

        _showFoodOptionsDialog(food);
        break;

      default:
        debugPrint('Loại hành động banner chưa hỗ trợ: $actionType');
    }
  }
  final FoodService _foodService = FoodService();
  final OrderService _orderService = OrderService();
  // Voucher checkout
  final TextEditingController _voucherController = TextEditingController();

  String? appliedVoucherCode;
  Map<String, dynamic>? appliedVoucher;
  bool isValidatingVoucher = false;
  bool isLoadingFoods = true;
  String? foodsError;

  @override
  void initState() {
    super.initState();
    loadBanners();
    loadFoods();
    loadUnreadNotificationCount();

    FcmService.notificationReadNotifier.addListener(
      loadUnreadNotificationCount,
    );
  }

  Future<void> loadBanners() async {
    try {
      final response = await http
          .get(
        Uri.parse(
            '${ApiConfig.apiUrl}/menu/banners',
        ),
      )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode != 200) {
        throw Exception('Không thể tải banner');
      }

      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final items = decoded['data'] as List<dynamic>;

      if (!mounted) return;

      setState(() {
        banners = items
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        isLoadingBanners = false;
      });

      _startBannerAutoPlay();
    } catch (error) {
      debugPrint('Lỗi tải banner: $error');

      if (!mounted) return;

      setState(() {
        isLoadingBanners = false;
      });
    }
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerPageController.dispose();

    FcmService.notificationReadNotifier.removeListener(
      loadUnreadNotificationCount,
    );

    _voucherController.dispose();

    super.dispose();
  }

  Future<void> loadFoods() async {
    setState(() {
      isLoadingFoods = true;
      foodsError = null;
    });

    try {
      final loadedFoods = await _foodService.getFoods();

      if (!mounted) return;

      setState(() {
        menuFoods = loadedFoods;
        isLoadingFoods = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        foodsError = e.toString();
        isLoadingFoods = false;
      });
    }
  }

  Future<void> loadUnreadNotificationCount() async {
    try {
      final result = await NotificationService.getUnreadCount();
      final data = result['data'];

      if (!mounted || data is! Map) return;

      setState(() {
        unreadNotificationCount =
            int.tryParse(data['unreadCount']?.toString() ?? '') ?? 0;
      });
    } catch (_) {
      // Không ảnh hưởng hoạt động của trang chủ nếu tải số thông báo thất bại.
    }
  }

  Future<void> placeOrder() async {
    if (cart.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Giỏ hàng đang trống.')));
      return;
    }

    try {
      final token = await AuthService.getAccessToken();

      if (token == null || token.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Vui lòng đăng nhập trước khi đặt hàng.'),
          ),
        );
        return;
      }

      final addresses = await AddressService.getAddresses();

      if (!mounted) return;

      if (addresses.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bạn cần thêm địa chỉ giao hàng trước.'),
          ),
        );
        setState(() => selectedTab = 3);
        return;
      }

      final address = selectedAddress ?? addresses.first;
      final addressId = address['id']?.toString();

      if (addressId == null || addressId.isEmpty) {
        throw Exception('Địa chỉ giao hàng không có ID hợp lệ.');
      }

      final items = _cartService.cartItems.map((item) {
        return {
          'foodId': item.food.id,
          'quantity': item.quantity,
          'note': item.note,
          'options': item.options.map((option) {
            return {
              'optionId': option.id,
              'quantity': 1,
            };
          }).toList(),
        };
      }).toList();

      if (items.isEmpty) {
        throw Exception('Không tìm thấy món ăn trong giỏ hàng.');
      }

      final order = await _orderService.createOrder(
        addressId: addressId,
        items: items,
        voucherCode: appliedVoucherCode,
          note: 'Chi nhánh: ${selectedBranch.name}'
      );

      if (!mounted) return;

      setState(() {
        _cartService.clear();
      });

      final orderCode =
          order['order_code'] ??
          order['orderCode'] ??
          order['code'] ??
          'Đã tạo thành công';

      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Đặt hàng thành công'),
          content: Text('Mã đơn hàng: $orderCode'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Đóng'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Đặt hàng thất bại: $e')));
    }
  }

  Future<void> testMenuApi() async {
    final url = Uri.parse('${ApiConfig.apiUrl}/menu/foods');

    try {
      final response = await http.get(url);

      debugPrint('HTTP status: ${response.statusCode}');
      debugPrint('API response: ${response.body}');
    } catch (e) {
      debugPrint('API connection error: $e');
    }
  }

  final List<String> categories = [
    'Tất cả',
    'Cơm',
    'Mì và bún',
    'Đồ uống',
    'Đồ ăn vặt',
  ];

  List<Food> get filteredFoods {
    if (selectedCategory == 'Tất cả') return menuFoods;

    return menuFoods
        .where((food) => food.category == selectedCategory)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(
          index: selectedTab,
          children: [
            buildHome(),
            buildCart(),
            const OrderHistoryPage(),
            buildAccount(),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedTab,
        onDestinationSelected: (index) {
          setState(() => selectedTab = index);
          if (index == 1) loadAddresses();
        },
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFF4E2D7),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Trang chủ',
          ),
          NavigationDestination(
            icon: Icon(Icons.shopping_bag_outlined),
            selectedIcon: Icon(Icons.shopping_bag),
            label: 'Giỏ hàng',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Đơn hàng',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Tài khoản',
          ),
        ],
      ),
    );
  }

  Widget buildHome() {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.asset(
                      'assets/images/logo.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TUỆ NGUYÊN',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: primaryColor,
                          letterSpacing: 1,
                        ),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Ngon lành trong từng món ăn',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const NotificationPage(),
                      ),
                    );

                    if (mounted) {
                      loadUnreadNotificationCount();
                    }
                  },
                  icon: Badge(
                    label: Text('$unreadNotificationCount'),
                    isLabelVisible: unreadNotificationCount > 0,
                    child: const Icon(Icons.notifications_none, size: 27),
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  onPressed: () => setState(() => selectedTab = 1),
                  icon: Badge(
                    label: Text('${_cartService.totalQuantity}'),
                    isLabelVisible: cart.isNotEmpty,
                    child: const Icon(Icons.shopping_bag_outlined, size: 27),
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 18),
            child: isLoadingBanners
                ? const SizedBox(
              height: 160,
              child: Center(
                child: CircularProgressIndicator(),
              ),
            )
                : banners.isEmpty
                ? const SizedBox.shrink()
        : Container(
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6B3928).withValues(alpha: 0.16),
                  blurRadius: 22,
                  offset: const Offset(0, 9),
                ),
              ],
            ),
            child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: AspectRatio(
                  aspectRatio: 16 / 7,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      PageView.builder(
                        controller: _bannerPageController,
                        itemCount: banners.length,
                        onPageChanged: (index) {
                          setState(() {
                            currentBannerIndex = index;
                          });
                        },
                        itemBuilder: (context, index) {
                          final banner = banners[index];
                          final imageUrl =
                              banner['mobile_image_url'] ??
                              banner['image_url'];

                          return GestureDetector(
                            onTap: () {
                              _handleBannerTap(banner);
                            },
                            child: Image.network(
                              '${ApiConfig.baseUrl}$imageUrl',
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  color: const Color(0xFFF3E5D8),
                                  alignment: Alignment.center,
                                  child: const Icon(
                                    Icons.image_not_supported_outlined,
                                    size: 40,
                                    color: Colors.grey,
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      ),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 38,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Colors.black.withValues(alpha: 0.28),
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (banners.length > 1)
                        Positioned(
                          bottom: 12,
                          left: 0,
                          right: 0,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(
                              banners.length,
                              (index) {
                                final isActive = currentBannerIndex == index;

                                return AnimatedContainer(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut,
                                  margin: const EdgeInsets.symmetric(horizontal: 3),
                                  width: isActive ? 22 : 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? Colors.white
                                        : Colors.white.withValues(alpha: 0.55),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                );
                              },
                            ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const VoucherPage()),
                );
              },
              borderRadius: BorderRadius.circular(18),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF8A50), Color(0xFFE85D36)],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.deepOrange.withValues(alpha: 0.18),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.local_offer,
                      color: Colors.white,
                      size: 38,
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ƯU ĐÃI ĐẶC BIỆT',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          SizedBox(height: 5),
                          Text(
                            'Khám phá voucher và tiết kiệm khi đặt món!',
                            style: TextStyle(color: Colors.white, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.arrow_forward_ios,
                      color: Colors.white,
                      size: 18,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: TextField(
              onChanged: (value) {
                setState(() {
                  searchText = value.toLowerCase().trim();
                });
              },
              decoration: InputDecoration(
                hintText: 'Tìm món ăn yêu thích...',
                prefixIcon: const Icon(Icons.search, color: primaryColor),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
            child: sectionTitle('Danh mục món ăn'),
          ),
        ),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 48,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemCount: categories.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final category = categories[index];
                final selected = selectedCategory == category;

                return ChoiceChip(
                  label: Text(category),
                  selected: selected,
                  onSelected: (_) {
                    setState(() => selectedCategory = category);
                  },
                  selectedColor: primaryColor,
                  backgroundColor: Colors.white,
                  labelStyle: TextStyle(
                    color: selected ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w600,
                  ),
                  side: BorderSide(
                    color: selected ? primaryColor : Colors.black12,
                  ),
                );
              },
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: sectionTitle('Món ngon dành cho bạn'),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          sliver: SliverLayoutBuilder(
            builder: (context, constraints) {
              final width = MediaQuery.sizeOf(context).width;
              final columns = width >= 700 ? 3 : 2;

              final visibleFoods = filteredFoods
                  .where(
                    (food) =>
                        food.name.toLowerCase().contains(searchText) ||
                        food.description.toLowerCase().contains(searchText),
                  )
                  .toList();

              if (isLoadingFoods) {
                return const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                );
              }

              if (foodsError != null) {
                return SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Text('Không tải được món ăn: $foodsError'),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: loadFoods,
                          child: const Text('Thử lại'),
                        ),
                      ],
                    ),
                  ),
                );
              }

              if (visibleFoods.isEmpty) {
                return const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('Không tìm thấy món ăn.')),
                  ),
                );
              }

              return SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => foodCard(visibleFoods[index]),
                  childCount: visibleFoods.length,
                ),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  childAspectRatio: width >= 700 ? 0.95 : 0.72,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  String searchText = '';

  Widget sectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 19,
        fontWeight: FontWeight.bold,
        color: Color(0xFF34251F),
      ),
    );
  }


  Future<void> _showFoodOptionsDialog(Food food) async {
    var noteText = '';

    try {
      final detail = await _foodService.getFoodDetail(food.id);

      if (!mounted) return;

      final rawGroups = detail['optionGroups'] is List
          ? detail['optionGroups'] as List
          : [];

      final optionGroups = rawGroups
          .whereType<Map>()
          .map(
            (group) => FoodOptionGroup.fromJson(
          Map<String, dynamic>.from(group),
        ),
      )
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

      final options = optionGroups
          .expand((group) => group.options)
          .toList();

      final selectedOptions = <String>{};

      for (final option in options) {
        if (option.isDefault) {
          selectedOptions.add(option.id);
        }
      }

      final result = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (dialogContext) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              final extraPrice = options
                  .where((option) => selectedOptions.contains(option.id))
                  .fold<int>(
                0,
                    (sum, option) => sum + option.priceAdjustment,
              );

              return AlertDialog(
                title: Text(food.name),
                content: SizedBox(
                  width: double.maxFinite,
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Giá gốc: ${formatPrice(food.price)}'),

                        for (final group in optionGroups) ...[
                          const SizedBox(height: 16),
                          Text(
                            group.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          ...group.options
                              .where((option) => option.isAvailable)
                              .map((option) {
                            final selectedInGroup = selectedOptions
                                .where(
                                  (id) => group.options.any((item) => item.id == id),
                            )
                                .length;

                            final isSelected = selectedOptions.contains(option.id);

                            if (group.selectionType == 'single') {
                              final selectedId = selectedOptions.firstWhere(
                                    (id) => group.options.any((item) => item.id == id),
                                orElse: () => '',
                              );

                              return RadioGroup<String>(
                                groupValue: selectedId,
                                onChanged: (value) {
                                  if (value == null) return;

                                  setDialogState(() {
                                    selectedOptions.removeWhere(
                                          (id) => group.options.any((item) => item.id == id),
                                    );
                                    selectedOptions.add(value);
                                  });
                                },
                                child: RadioListTile<String>(
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                  value: option.id,
                                  title: Text(option.name),
                                  subtitle: option.priceAdjustment != 0
                                      ? Text(
                                    '${option.priceAdjustment > 0 ? '+' : ''}${formatPrice(option.priceAdjustment)}',
                                  )
                                      : null,
                                ),
                              );
                            }

                            final minimum = group.isRequired && group.minSelect == 0
                                ? 1
                                : group.minSelect;

                            final maximumReached = group.maxSelect != null &&
                                selectedInGroup >= group.maxSelect!;

                            return CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              dense: true,
                              value: isSelected,
                              title: Text(option.name),
                              subtitle: option.priceAdjustment != 0
                                  ? Text(
                                '${option.priceAdjustment > 0 ? '+' : ''}${formatPrice(option.priceAdjustment)}',
                              )
                                  : null,
                              onChanged: (!isSelected && maximumReached) ||
                                  (isSelected && selectedInGroup <= minimum)
                                  ? null
                                  : (checked) {
                                setDialogState(() {
                                  if (checked == true) {
                                    selectedOptions.add(option.id);
                                  } else {
                                    selectedOptions.remove(option.id);
                                  }
                                });
                              },
                            );
                          }),
                        ],

                        const SizedBox(height: 16),
                        const Text(
                          'Ghi chú cho món ăn',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          maxLines: 3,
                          onChanged: (value) {
                            noteText = value;
                          },
                          decoration: const InputDecoration(
                            hintText: 'Ví dụ: ít cay, không hành...',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Đơn giá dự kiến: ${formatPrice(food.price + extraPrice)}',
                          style: const TextStyle(
                            color: primaryColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    child: const Text('Hủy'),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      for (final group in optionGroups) {
                        final availableOptions = group.options
                            .where((option) => option.isAvailable)
                            .toList();

                        final selectedCount = availableOptions
                            .where((option) => selectedOptions.contains(option.id))
                            .length;

                        final minimum = group.isRequired && group.minSelect == 0
                            ? 1
                            : group.minSelect;

                        final maximum = group.selectionType == 'single'
                            ? 1
                            : group.maxSelect;

                        if (selectedCount < minimum) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Vui lòng chọn ít nhất $minimum lựa chọn cho nhóm ${group.name}.',
                              ),
                            ),
                          );
                          return;
                        }

                        if (maximum != null && selectedCount > maximum) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Nhóm ${group.name} chỉ được chọn tối đa $maximum lựa chọn.',
                              ),
                            ),
                          );
                          return;
                        }
                      }

                      Navigator.pop(dialogContext, {
                        'options': options
                            .where(
                              (option) => selectedOptions.contains(option.id),
                        )
                            .toList(),
                        'note': noteText.trim(),
                      });
                    },
                    child: const Text('Thêm vào giỏ'),
                  ),
                ],
              );
            },
          );
        },
      );

      if (result == null || !mounted) return;

      final selected = result['options'] as List<FoodOption>;
      final note = result['note'] as String;

      setState(() {
        _cartService.add(
          food,
          options: selected,
          note: note,
        );

        appliedVoucher = null;
        appliedVoucherCode = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã thêm ${food.name} vào giỏ hàng.'),
          duration: const Duration(seconds: 1),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst('Exception: ', ''),
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
  }


  Widget foodCard(Food food) {
    final quantity = _cartService.quantityOf(food.name);
    final isAdded = quantity > 0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0E6DE)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              color: const Color(0xFFF8EDE2),
              child: food.imageUrl != null && food.imageUrl!.isNotEmpty
                  ? Image.network(
                      food.imageUrl!,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Center(
                        child: Text(
                          food.emoji,
                          style: const TextStyle(fontSize: 62),
                        ),
                      ),
                    )
                  : Center(
                      child: Text(
                        food.emoji,
                        style: const TextStyle(fontSize: 62),
                      ),
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  food.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  food.description,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.black54, fontSize: 11),
                ),
                const SizedBox(height: 6),

                InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => FoodReviewsPage(
                          foodId: food.id,
                          foodName: food.name,
                        ),
                      ),
                    );
                  },
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.star, color: Colors.orange, size: 16),
                      SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Xem đánh giá khách hàng',
                          style: TextStyle(
                            color: primaryColor,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          softWrap: true,
                        ),
                      ),
                      SizedBox(width: 3),
                      Icon(Icons.chevron_right, size: 15, color: primaryColor),
                    ],
                  ),
                ),

                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        formatPrice(food.price),
                        style: const TextStyle(
                          color: primaryColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () {
                        _showFoodOptionsDialog(food);
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: isAdded ? Colors.green : primaryColor,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          isAdded ? Icons.check : Icons.add,
                          color: Colors.white,
                          size: 21,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> applyVoucher() async {
    final code = _voucherController.text.trim();


    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập mã Voucher.')),
      );
      return;
    }


    final items = _cartService.cartItems.map((item) {
      return {
        'foodId': item.food.id,
        'quantity': item.quantity,
        'note': item.note,
        'options': item.options.map((option) {
          return {
            'optionId': option.id,
            'quantity': 1,
          };
        }).toList(),
      };
    }).toList();

    if (items.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Giỏ hàng đang trống.')));
      return;
    }


    setState(() {
      isValidatingVoucher = true;
      appliedVoucher = null;
      appliedVoucherCode = null;
    });

    try {
      final result = await _orderService.validateVoucher(
        voucherCode: code,
        items: items,
      );

      if (!mounted) return;

      setState(() {
        appliedVoucher = result;
        appliedVoucherCode = code.toUpperCase();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Áp dụng Voucher thành công!'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          isValidatingVoucher = false;
        });
      }
    }
  }

  Widget buildCart() {
    final cartItems = _cartService.cartItems;
    final total = cartItems.fold<int>(
      0,
          (sum, item) => sum + item.totalPrice,
    );
    final discount = appliedVoucher == null
        ? 0.0
        : (appliedVoucher!['discountTotal'] as num).toDouble();

    final grandTotal = (total - discount).clamp(0.0, double.infinity);

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          sectionTitle('Giỏ hàng của bạn'),
          const SizedBox(height: 18),
          if (cartItems.isEmpty)
            const Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('🛍️', style: TextStyle(fontSize: 64)),
                    SizedBox(height: 12),
                    Text('Giỏ hàng đang trống'),
                    SizedBox(height: 6),
                    Text(
                      'Hãy chọn món ngon bạn yêu thích nhé!',
                      style: TextStyle(color: Colors.black54),
                    ),
                  ],
                ),
              ),
            )
          else ...[

            Expanded(
              child: ListView.separated(
                itemCount: cartItems.length,
                separatorBuilder: (_, _) => const Divider(height: 24),
                itemBuilder: (context, index) {
                  final item = cartItems[index];
                  final food = item.food;

                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Text(
                      food.emoji,
                      style: const TextStyle(fontSize: 36),
                    ),
                    title: Text(
                      food.name,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Đơn giá: ${formatPrice(item.unitPrice)}'),
                        if (item.options.isNotEmpty) ...[
                          const SizedBox(height: 5),
                          ...item.options.map(
                                (option) => Text(
                              '• ${option.group}: ${option.name}'
                                  '${option.priceAdjustment > 0 ? ' (+${formatPrice(option.priceAdjustment)})' : ''}',
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                        if (item.note.trim().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Ghi chú: ${item.note}',
                            style: const TextStyle(
                              color: Colors.deepOrange,
                              fontSize: 12,
                            ),
                          ),
                        ],
                        const SizedBox(height: 5),
                        Text(
                          'Thành tiền: ${formatPrice(item.totalPrice)}',
                          style: const TextStyle(
                            color: primaryColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () {
                                setState(() {
                                  _cartService.decreaseItem(item);
                                  appliedVoucher = null;
                                  appliedVoucherCode = null;
                                });
                              },
                              icon: const Icon(Icons.remove_circle_outline),
                            ),
                            Text(
                              '${item.quantity}',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () {
                                setState(() {
                                  _cartService.increaseItem(item);
                                  appliedVoucher = null;
                                  appliedVoucherCode = null;
                                });
                              },
                              icon: const Icon(Icons.add_circle_outline),
                            ),
                          ],
                        ),
                      ],
                    ),
                    trailing: IconButton(
                      onPressed: () {
                        setState(() {
                          _cartService.removeItem(item);
                          appliedVoucher = null;
                          appliedVoucherCode = null;
                        });
                      },
                      icon: const Icon(
                        Icons.delete_outline,
                        color: primaryColor,
                      ),
                    ),
                  );
                },
              ),
            ),

            DeliveryInfoCard(
              branch: selectedBranch,
              onBranchChanged: (b) => setState(() => selectedBranch = b),
              address: selectedAddress,
              onChangeAddress: () => setState(() => selectedTab = 3), // tab Tài khoản: thêm/ghim GPS
            ),
            // Khu vực nhập Voucher
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.discount_outlined, color: primaryColor),
                      SizedBox(width: 8),
                      Text(
                        'Mã giảm giá',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _voucherController,
                          textCapitalization: TextCapitalization.characters,
                          enabled: !isValidatingVoucher,
                          decoration: const InputDecoration(
                            hintText: 'Nhập mã Voucher',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: isValidatingVoucher ? null : applyVoucher,
                        style: FilledButton.styleFrom(
                          backgroundColor: primaryColor,
                        ),
                        child: isValidatingVoucher
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Áp dụng'),
                      ),
                    ],
                  ),
                  if (appliedVoucher != null) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Icon(
                          Icons.check_circle,
                          color: Colors.green,
                          size: 18,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Đã áp dụng ${appliedVoucher!['voucherCode']}',
                            style: const TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              appliedVoucher = null;
                              appliedVoucherCode = null;
                              _voucherController.clear();
                            });
                          },
                          child: const Text('Bỏ'),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (appliedVoucher != null)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Giảm giá'),
                  Text(
                    '-${formatPrice((appliedVoucher!['discountTotal'] as num).round())}',
                    style: const TextStyle(
                      color: Colors.green,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),

            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Tạm tính',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(
                  formatPrice(grandTotal.round()),
                  style: const TextStyle(
                    color: primaryColor,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: placeOrder,
                style: FilledButton.styleFrom(
                  backgroundColor: primaryColor,
                  padding: const EdgeInsets.all(16),
                ),
                child: const Text('Tiếp tục đặt hàng'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget buildAccount() {
    return const AccountLoginSection();
  }
}
