import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, this.redirectTo});

  final String? redirectTo;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLogin = true;
  final _email = TextEditingController();
  final _mpin = TextEditingController();
  final _confirmMpin = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  final _ref = TextEditingController();
  final _loginKey = GlobalKey<FormState>();
  final _regKey = GlobalKey<FormState>();
  bool _loading = false;
  bool _otpSent = false;
  bool _obscureMpin = true;

  @override
  void dispose() {
    _email.dispose();
    _mpin.dispose();
    _confirmMpin.dispose();
    _name.dispose();
    _phone.dispose();
    _otp.dispose();
    _ref.dispose();
    super.dispose();
  }

  void _switchTab(bool login) {
    setState(() {
      _isLogin = login;
      _otpSent = false;
      context.read<AuthProvider>().clearError();
    });
  }

  Future<void> _login() async {
    if (!(_loginKey.currentState?.validate() ?? false)) return;
    setState(() => _loading = true);
    final ok = await context.read<AuthProvider>().login(_email.text, _mpin.text);
    if (!mounted) return;
    if (ok) {
      await context.read<CatalogProvider>().load();
      if (!mounted) return;
      setState(() => _loading = false);
      context.go(widget.redirectTo ?? '/app');
    } else {
      setState(() => _loading = false);
      _toast(context.read<AuthProvider>().error, error: true);
    }
  }

  Future<void> _signup() async {
    if (!(_regKey.currentState?.validate() ?? false)) return;
    if (_mpin.text != _confirmMpin.text) {
      _toast('MPINs do not match', error: true);
      return;
    }
    final auth = context.read<AuthProvider>();
    setState(() => _loading = true);

    if (!_otpSent) {
      final sent = await auth.sendSignupOtp(_email.text);
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (sent) _otpSent = true;
      });
      if (sent) {
        _toast('OTP sent to ${_email.text}');
      } else {
        _toast(auth.error, error: true);
      }
      return;
    }

    final verified = await auth.verifyOtp(_email.text, _otp.text);
    if (!verified) {
      if (!mounted) return;
      setState(() => _loading = false);
      _toast(auth.error, error: true);
      return;
    }

    final ok = await auth.register(
      name: _name.text,
      email: _email.text,
      phone: _phone.text,
      mpin: _mpin.text,
      referralCode: _ref.text,
    );
    if (!mounted) return;
    if (ok) {
      await context.read<CatalogProvider>().load();
      if (!mounted) return;
      setState(() => _loading = false);
      context.go(widget.redirectTo ?? '/app');
    } else {
      setState(() => _loading = false);
      _toast(auth.error, error: true);
    }
  }

  void _toast(String? msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg ?? 'Something went wrong'),
        backgroundColor: error ? GuColors.danger : GuColors.limeDark,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final h = MediaQuery.sizeOf(context).height;

    return GuPageBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: IconButton(
            onPressed: () => context.canPop() ? context.pop() : context.go('/app'),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        body: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 24 + bottomInset),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 24),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Column(
                      mainAxisAlignment: h < 700 ? MainAxisAlignment.start : MainAxisAlignment.center,
                      children: [
                        _AuthHeader(compact: h < 720).guFadeSlide(),
                        const SizedBox(height: 20),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(18, 16, 18, 20),
                          decoration: BoxDecoration(
                            color: GuColors.surface,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: GuColors.border),
                            boxShadow: GuColors.softCard,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _AuthTabs(isLogin: _isLogin, onChanged: _switchTab),
                              const SizedBox(height: 18),
                              AnimatedSwitcher(
                                duration: const Duration(milliseconds: 250),
                                switchInCurve: Curves.easeOutCubic,
                                child: _isLogin
                                    ? _LoginForm(
                                        key: const ValueKey('login'),
                                        formKey: _loginKey,
                                        email: _email,
                                        mpin: _mpin,
                                        obscure: _obscureMpin,
                                        loading: _loading,
                                        onToggleObscure: () => setState(() => _obscureMpin = !_obscureMpin),
                                        onSubmit: _login,
                                        onGoRegister: () => _switchTab(false),
                                      )
                                    : _RegisterForm(
                                        key: const ValueKey('register'),
                                        formKey: _regKey,
                                        name: _name,
                                        email: _email,
                                        phone: _phone,
                                        mpin: _mpin,
                                        confirmMpin: _confirmMpin,
                                        otp: _otp,
                                        referral: _ref,
                                        obscure: _obscureMpin,
                                        otpSent: _otpSent,
                                        loading: _loading,
                                        onToggleObscure: () => setState(() => _obscureMpin = !_obscureMpin),
                                        onSubmit: _signup,
                                        onGoLogin: () => _switchTab(true),
                                      ),
                              ),
                            ],
                          ),
                        ).guFadeSlide(delayMs: 60),
                        const SizedBox(height: 16),
                        Text(
                          'Same account as gounlisted.in',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 12, color: GuColors.muted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _AuthHeader extends StatelessWidget {
  const _AuthHeader({required this.compact});
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final logoSize = compact ? 56.0 : 72.0;
    return Column(
      children: [
        Container(
          width: logoSize,
          height: logoSize,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            boxShadow: GuColors.softLift,
          ),
          clipBehavior: Clip.antiAlias,
          child: Image.asset('assets/brand/logo.png', fit: BoxFit.cover),
        ),
        SizedBox(height: compact ? 10 : 14),
        RichText(
          text: TextSpan(
            style: GoogleFonts.manrope(
              fontSize: compact ? 22 : 26,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
            children: const [
              TextSpan(text: 'GO ', style: TextStyle(color: GuColors.lime)),
              TextSpan(text: 'UNLISTED', style: TextStyle(color: GuColors.navy)),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          "India's Pre-IPO Investment Platform",
          style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

class _AuthTabs extends StatelessWidget {
  const _AuthTabs({required this.isLogin, required this.onChanged});
  final bool isLogin;
  final void Function(bool login) onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: GuColors.bg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(child: _Tab(label: 'Login', active: isLogin, onTap: () => onChanged(true))),
          Expanded(child: _Tab(label: 'Register', active: !isLogin, onTap: () => onChanged(false))),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          color: active ? GuColors.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(11),
          boxShadow: active ? GuColors.softCard : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: active ? GuColors.limeDark : GuColors.muted,
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: GuColors.text),
      ),
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    super.key,
    required this.formKey,
    required this.email,
    required this.mpin,
    required this.obscure,
    required this.loading,
    required this.onToggleObscure,
    required this.onSubmit,
    required this.onGoRegister,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController email;
  final TextEditingController mpin;
  final bool obscure;
  final bool loading;
  final VoidCallback onToggleObscure;
  final VoidCallback onSubmit;
  final VoidCallback onGoRegister;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _FieldLabel('Email or Phone Number'),
          TextFormField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(hintText: 'you@example.com or 9876543210'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter email or phone' : null,
          ),
          const SizedBox(height: 14),
          const _FieldLabel('MPIN'),
          TextFormField(
            controller: mpin,
            obscureText: obscure,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => onSubmit(),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              hintText: '4–6 digit MPIN',
              counterText: '',
              suffixIcon: IconButton(
                onPressed: onToggleObscure,
                icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20),
              ),
            ),
            validator: (v) {
              if (v == null || v.length < 4) return 'Enter 4–6 digit MPIN';
              return null;
            },
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Reset MPIN from the website for now — Forgot MPIN flow coming next')),
              ),
              child: Text(
                'Forgot MPIN?',
                style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: GuColors.blue),
              ),
            ),
          ),
          const SizedBox(height: 4),
          GuPrimaryButton(
            label: loading ? 'Signing in…' : 'Login to Account',
            loading: loading,
            onPressed: onSubmit,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Expanded(child: Divider(color: GuColors.border)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text('or', style: GoogleFonts.inter(fontSize: 12, color: GuColors.muted)),
              ),
              const Expanded(child: Divider(color: GuColors.border)),
            ],
          ),
          const SizedBox(height: 12),
          Text.rich(
            TextSpan(
              style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted),
              children: [
                const TextSpan(text: "Don't have an account? "),
                WidgetSpan(
                  alignment: PlaceholderAlignment.baseline,
                  baseline: TextBaseline.alphabetic,
                  child: GestureDetector(
                    onTap: onGoRegister,
                    child: Text(
                      'Register here',
                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: GuColors.limeDark),
                    ),
                  ),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _RegisterForm extends StatelessWidget {
  const _RegisterForm({
    super.key,
    required this.formKey,
    required this.name,
    required this.email,
    required this.phone,
    required this.mpin,
    required this.confirmMpin,
    required this.otp,
    required this.referral,
    required this.obscure,
    required this.otpSent,
    required this.loading,
    required this.onToggleObscure,
    required this.onSubmit,
    required this.onGoLogin,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController name;
  final TextEditingController email;
  final TextEditingController phone;
  final TextEditingController mpin;
  final TextEditingController confirmMpin;
  final TextEditingController otp;
  final TextEditingController referral;
  final bool obscure;
  final bool otpSent;
  final bool loading;
  final VoidCallback onToggleObscure;
  final VoidCallback onSubmit;
  final VoidCallback onGoLogin;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _FieldLabel('Full Name'),
          TextFormField(
            controller: name,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(hintText: 'Rahul Sharma'),
            validator: (v) => (v == null || v.trim().length < 2) ? 'Enter your name' : null,
          ),
          const SizedBox(height: 12),
          const _FieldLabel('Phone Number *'),
          TextFormField(
            controller: phone,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            textInputAction: TextInputAction.next,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(hintText: '9876543210', counterText: ''),
            validator: (v) => (v == null || v.length != 10) ? 'Enter 10-digit phone' : null,
          ),
          const SizedBox(height: 12),
          const _FieldLabel('Email *'),
          TextFormField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(hintText: 'you@example.com'),
            validator: (v) {
              if (v == null || !v.contains('@')) return 'Enter a valid email';
              return null;
            },
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _FieldLabel('Set MPIN'),
                    TextFormField(
                      controller: mpin,
                      obscureText: obscure,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(hintText: '4–6 digits', counterText: ''),
                      validator: (v) => (v == null || v.length < 4) ? 'Min 4 digits' : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _FieldLabel('Confirm MPIN'),
                    TextFormField(
                      controller: confirmMpin,
                      obscureText: obscure,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: InputDecoration(
                        hintText: 'Re-enter',
                        counterText: '',
                        suffixIcon: IconButton(
                          onPressed: onToggleObscure,
                          icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 18),
                        ),
                      ),
                      validator: (v) => (v == null || v.length < 4) ? 'Confirm MPIN' : null,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const _FieldLabel('Referral code (optional)'),
          TextFormField(
            controller: referral,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(hintText: 'Employee / partner code'),
          ),
          if (otpSent) ...[
            const SizedBox(height: 12),
            const _FieldLabel('Email OTP'),
            TextFormField(
              controller: otp,
              keyboardType: TextInputType.number,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(hintText: 'Enter OTP', counterText: ''),
              validator: (v) => (v == null || v.length < 4) ? 'Enter OTP' : null,
            ),
          ],
          const SizedBox(height: 8),
          Text(
            otpSent
                ? 'Enter the OTP sent to your email to finish signup.'
                : 'We\'ll verify your email with OTP, same as the website.',
            style: GoogleFonts.inter(fontSize: 12, color: GuColors.muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          GuPrimaryButton(
            label: loading
                ? 'Please wait…'
                : otpSent
                    ? 'Create Account'
                    : 'Send OTP & Continue',
            loading: loading,
            onPressed: onSubmit,
          ),
          const SizedBox(height: 14),
          Text.rich(
            TextSpan(
              style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted),
              children: [
                const TextSpan(text: 'Already have an account? '),
                WidgetSpan(
                  alignment: PlaceholderAlignment.baseline,
                  baseline: TextBaseline.alphabetic,
                  child: GestureDetector(
                    onTap: onGoLogin,
                    child: Text(
                      'Login here',
                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: GuColors.limeDark),
                    ),
                  ),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
