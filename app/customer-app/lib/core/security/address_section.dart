import 'package:flutter/material.dart';
import 'address_service.dart';
import 'address_map_picker.dart';

const Color _addressPrimaryColor = Color(0xFF8B3A25);

class AddressSection extends StatefulWidget {
  const AddressSection({super.key});

  @override
  State<AddressSection> createState() => _AddressSectionState();
}

class _AddressSectionState extends State<AddressSection> {
  List<Map<String, dynamic>> addresses = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    loadAddresses();
  }

  Future<void> loadAddresses() async {
    if (!mounted) return;
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final result = await AddressService.getAddresses();
      if (!mounted) return;

      setState(() {
        addresses = result;
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

  Future<void> addAddress() async {
    FocusScope.of(context).unfocus();
    final bool? success = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      useRootNavigator: false,
      builder: (ctx) => AddAddressDialog(isFirst: addresses.isEmpty),
    );

    if (success == true && mounted) {
      await loadAddresses();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã thêm địa chỉ thành công.')),
        );
      }
    }
  }

  String _addressText(Map<String, dynamic> address) {
    final parts =
        [
              address['address_line'] ?? address['addressLine'],
              address['ward'],
              address['district'],
              address['province'],
            ]
            .where((part) => part != null && part.toString().trim().isNotEmpty)
            .map((part) => part.toString())
            .toList();

    return parts.join(', ');
  }

  Future<void> setDefault(Map<String, dynamic> address) async {
    final id = address['id']?.toString();
    if (id == null || id.isEmpty) return;

    try {
      await AddressService.setDefaultAddress(id);
      if (!mounted) return;
      await loadAddresses();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> deleteAddress(Map<String, dynamic> address) async {
    final id = address['id']?.toString();
    if (id == null || id.isEmpty) return;

    FocusScope.of(context).unfocus();
    final confirmed = await showDialog<bool>(
      context: context,
      useRootNavigator: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa địa chỉ?'),
        content: const Text('Bạn có chắc chắn muốn xóa địa chỉ này không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Giữ lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await AddressService.deleteAddress(id);
      await loadAddresses();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Đã xóa địa chỉ.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF9F3),
      appBar: AppBar(
        title: const Text('Địa chỉ giao hàng'),
        backgroundColor: const Color(0xFFFFF9F3),
        centerTitle: true,
      ),
      body: RefreshIndicator(onRefresh: loadAddresses, child: _buildBody()),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: isLoading ? null : addAddress,
        backgroundColor: _addressPrimaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Thêm địa chỉ'),
      ),
    );
  }

  Widget _buildBody() {
    if (isLoading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 220),
          Center(child: CircularProgressIndicator(color: _addressPrimaryColor)),
        ],
      );
    }

    if (errorMessage != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 100),
          Text(errorMessage!, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          Center(
            child: FilledButton(
              onPressed: loadAddresses,
              child: const Text('Thử lại'),
            ),
          ),
        ],
      );
    }

    if (addresses.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: const [
          SizedBox(height: 90),
          Icon(
            Icons.location_on_outlined,
            size: 64,
            color: _addressPrimaryColor,
          ),
          SizedBox(height: 16),
          Text('Bạn chưa có địa chỉ giao hàng', textAlign: TextAlign.center),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: addresses.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final address = addresses[index];
        final isDefault =
            address['is_default'] == true || address['isDefault'] == true;

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFF0E6DE)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.location_on,
                      color: _addressPrimaryColor,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        address['recipient_name']?.toString() ??
                            address['recipientName']?.toString() ??
                            'Người nhận',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    if (isDefault)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: _addressPrimaryColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Mặc định',
                          style: TextStyle(
                            fontSize: 10,
                            color: _addressPrimaryColor,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  address['phone']?.toString() ?? '',
                  style: const TextStyle(color: Colors.black87),
                ),
                const SizedBox(height: 4),
                Text(
                  _addressText(address),
                  style: const TextStyle(color: Colors.black54, fontSize: 13),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (!isDefault)
                      TextButton(
                        onPressed: () => setDefault(address),
                        child: const Text('Đặt mặc định'),
                      ),
                    IconButton(
                      onPressed: () => deleteAddress(address),
                      icon: const Icon(
                        Icons.delete_outline,
                        color: Colors.redAccent,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class AddAddressDialog extends StatefulWidget {
  final bool isFirst;
  const AddAddressDialog({super.key, required this.isFirst});

  @override
  State<AddAddressDialog> createState() => _AddAddressDialogState();
}

class _AddAddressDialogState extends State<AddAddressDialog> {
  final _formKey = GlobalKey<FormState>();
  final _recipientController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _wardController = TextEditingController();
  final _districtController = TextEditingController();
  final _provinceController = TextEditingController();
  late bool _makeDefault;
  bool _isSaving = false;
  double? _latitude;
  double? _longitude;

  @override
  void initState() {
    super.initState();
    _makeDefault = widget.isFirst;
  }

  @override
  void dispose() {
    _recipientController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _wardController.dispose();
    _districtController.dispose();
    _provinceController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    if (_latitude == null || _longitude == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng chọn vị trí giao hàng trên bản đồ.'),
        ),
      );
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _isSaving = true);

    try {
      await AddressService.createAddress(
        recipientName: _recipientController.text,
        phone: _phoneController.text,
        addressLine: _addressController.text,
        latitude: _latitude!,
        longitude: _longitude!,
        ward: _wardController.text,
        district: _districtController.text,
        province: _provinceController.text,
        isDefault: _makeDefault,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Thêm địa chỉ giao hàng'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildField(_recipientController, 'Tên người nhận', true),
                _buildField(
                  _phoneController,
                  'Số điện thoại',
                  true,
                  type: TextInputType.phone,
                ),
                _buildField(
                  _addressController,
                  'Địa chỉ cụ thể (số nhà, đường)',
                  true,
                ),
                _buildField(_wardController, 'Phường / xã', false),
                _buildField(_districtController, 'Quận / huyện', false),
                _buildField(_provinceController, 'Tỉnh / thành phố', false),

                const SizedBox(height: 8),

                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.location_on),
                    label: Text(
                      _latitude == null
                          ? 'Chọn vị trí giao hàng trên bản đồ'
                          : 'Đã chọn vị trí giao hàng',
                    ),
                    onPressed: () async {
                      final result = await Navigator.push<Map<String, dynamic>>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => AddressMapPicker(
                            initialLatitude: _latitude,
                            initialLongitude: _longitude,
                          ),
                        ),
                      );

                      if (result == null || !mounted) return;

                      setState(() {
                        _latitude = (result['latitude'] as num).toDouble();
                        _longitude = (result['longitude'] as num).toDouble();
                      });
                    },
                  ),
                ),

                if (_latitude != null && _longitude != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Vĩ độ: ${_latitude!.toStringAsFixed(7)}\n'
                    'Kinh độ: ${_longitude!.toStringAsFixed(7)}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12),
                  ),
                ],

                const SizedBox(height: 12),

                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _makeDefault,
                  title: const Text(
                    'Đặt làm địa chỉ mặc định',
                    style: TextStyle(fontSize: 14),
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  onChanged: (v) => setState(() => _makeDefault = v ?? false),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: _isSaving ? null : _save,
          style: FilledButton.styleFrom(backgroundColor: _addressPrimaryColor),
          child: Text(_isSaving ? 'Đang lưu...' : 'Lưu địa chỉ'),
        ),
      ],
    );
  }

  Widget _buildField(
    TextEditingController ctrl,
    String label,
    bool req, {
    TextInputType? type,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: type,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        validator: (v) => (req && (v == null || v.trim().isEmpty))
            ? 'Vui lòng nhập $label'
            : null,
      ),
    );
  }
}
