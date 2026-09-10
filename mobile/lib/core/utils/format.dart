import 'package:intl/intl.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _inrDec = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);

String formatInr(num value, {bool decimals = false}) {
  if (decimals) return _inrDec.format(value);
  return _inr.format(value);
}

String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return 'GU';
  if (parts.length == 1) return parts.first.substring(0, parts.first.length.clamp(0, 2)).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

final _numFmt = NumberFormat.decimalPattern('en_IN');

String formatNumber(num value) {
  return _numFmt.format(value);
}
