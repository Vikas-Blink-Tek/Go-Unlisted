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

/// Portfolio line: `XYZ Unlisted @45×1,000=45,000`
String formatTradeCalc({
  required String name,
  required num pricePerShare,
  required int qty,
  num? total,
}) {
  final cleanName = name.trim().isEmpty ? 'Share' : name.trim();
  final unit = pricePerShare is int || pricePerShare == pricePerShare.roundToDouble()
      ? formatNumber(pricePerShare.round())
      : NumberFormat('#,##0.##', 'en_IN').format(pricePerShare);
  final q = formatNumber(qty);
  final t = total ?? (pricePerShare * qty);
  final totalStr = t is int || t == t.roundToDouble()
      ? formatNumber(t.round())
      : NumberFormat('#,##0.##', 'en_IN').format(t);
  return '$cleanName @$unit×$q=$totalStr';
}

/// 10-digit Indian mobile → `+91 XXXXX XXXXX`
String formatIndianPhone(String? raw) {
  final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
  final local = digits.length >= 10 ? digits.substring(digits.length - 10) : digits;
  if (local.length != 10) return (raw ?? '').trim().isEmpty ? '—' : raw!.trim();
  return '+91 ${local.substring(0, 5)} ${local.substring(5)}';
}

/// Split Site Settings-style multi phone string into unique 10-digit locals.
List<String> parseIndianPhoneList(String? raw) {
  final text = (raw ?? '').trim();
  if (text.isEmpty) return const [];
  final parts = text.split(RegExp(r'[,;\n|]+'));
  final out = <String>[];
  for (final part in parts) {
    final digits = part.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) continue;
    final local = digits.substring(digits.length - 10);
    if (!out.contains(local)) out.add(local);
  }
  return out;
}

/// `tel:+91XXXXXXXXXX` for launchUrl
Uri? indianPhoneTelUri(String? raw) {
  final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
  if (digits.length < 10) return null;
  return Uri(scheme: 'tel', path: '+91${digits.substring(digits.length - 10)}');
}

Uri? whatsappUri(String? raw, {String? message}) {
  final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
  if (digits.length < 10) return null;
  final wa = digits.length > 10 ? digits : '91${digits.substring(digits.length - 10)}';
  final q = (message != null && message.isNotEmpty) ? '?text=${Uri.encodeComponent(message)}' : '';
  return Uri.parse('https://wa.me/$wa$q');
}
