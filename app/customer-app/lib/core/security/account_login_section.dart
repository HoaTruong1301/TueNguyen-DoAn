import 'package:flutter/material.dart';
import 'auth_service.dart';
import 'member_service.dart';
import 'address_section.dart';
import '../services/fcm_service.dart';

const Color _accountPrimaryColor = Color(0xFF8B3A25);
const Color _accountBackgroundColor = Color(0xFFFAF7F2);
const Color _accountSurfaceColor = Color(0xFFFFFFFF);
const Color _accountTextColor = Color(0xFF332720);
const Color _accountMutedColor = Color(0xFF8B817A);
const Color _accountBorderColor = Color(0xFFECE3DA);
const Color _accountAccentColor = Color(0xFFF3E7DC);

const double _accountCardRadius = 24;
const double _accountFieldRadius = 14;

InputDecoration accountInputDecoration({
  required String label,
  String? hint,
  required IconData icon,
  Widget? suffixIcon,
}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
    prefixIcon: Icon(icon, color: _accountPrimaryColor),
    suffixIcon: suffixIcon,
    filled: true,
    fillColor: _accountBackgroundColor,
    contentPadding: const EdgeInsets.symmetric(
      horizontal: 16,
      vertical: 18,
    ),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(_accountFieldRadius),
      borderSide: const BorderSide(color: _accountBorderColor),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(_accountFieldRadius),
      borderSide: const BorderSide(color: _accountBorderColor),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(_accountFieldRadius),
      borderSide: const BorderSide(
        color: _accountPrimaryColor,
        width: 1.6,
      ),
    ),
  );
}

class AccountLoginSection extends StatefulWidget {
  const AccountLoginSection({super.key});

  @override
  State<AccountLoginSection> createState() => _AccountLoginSectionState();
}

