import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// GO UNLISTED brand — light theme matching gounlisted.in
class GuColors {
  static const lime = Color(0xFF7AC142);
  static const limeDark = Color(0xFF39B54A);
  static const limeSoft = Color(0x1F7AC142);
  static const limeGlow = Color(0x337AC142);
  static const blue = Color(0xFF0072BC);
  static const blueSoft = Color(0x1A0072BC);
  static const navy = Color(0xFF003478);
  static const ink = Color(0xFF0F172A);
  static const text = Color(0xFF334155);
  static const muted = Color(0xFF64748B);
  static const mutedSoft = Color(0xFF94A3B8);
  static const bg = Color(0xFFF4F7F2);
  static const bgWarm = Color(0xFFF8FBF5);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0x140F172A);
  static const danger = Color(0xFFEF4444);
  static const warning = Color(0xFFF59E0B);

  static const heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF005A96), Color(0xFF0072BC), Color(0xFF39B54A), Color(0xFF7AC142)],
    stops: [0.0, 0.35, 0.72, 1.0],
  );

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF7AC142), Color(0xFF39B54A)],
  );

  static List<BoxShadow> softCard = [
    BoxShadow(
      color: const Color(0xFF003478).withValues(alpha: 0.06),
      blurRadius: 24,
      offset: const Offset(0, 10),
    ),
    BoxShadow(
      color: GuColors.lime.withValues(alpha: 0.05),
      blurRadius: 8,
      offset: const Offset(0, 2),
    ),
  ];

  static List<BoxShadow> softLift = [
    BoxShadow(
      color: GuColors.lime.withValues(alpha: 0.22),
      blurRadius: 20,
      offset: const Offset(0, 8),
    ),
  ];
}

class GuTheme {
  /// 4 sizes · 2 weights — Manrope display + Inter body (finance clarity)
  static ThemeData light() {
    final display = GoogleFonts.manrope;
    final body = GoogleFonts.inter;

    TextTheme baseText(TextTheme t) => TextTheme(
          displayLarge: display(fontSize: 32, fontWeight: FontWeight.w700, height: 1.15, letterSpacing: -0.6, color: GuColors.ink),
          headlineMedium: display(fontSize: 24, fontWeight: FontWeight.w700, height: 1.2, letterSpacing: -0.4, color: GuColors.ink),
          titleLarge: display(fontSize: 18, fontWeight: FontWeight.w700, height: 1.3, color: GuColors.ink),
          titleMedium: display(fontSize: 16, fontWeight: FontWeight.w700, height: 1.35, color: GuColors.ink),
          bodyLarge: body(fontSize: 16, fontWeight: FontWeight.w400, height: 1.5, color: GuColors.text),
          bodyMedium: body(fontSize: 14, fontWeight: FontWeight.w400, height: 1.45, color: GuColors.text),
          bodySmall: body(fontSize: 12, fontWeight: FontWeight.w400, height: 1.4, color: GuColors.muted),
          labelLarge: body(fontSize: 14, fontWeight: FontWeight.w600, height: 1.2, color: GuColors.ink),
          labelMedium: body(fontSize: 12, fontWeight: FontWeight.w600, height: 1.2, letterSpacing: 0.2, color: GuColors.muted),
          labelSmall: body(fontSize: 11, fontWeight: FontWeight.w600, height: 1.2, letterSpacing: 0.3, color: GuColors.mutedSoft),
        );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme.light(
        primary: GuColors.lime,
        onPrimary: Colors.white,
        secondary: GuColors.blue,
        onSecondary: Colors.white,
        surface: GuColors.surface,
        onSurface: GuColors.ink,
        error: GuColors.danger,
      ),
      scaffoldBackgroundColor: GuColors.bg,
    );

    return base.copyWith(
      textTheme: baseText(base.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: GuColors.bg,
        foregroundColor: GuColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: display(fontSize: 20, fontWeight: FontWeight.w700, color: GuColors.ink),
      ),
      cardTheme: CardThemeData(
        color: GuColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: GuColors.border),
        ),
        margin: EdgeInsets.zero,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: GuColors.surface,
        selectedColor: GuColors.lime,
        disabledColor: GuColors.bg,
        labelStyle: body(fontSize: 12, fontWeight: FontWeight.w600),
        secondaryLabelStyle: body(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        side: const BorderSide(color: GuColors.border),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: GuColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: body(color: GuColors.mutedSoft, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: GuColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: GuColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: GuColors.lime, width: 1.6),
        ),
        labelStyle: body(color: GuColors.muted, fontSize: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: GuColors.lime,
          foregroundColor: Colors.white,
          disabledBackgroundColor: GuColors.lime.withValues(alpha: 0.45),
          minimumSize: const Size.fromHeight(54),
          elevation: 0,
          shadowColor: GuColors.limeGlow,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: display(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: GuColors.navy,
          minimumSize: const Size.fromHeight(54),
          side: BorderSide(color: GuColors.navy.withValues(alpha: 0.2)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: display(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: GuColors.surface,
        indicatorColor: GuColors.limeSoft,
        elevation: 0,
        height: 72,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return body(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? GuColors.limeDark : GuColors.muted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            size: 24,
            color: selected ? GuColors.limeDark : GuColors.muted,
          );
        }),
      ),
      dividerColor: GuColors.border,
    );
  }

  static TextStyle price(BuildContext context, {double size = 20}) {
    return GoogleFonts.manrope(
      fontSize: size,
      fontWeight: FontWeight.w800,
      color: GuColors.ink,
      letterSpacing: -0.3,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
  }
}