class _AccountLoginSectionState extends State<AccountLoginSection> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  final registerEmailController = TextEditingController();
  final registerPhoneController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final verificationCodeController = TextEditingController();
  final TextEditingController currentPasswordController =
  TextEditingController();

  final TextEditingController newPasswordController =
  TextEditingController();

  final TextEditingController confirmNewPasswordController =
  TextEditingController();

  String? pendingVerificationUserId;
  String? pendingVerificationIdentifier;
  String? pendingVerificationPassword;

  bool isVerificationMode = false;
  bool isVerifyingEmail = false;
  bool isEmailNotVerified = false;

  final fullNameController = TextEditingController();
  final phoneController = TextEditingController();

  bool isLoadingProfile = false;
  bool isSavingProfile = false;
  String? profileMessage;
  String? profileError;

  bool isLoading = false;
  bool isLoggedIn = false;
  bool isRegisterMode = false;
  bool isResendingVerification = false;
  bool isChangingPassword = false;
  bool isCurrentPasswordVisible = false;
  bool isNewPasswordVisible = false;
  bool isConfirmPasswordVisible = false;

  bool obscurePassword = true;
  bool obscureConfirmPassword = true;
  String? errorMessage;
  String? successMessage;
  Map<String, dynamic>? user;

  @override
  void initState() {
    super.initState();
    checkLogin();
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();

    registerEmailController.dispose();
    registerPhoneController.dispose();
    confirmPasswordController.dispose();
    verificationCodeController.dispose();

    fullNameController.dispose();
    phoneController.dispose();

    super.dispose();
  }

  Future<void> loadProfile() async {
    setState(() {
      isLoadingProfile = true;
      profileError = null;
      profileMessage = null;
    });

    try {
      final profile = await MemberService.getMyProfile();

      if (!mounted) return;

      setState(() {
        user = {...?user, ...profile};

        fullNameController.text =
            profile['full_name']?.toString() ??
                profile['fullName']?.toString() ??
                '';

        phoneController.text =
            profile['phone_number']?.toString() ??
                profile['phoneNumber']?.toString() ??
                '';

        isLoadingProfile = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        profileError = e.toString().replaceFirst('Exception: ', '');
        isLoadingProfile = false;
      });
    }
  }

  Future<void> saveProfile() async {
    if (fullNameController.text
        .trim()
        .isEmpty) {
      setState(() {
        profileError = 'Vui lòng nhập họ và tên.';
        profileMessage = null;
      });
      return;
    }

    if (phoneController.text
        .trim()
        .isEmpty) {
      setState(() {
        profileError = 'Vui lòng nhập số điện thoại.';
        profileMessage = null;
      });
      return;
    }

    setState(() {
      isSavingProfile = true;
      profileError = null;
      profileMessage = null;
    });

    try {
      final profile = await MemberService.updateMyProfile(
        fullName: fullNameController.text,
        phoneNumber: phoneController.text,
      );

      if (!mounted) return;

      setState(() {
        fullNameController.text =
            profile['full_name']?.toString() ??
                profile['fullName']?.toString() ??
                fullNameController.text;

        phoneController.text =
            profile['phone_number']?.toString() ??
                profile['phoneNumber']?.toString() ??
                phoneController.text;

        profileMessage = 'Cập nhật hồ sơ thành công!';
        isSavingProfile = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        profileError = e.toString().replaceFirst('Exception: ', '');
        isSavingProfile = false;
      });
    }
  }

  Future<void> checkLogin() async {
    try {
      final token = await AuthService.getAccessToken();

      if (!mounted) return;

      if (token != null && token.isNotEmpty) {
        setState(() {
          isLoggedIn = true;
        });

        await loadProfile();
        await FcmService.onUserLoggedIn();
      }
    } catch (_) {
      // Chưa có token đăng nhập được lưu.
    }
  }

  Future<void> register() async {
    final email = registerEmailController.text.trim();
    final phone = registerPhoneController.text.trim();
    final password = passwordController.text;
    final confirmPassword = confirmPasswordController.text;

    if (email.isEmpty && phone.isEmpty) {
      setState(() {
        errorMessage = 'Vui lòng nhập email hoặc số điện thoại.';
        successMessage = null;
      });
      return;
    }

    if (password.length < 8) {
      setState(() {
        errorMessage = 'Mật khẩu phải có ít nhất 8 ký tự.';
        successMessage = null;
      });
      return;
    }

    if (password != confirmPassword) {
      setState(() {
        errorMessage = 'Mật khẩu xác nhận không khớp.';
        successMessage = null;
      });
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final result = await AuthService.register(
        email: email.isEmpty ? null : email,
        phone: phone.isEmpty ? null : phone,
        password: password,
        confirmPassword: confirmPassword,
      );

      final registeredUser = result['user'];
      final userId = registeredUser is Map
          ? registeredUser['id']?.toString()
          : null;

      final emailSent = result['emailSent'] == true;

      if (!mounted) return;

      setState(() {
        isLoading = false;
        isRegisterMode = false;

        emailController.text = email;
        registerEmailController.clear();
        registerPhoneController.clear();
        passwordController.clear();
        confirmPasswordController.clear();

        if (email.isNotEmpty && userId != null) {
          pendingVerificationUserId = userId;
          pendingVerificationIdentifier = email;
          pendingVerificationPassword = password;
          isVerificationMode = true;
          verificationCodeController.clear();

          successMessage = emailSent
              ? 'Mã xác minh đã được gửi đến $email.'
              : 'Đăng ký thành công nhưng email chưa gửi được. Bạn hãy bấm gửi lại mã xác minh.';
        } else {
          isVerificationMode = false;
          pendingVerificationUserId = null;
          pendingVerificationIdentifier = null;
          pendingVerificationPassword = null;
          successMessage = email.isNotEmpty
              ? 'Đăng ký thành công nhưng email chưa gửi được. Bạn có thể đăng nhập và gửi lại mã.'
              : 'Đăng ký thành công. Bạn có thể đăng nhập.';
        }
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        errorMessage = e.toString().replaceFirst('Exception: ', '');
        isLoading = false;
      });
    }
  }

  Future<void> verifyEmail() async {
    final code = verificationCodeController.text.trim();

    if (pendingVerificationUserId == null) {
      setState(() {
        errorMessage = 'Không tìm thấy thông tin tài khoản cần xác minh.';
      });
      return;
    }

    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() {
        errorMessage = 'Vui lòng nhập mã xác minh gồm 6 chữ số.';
        successMessage = null;
      });
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
      isEmailNotVerified = false;
    });

    try {
      await AuthService.verifyEmail(
        userId: pendingVerificationUserId!,
        token: code,
      );

      if (!mounted) return;

      setState(() {
        isVerifyingEmail = false;
        isVerificationMode = false;
        pendingVerificationUserId = null;
        pendingVerificationIdentifier = null;
        pendingVerificationPassword = null;
        verificationCodeController.clear();

        successMessage = 'Xác minh email thành công! Bạn có thể đăng nhập.';
        errorMessage = null;
      });
    } catch (e) {
      if (!mounted) return;

      final message = e.toString().replaceFirst('Exception: ', '');

      setState(() {
        isVerifyingEmail = false;

        switch (message) {
          case 'VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED':
            errorMessage =
            'Bạn đã nhập sai mã xác minh 5 lần. '
                'Mã đã bị khóa. Vui lòng yêu cầu gửi mã mới.';

          case 'VERIFICATION_TOKEN_INVALID':
            errorMessage = 'Mã xác minh không chính xác. Vui lòng thử lại.';

          case 'VERIFICATION_TOKEN_EXPIRED':
          case 'VERIFICATION_TOKEN_REVOKED':
          case 'VERIFICATION_TOKEN_USED':
          case 'VERIFICATION_TOKEN_NOT_FOUND':
            errorMessage =
            'Mã xác minh không còn hiệu lực. Vui lòng yêu cầu mã mới.';

          default:
            errorMessage = message;
        }
      });
    }
  }

  String getResendVerificationError(dynamic error) {
    final message = error.toString().replaceFirst('Exception: ', '');

    switch (message) {
      case 'OTP_RESEND_TOO_SOON':
        return 'Vui lòng chờ đủ 60 giây trước khi gửi lại mã.';

      case 'OTP_RESEND_LIMIT_EXCEEDED':
        return 'Bạn đã gửi tối đa 5 mã trong một giờ. Vui lòng thử lại sau.';

      default:
        return message;
    }
  }

  Future<void> resendPendingVerification() async {
    final identifier = pendingVerificationIdentifier;
    final password = pendingVerificationPassword;

    if (identifier == null || password == null) {
      setState(() {
        errorMessage = 'Không tìm thấy thông tin đăng nhập để gửi lại mã.';
      });
      return;
    }

    setState(() {
      isResendingVerification = true;
      errorMessage = null;
      successMessage = null;
    });

    try {
      final result =
      await AuthService.resendVerificationWithPassword(
        identifier: identifier,
        password: password,
      );

      if (!mounted) return;

      setState(() {
        isResendingVerification = false;

        successMessage = result['emailSent'] == true
            ? 'Mã xác minh mới đã được gửi đến ${result['email']}.'
            : 'Chưa gửi được email. Vui lòng thử lại sau.';
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        isResendingVerification = false;
        errorMessage = getResendVerificationError(e);
      });
    }
  }

  Future<void> resendLoginVerification() async {
    final identifier = emailController.text.trim();
    final password = passwordController.text;

    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        errorMessage = 'Vui lòng nhập email hoặc số điện thoại và mật khẩu.';
      });
      return;
    }

    setState(() {
      isResendingVerification = true;
      errorMessage = null;
      successMessage = null;
    });

    try {
      final result =
      await AuthService.resendVerificationWithPassword(
        identifier: identifier,
        password: password,
      );

      if (!mounted) return;

      final userId = result['userId']?.toString();
      final emailSent = result['emailSent'] == true;

      if (userId == null || userId.isEmpty) {
        throw Exception('Không nhận được thông tin tài khoản.');
      }

      setState(() {
        pendingVerificationUserId = userId;
        pendingVerificationIdentifier = identifier;
        pendingVerificationPassword = password;
        verificationCodeController.clear();

        isResendingVerification = false;
        isEmailNotVerified = false;
        isVerificationMode = true;

        successMessage = emailSent
            ? 'Mã xác minh đã được gửi đến email của bạn.'
            : 'Chưa gửi được email. Vui lòng thử gửi lại sau.';
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        isResendingVerification = false;
        errorMessage = getResendVerificationError(e);
      });
    }
  }

  Future<void> login() async {
    final identifier = emailController.text.trim();
    final password = passwordController.text;

    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        errorMessage = 'Vui lòng nhập email hoặc số điện thoại và mật khẩu.';
      });
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
      isEmailNotVerified = false;
    });

    try {
      final result = await AuthService.login(
        identifier: identifier,
        password: password,
      );

      if (!mounted) return;

      setState(() {
        user = result;
        isLoggedIn = true;
        isLoading = false;
      });

      await loadProfile();
      await FcmService.onUserLoggedIn();
    } catch (e) {
      if (!mounted) return;

      final message = e.toString().replaceFirst('Exception: ', '');

      debugPrint('LOGIN ERROR: $message');

      setState(() {
        if (message == 'ACCOUNT_TEMPORARILY_LOCKED') {
          errorMessage =
          'Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần. '
              'Vui lòng thử lại sau 15 phút.';
        } else {
          errorMessage = message;
        }

        isEmailNotVerified = message == 'EMAIL_NOT_VERIFIED';
        isLoading = false;
      });
    }
  }

  Future<void> resendVerification() async {
    setState(() {
      isResendingVerification = true;
      profileError = null;
      profileMessage = null;
    });

    try {
      final result = await AuthService.resendVerification();

      if (!mounted) return;

      final emailSent = result['emailSent'] == true;

      setState(() {
        isResendingVerification = false;

        if (emailSent) {
          profileMessage =
          'Mã xác minh đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.';
        } else {
          profileError = 'Backend chưa gửi được email. Vui lòng thử lại sau.';
        }
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        isResendingVerification = false;
        profileError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }


  Future<void> changePassword() async {
    final currentPassword = currentPasswordController.text;
    final newPassword = newPasswordController.text;
    final confirmPassword = confirmNewPasswordController.text;

    if (currentPassword.isEmpty ||
        newPassword.isEmpty ||
        confirmPassword.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập đầy đủ thông tin.'),
        ),
      );
      return;
    }

    if (newPassword.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mật khẩu mới phải có ít nhất 8 ký tự.'),
        ),
      );
      return;
    }

    if (newPassword != confirmPassword) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Xác nhận mật khẩu mới không khớp.'),
        ),
      );
      return;
    }

    if (currentPassword == newPassword) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mật khẩu mới phải khác mật khẩu hiện tại.'),
        ),
      );
      return;
    }

    setState(() => isChangingPassword = true);

    try {
      await AuthService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      if (!mounted) return;

      currentPasswordController.clear();
      newPasswordController.clear();
      confirmNewPasswordController.clear();

      Navigator.of(context).pop();

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đổi mật khẩu thành công.'),
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
        setState(() => isChangingPassword = false);
      }
    }
  }

  Future<void> showChangePasswordDialog() async {
    currentPasswordController.clear();
    newPasswordController.clear();
    confirmNewPasswordController.clear();

    await showDialog(
      context: context,
      barrierDismissible: !isChangingPassword,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Widget passwordField({
              required String label,
              required TextEditingController controller,
              required bool visible,
              required VoidCallback onToggle,
            }) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: TextField(
                  controller: controller,
                  obscureText: !visible,
                  decoration: accountInputDecoration(
                    label: label,
                    icon: Icons.lock_outline_rounded,
                    suffixIcon: IconButton(
                      onPressed: onToggle,
                      icon: Icon(
                        visible
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                    ),
                  ),
                ),
              );
            }

            return AlertDialog(
              backgroundColor: _accountSurfaceColor,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              title: const Text(
                'Đổi mật khẩu',
                style: TextStyle(
                  color: _accountPrimaryColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Vui lòng nhập mật khẩu hiện tại và thiết lập mật khẩu mới.',
                      style: TextStyle(
                        color: _accountMutedColor,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 20),
                    passwordField(
                      label: 'Mật khẩu hiện tại',
                      controller: currentPasswordController,
                      visible: isCurrentPasswordVisible,
                      onToggle: () {
                        setDialogState(() {
                          isCurrentPasswordVisible =
                          !isCurrentPasswordVisible;
                        });
                      },
                    ),
                    passwordField(
                      label: 'Mật khẩu mới',
                      controller: newPasswordController,
                      visible: isNewPasswordVisible,
                      onToggle: () {
                        setDialogState(() {
                          isNewPasswordVisible = !isNewPasswordVisible;
                        });
                      },
                    ),
                    passwordField(
                      label: 'Xác nhận mật khẩu mới',
                      controller: confirmNewPasswordController,
                      visible: isConfirmPasswordVisible,
                      onToggle: () {
                        setDialogState(() {
                          isConfirmPasswordVisible =
                          !isConfirmPasswordVisible;
                        });
                      },
                    ),
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Mật khẩu mới cần có ít nhất 8 ký tự.',
                        style: TextStyle(
                          color: _accountMutedColor,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              actions: [
                TextButton(
                  onPressed: isChangingPassword
                      ? null
                      : () => Navigator.pop(dialogContext),
                  child: const Text(
                    'Hủy',
                    style: TextStyle(color: _accountMutedColor),
                  ),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _accountPrimaryColor,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: isChangingPassword
                      ? null
                      : () async {
                    setState(() => isChangingPassword = true);
                    setDialogState(() {});

                    await changePassword();

                    if (mounted) {
                      setDialogState(() {});
                    }
                  },
                  child: isChangingPassword
                      ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                      : const Text('Xác nhận đổi'),
                ),
              ],
            );
          },
        );
      },
    );
  }



  Future<void> logout() async {
    setState(() {
      isLoading = true;
    });

    try {
      await AuthService.logout();
      await FcmService.onUserLoggedOut();
    } catch (_) {
      // Tiếp tục cập nhật giao diện nếu xảy ra lỗi.
    }

    if (!mounted) return;

    setState(() {
      isLoggedIn = false;
      isLoading = false;
      user = null;
      passwordController.clear();
    });
  }

  Widget _buildAccountCard({
    required Widget child,
    EdgeInsets padding = const EdgeInsets.all(28),
  }) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: _accountSurfaceColor,
        borderRadius: BorderRadius.circular(_accountCardRadius),
        border: Border.all(color: _accountBorderColor),
        boxShadow: [
          BoxShadow(
            color: _accountPrimaryColor.withValues(alpha: 0.07),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _buildAccountHeader({
    required String title,
    required String subtitle,
  }) {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 15,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Image.asset(
              'assets/images/logo.png',
              fit: BoxFit.contain,
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 23,
            fontWeight: FontWeight.bold,
            color: _accountTextColor,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 13,
            height: 1.5,
            color: _accountMutedColor,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (isVerificationMode) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const CircleAvatar(
                  radius: 42,
                  backgroundColor: Color(0xFFF0DCCF),
                  child: Icon(
                    Icons.mark_email_unread_outlined,
                    size: 48,
                    color: _accountPrimaryColor,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Xác minh email',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Chúng tôi đã gửi mã xác minh đến ${registerEmailController
                      .text
                      .trim()
                      .isNotEmpty
                      ? registerEmailController.text.trim()
                      : emailController.text
                      .trim()}. Vui lòng kiểm tra hộp thư và nhập mã gồm 6 chữ số.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: verificationCodeController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 24,
                    letterSpacing: 8,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Mã xác minh',
                    hintText: '000000',
                    border: OutlineInputBorder(),
                    counterText: '',
                  ),
                  onSubmitted: (_) {
                    if (!isVerifyingEmail) verifyEmail();
                  },
                ),
                if (errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    errorMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red),
                  ),
                ],
                if (successMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    successMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.green),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: isVerifyingEmail ? null : verifyEmail,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      isVerifyingEmail
                          ? 'Đang xác minh...'
                          : 'Xác minh email',
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: isResendingVerification
                      ? null
                      : resendPendingVerification,
                  icon: const Icon(Icons.mark_email_unread_outlined),
                  label: Text(
                    isResendingVerification
                        ? 'Đang gửi mã...'
                        : 'Gửi lại mã xác minh',
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: isVerifyingEmail
                      ? null
                      : () {
                    setState(() {
                      isVerificationMode = false;
                      pendingVerificationUserId = null;
                      pendingVerificationIdentifier = null;
                      pendingVerificationPassword = null;
                      verificationCodeController.clear();
                      errorMessage = null;
                      successMessage =
                      'Bạn có thể đăng nhập và gửi lại mã xác minh nếu cần.';
                    });
                  },
                  child: const Text('Quay lại đăng nhập'),
                ),
              ],
            ),
          ),
        ),
      );
    }



    if (isLoggedIn) {
      return Container(
        color: _accountBackgroundColor,
        width: double.infinity,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: _buildAccountCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildAccountHeader(
                      title: 'Hồ sơ khách hàng',
                      subtitle: 'Quản lý thông tin cá nhân và địa chỉ giao hàng của bạn.',
                    ),

                    const SizedBox(height: 24),

                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _accountAccentColor,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const CircleAvatar(
                            radius: 25,
                            backgroundColor: _accountPrimaryColor,
                            child: Icon(
                              Icons.person_rounded,
                              size: 28,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Tài khoản của bạn',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: _accountTextColor,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  user?['email']?.toString() ??
                                      user?['phone']?.toString() ??
                                      '',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: _accountMutedColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.verified_user_outlined,
                            color: _accountPrimaryColor,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 26),

                    const Text(
                      'THÔNG TIN CÁ NHÂN',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                        color: _accountMutedColor,
                      ),
                    ),

                    const SizedBox(height: 14),

                    TextField(
                      controller: fullNameController,
                      decoration: accountInputDecoration(
                        label: 'Họ và tên',
                        hint: 'Nhập họ và tên của bạn',
                        icon: Icons.person_outline_rounded,
                      ),
                    ),

                    const SizedBox(height: 16),

                    TextField(
                      controller: phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: accountInputDecoration(
                        label: 'Số điện thoại',
                        hint: 'Nhập số điện thoại',
                        icon: Icons.phone_outlined,
                      ),
                    ),

                    if (profileError != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFEEEE),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline,
                              color: Colors.red,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                profileError!,
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    if (profileMessage != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEAF5EA),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.check_circle_outline,
                              color: Colors.green,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                profileMessage!,
                                style: const TextStyle(
                                  color: Colors.green,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 22),

                    SizedBox(
                      height: 52,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: _accountPrimaryColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        onPressed: isSavingProfile || isLoadingProfile
                            ? null
                            : saveProfile,
                        icon: isSavingProfile
                            ? const SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                            : const Icon(Icons.save_outlined),
                        label: Text(
                          isSavingProfile ? 'Đang lưu...' : 'Lưu thông tin',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 10),

                    OutlinedButton.icon(
                      onPressed: isLoadingProfile ? null : loadProfile,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Tải lại hồ sơ'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _accountPrimaryColor,
                        side: const BorderSide(color: _accountBorderColor),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),
                    const Divider(color: _accountBorderColor),
                    const SizedBox(height: 18),

                    const Text(
                      'TIỆN ÍCH TÀI KHOẢN',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                        color: _accountMutedColor,
                      ),
                    ),

                    const SizedBox(height: 14),


                    OutlinedButton.icon(
                      onPressed: isChangingPassword
                          ? null
                          : showChangePasswordDialog,
                      icon: const Icon(Icons.lock_reset_rounded),
                      label: const Text('Đổi mật khẩu'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _accountPrimaryColor,
                        side: const BorderSide(color: _accountBorderColor),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 14,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),


                    const SizedBox(height: 10),

                    OutlinedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const AddressSection(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.location_on_outlined),
                      label: const Text('Quản lý địa chỉ giao hàng'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _accountPrimaryColor,
                        side: const BorderSide(color: _accountBorderColor),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),

                    const SizedBox(height: 22),

                    OutlinedButton.icon(
                      onPressed: isLoading ? null : logout,
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Đăng xuất tài khoản'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red.shade700,
                        side: BorderSide(
                          color: Colors.red.shade200,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }



    return Container(
      color: _accountBackgroundColor,
      width: double.infinity,
      height: double.infinity,
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: _buildAccountCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildAccountHeader(
                    title: isRegisterMode
                        ? 'Tạo tài khoản'
                        : 'Chào mừng trở lại',
                    subtitle: isRegisterMode
                        ? 'Đăng ký thành viên Tuệ Nguyên để trải nghiệm dịch vụ tốt hơn.'
                        : 'Đăng nhập để quản lý tài khoản và đơn hàng của bạn.',
                  ),

                  const SizedBox(height: 30),

                  if (isRegisterMode) ...[
                    TextField(
                      controller: registerEmailController,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: accountInputDecoration(
                        label: 'Email (không bắt buộc)',
                        hint: 'Nhập địa chỉ email',
                        icon: Icons.email_outlined,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: registerPhoneController,
                      keyboardType: TextInputType.phone,
                      decoration: accountInputDecoration(
                        label: 'Số điện thoại (không bắt buộc)',
                        hint: 'Nhập số điện thoại',
                        icon: Icons.phone_outlined,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Bạn cần cung cấp email hoặc số điện thoại.',
                      style: TextStyle(
                        fontSize: 12,
                        color: _accountMutedColor,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ] else
                    ...[
                      TextField(
                        controller: emailController,
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        decoration: accountInputDecoration(
                          label: 'Email hoặc số điện thoại',
                          hint: 'Nhập email hoặc số điện thoại',
                          icon: Icons.person_outline,
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                  TextField(
                    controller: passwordController,
                    obscureText: obscurePassword,
                    decoration: accountInputDecoration(
                      label: 'Mật khẩu',
                      icon: Icons.lock_outline,
                      suffixIcon: IconButton(
                        onPressed: () {
                          setState(() {
                            obscurePassword = !obscurePassword;
                          });
                        },
                        icon: Icon(
                          obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                  ),

                  if (isRegisterMode) ...[
                    const SizedBox(height: 16),
                    TextField(
                      controller: confirmPasswordController,
                      obscureText: obscureConfirmPassword,
                      onSubmitted: (_) {
                        if (!isLoading) register();
                      },
                      decoration: accountInputDecoration(
                        label: 'Xác nhận mật khẩu',
                        icon: Icons.verified_user_outlined,
                        suffixIcon: IconButton(
                          onPressed: () {
                            setState(() {
                              obscureConfirmPassword =
                              !obscureConfirmPassword;
                            });
                          },
                          icon: Icon(
                            obscureConfirmPassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                    ),
                  ] else
                    ...[
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          'Bảo mật tài khoản của bạn',
                          style: TextStyle(
                            fontSize: 12,
                            color: _accountMutedColor,
                          ),
                        ),
                      ),
                    ],

                  if (errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEEEE),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline,
                            color: Colors.red,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              errorMessage!,
                              style: const TextStyle(
                                color: Colors.red,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  if (isEmailNotVerified && !isRegisterMode) ...[
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: isResendingVerification
                          ? null
                          : resendLoginVerification,
                      icon: const Icon(
                        Icons.mark_email_unread_outlined,
                      ),
                      label: Text(
                        isResendingVerification
                            ? 'Đang gửi mã...'
                            : 'Gửi lại mã xác minh',
                      ),
                    ),
                  ],

                  if (successMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEAF5EA),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.check_circle_outline,
                            color: Colors.green,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              successMessage!,
                              style: const TextStyle(
                                color: Colors.green,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 26),

                  SizedBox(
                    height: 54,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: _accountPrimaryColor,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 2,
                      ),
                      onPressed: isLoading
                          ? null
                          : (isRegisterMode ? register : login),
                      child: isLoading
                          ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                          : Text(
                        isRegisterMode
                            ? 'TẠO TÀI KHOẢN'
                            : 'ĐĂNG NHẬP',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),

                  Row(
                    children: [
                      const Expanded(
                        child: Divider(color: _accountBorderColor),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'HOẶC',
                          style: TextStyle(
                            fontSize: 11,
                            color: _accountMutedColor,
                          ),
                        ),
                      ),
                      const Expanded(
                        child: Divider(color: _accountBorderColor),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  TextButton(
                    onPressed: isLoading
                        ? null
                        : () {
                      setState(() {
                        isRegisterMode = !isRegisterMode;
                        errorMessage = null;
                        successMessage = null;
                        passwordController.clear();
                        confirmPasswordController.clear();
                      });
                    },
                    child: Text(
                      isRegisterMode
                          ? 'Đã có tài khoản? Đăng nhập'
                          : 'Chưa có tài khoản? Đăng ký ngay',
                      style: const TextStyle(
                        color: _accountPrimaryColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}