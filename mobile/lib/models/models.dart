import '../core/api/api_config.dart';

class GuUser {
  GuUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.kycStatus,
    this.referralCode,
    this.kycPan,
    this.kycDemat,
    this.kycDematProof,
    this.kycDematProofExists = false,
    this.bankName,
    this.bankAccount,
    this.ifsc,
    this.kycRejectReason,
  });

  final String id;
  final String name;
  final String email;
  final String phone;
  final String kycStatus;
  final String? referralCode;
  final String? kycPan;
  final String? kycDemat;
  final String? kycDematProof;
  final bool kycDematProofExists;
  final String? bankName;
  final String? bankAccount;
  final String? ifsc;
  final String? kycRejectReason;

  bool get isKycVerified => kycStatus.toLowerCase() == 'verified';
  bool get isLoggedIn => id.isNotEmpty;
  bool get hasDematProof =>
      kycDematProofExists || (kycDematProof != null && kycDematProof!.trim().isNotEmpty);

  factory GuUser.fromJson(Map<String, dynamic> j) {
    final proof = (j['kycDematProof'] ?? j['kyc_demat_proof'])?.toString().trim();
    final existsRaw = j['kycDematProofExists'] ?? j['kyc_demat_proof_exists'];
    return GuUser(
      id: (j['id'] ?? '').toString(),
      name: (j['name'] ?? '').toString(),
      email: (j['email'] ?? '').toString(),
      phone: (j['phone'] ?? '').toString(),
      kycStatus: (j['kycStatus'] ?? j['kyc_status'] ?? 'Not Submitted').toString(),
      referralCode: (j['referralCode'] ?? j['referral_code'])?.toString(),
      kycPan: (j['kycPan'] ?? j['kyc_pan'])?.toString(),
      kycDemat: (j['kycDemat'] ?? j['kyc_demat'])?.toString(),
      kycDematProof: (proof == null || proof.isEmpty) ? null : proof,
      kycDematProofExists: existsRaw == true || existsRaw == 1 || existsRaw == '1',
      bankName: (j['bankName'] ?? j['bank_name'])?.toString(),
      bankAccount: (j['bankAccount'] ?? j['bank_account'])?.toString(),
      ifsc: (j['ifsc'])?.toString(),
      kycRejectReason: (j['kycRejectReason'] ?? j['kyc_reject_reason'])?.toString(),
    );
  }

  GuUser copyWith({
    String? kycStatus,
    String? kycDematProof,
    bool? kycDematProofExists,
  }) {
    return GuUser(
      id: id,
      name: name,
      email: email,
      phone: phone,
      kycStatus: kycStatus ?? this.kycStatus,
      referralCode: referralCode,
      kycPan: kycPan,
      kycDemat: kycDemat,
      kycDematProof: kycDematProof ?? this.kycDematProof,
      kycDematProofExists: kycDematProofExists ?? this.kycDematProofExists,
      bankName: bankName,
      bankAccount: bankAccount,
      ifsc: ifsc,
      kycRejectReason: kycRejectReason,
    );
  }
}

class GuShare {
  GuShare({
    required this.id,
    required this.name,
    required this.ticker,
    required this.sector,
    required this.price,
    required this.minQty,
    required this.description,
    this.sectorColor,
    this.logoUrl,
    this.logoInitials,
    this.inventoryStatus,
    this.listingType,
    this.listingPrice,
    this.purchasable,
    this.featured = false,
    this.isTop10 = false,
    this.highlights = const [],
    this.valuation,
    this.ipoTimeline,
    this.week52High,
    this.week52Low,
    this.marketCap,
    this.peRatio,
    this.pbRatio,
    this.debtEquity,
    this.roe,
    this.bookValue,
    this.faceValue,
    this.isin,
    this.growth,
    bool changePositive = true,
    Map<String, List<double>> priceHistory = const {},
    Map<String, List<String>> chartLabels = const {},
    List<GuDiscountTier> discountTiers = const [],
  })  : _changePositive = changePositive,
        _priceHistory = priceHistory,
        _chartLabels = chartLabels,
        _discountTiers = discountTiers;

  final String id;
  final String name;
  final String ticker;
  final String sector;
  final double price;
  final int minQty;
  final String description;
  final String? sectorColor;
  final String? logoUrl;
  final String? logoInitials;
  final String? inventoryStatus;
  final String? listingType;
  final double? listingPrice;
  final bool? purchasable;
  final bool featured;
  final bool isTop10;
  final List<String> highlights;
  final String? valuation;
  final String? ipoTimeline;
  final String? week52High;
  final String? week52Low;
  final String? marketCap;
  final String? peRatio;
  final String? pbRatio;
  final String? debtEquity;
  final String? roe;
  final String? bookValue;
  final String? faceValue;
  final String? isin;
  final String? growth;
  
  final bool? _changePositive;
  bool get changePositive => _changePositive ?? true;

  final Map<String, List<double>>? _priceHistory;
  Map<String, List<double>> get priceHistory => _priceHistory ?? const {};

  final Map<String, List<String>>? _chartLabels;
  Map<String, List<String>> get chartLabels => _chartLabels ?? const {};

  final List<GuDiscountTier>? _discountTiers;
  List<GuDiscountTier> get discountTiers => _discountTiers ?? const [];

  /// Market Activity / sample track-record IDs (not for purchase).
  static const trackRecordOnlyIds = {
    'custom-adtech-systems-ltd-0ce13',
    'custom-anand-rathi-wealth-52a7d',
    'custom-bikaji-foods-c8739',
    'custom-just-dial-ltd-c9d32',
    'custom-nykaa-d23d5',
  };

  bool get isExchangeListed {
    if (trackRecordOnlyIds.contains(id)) return true;
    final type = (listingType ?? '').trim().toLowerCase();
    if (type == 'listed' || type == 'exchange listed' || type == 'nse listed' || type == 'bse listed') {
      return true;
    }
    final lp = listingPrice;
    return lp != null && lp > 0;
  }

  /// Homepage starred / Market Activity samples — browse only, not checkout.
  bool get isTrackRecordOnly {
    if (featured) return true;
    if (trackRecordOnlyIds.contains(id)) return true;
    if (isExchangeListed) return true;
    return false;
  }

  bool get isUnavailable => (inventoryStatus ?? '').trim() == 'Out of Stock';

  /// Investor may place an in-app / online purchase.
  bool get isPurchasable {
    if (purchasable == false) return false;
    if (isUnavailable) return false;
    if (isTrackRecordOnly) return false;
    if (price <= 0) return false;
    return true;
  }

  factory GuShare.fromJson(Map<String, dynamic> j) {
    final highlightsRaw = j['highlights'] ?? j['keyHighlights'];
    List<String> highlights = [];
    if (highlightsRaw is List) {
      highlights = highlightsRaw.map((e) => e.toString()).toList();
    }
    final rawLogo = (j['logoUrl'] ?? j['logo_url'])?.toString().trim();
    final rawInitials = (j['logoInitials'] ?? j['logo_initials'])?.toString().trim();
    return GuShare(
      id: (j['id'] ?? j['share_id'] ?? '').toString(),
      name: (j['name'] ?? '').toString(),
      ticker: (j['ticker'] ?? '').toString(),
      sector: (j['sector'] ?? '').toString(),
      price: _toDouble(j['price'] ?? j['basePrice'] ?? j['base_price']),
      minQty: int.tryParse((j['minQty'] ?? j['min_qty'] ?? 1).toString()) ?? 1,
      description: (j['description'] ?? '').toString(),
      sectorColor: j['sectorColor']?.toString(),
      logoUrl: (rawLogo == null || rawLogo.isEmpty) ? null : rawLogo,
      logoInitials: (rawInitials == null || rawInitials.isEmpty) ? null : rawInitials,
      inventoryStatus: (j['inventoryStatus'] ?? j['inventory_status'])?.toString(),
      listingType: (j['listingType'] ?? j['listing_type'])?.toString(),
      listingPrice: () {
        final raw = j['listingPrice'] ?? j['listing_price'];
        if (raw == null || raw == '') return null;
        final v = _toDouble(raw);
        return v > 0 ? v : null;
      }(),
      purchasable: j['purchasable'] is bool
          ? j['purchasable'] as bool
          : (j['purchasable'] == 1 || j['purchasable'] == '1'
              ? true
              : (j['purchasable'] == 0 || j['purchasable'] == '0' || j['purchasable'] == false ? false : null)),
      featured: j['featured'] == true ||
          j['featured'] == 1 ||
          j['featured'] == '1' ||
          j['isFeatured'] == true ||
          j['isFeatured'] == 1 ||
          j['isFeatured'] == '1' ||
          j['is_featured'] == 1 ||
          j['is_featured'] == '1',
      isTop10: j['isTop10'] == true ||
          j['isTop10'] == 1 ||
          j['isTop10'] == '1' ||
          j['is_top10'] == 1 ||
          j['is_top10'] == '1' ||
          j['top10'] == true ||
          j['top10'] == 1,
      highlights: highlights,
      valuation: (j['valuation'] ?? j['marketCap'])?.toString(),
      ipoTimeline: (j['ipoTimeline'] ?? j['ipo_timeline'])?.toString(),
      week52High: j['week52High']?.toString(),
      week52Low: j['week52Low']?.toString(),
      marketCap: j['marketCap']?.toString(),
      peRatio: j['peRatio']?.toString(),
      pbRatio: j['pbRatio']?.toString(),
      debtEquity: j['debtEquity']?.toString(),
      roe: j['roe']?.toString(),
      bookValue: j['bookValue']?.toString(),
      faceValue: j['faceValue']?.toString(),
      isin: j['isin']?.toString(),
      growth: j['growth']?.toString(),
      changePositive: j['changePositive'] ?? j['change_positive'] ?? true,
      priceHistory: _parsePriceHistory(j['priceHistory'] ?? j['price_history']),
      chartLabels: _parseChartLabels(j['chartLabels'] ?? j['chart_labels']),
      discountTiers: _parseDiscountTiers(j['discountTiers'] ?? j['discount_tiers']),
    );
  }

  static Map<String, List<double>> _parsePriceHistory(dynamic raw) {
    if (raw == null) return {};
    final map = <String, List<double>>{};
    if (raw is Map) {
      for (final e in raw.entries) {
        if (e.value is List) {
          map[e.key.toString()] = (e.value as List).map((v) => _toDouble(v)).toList();
        }
      }
    }
    return map;
  }

  static Map<String, List<String>> _parseChartLabels(dynamic raw) {
    if (raw == null) return {};
    final map = <String, List<String>>{};
    if (raw is Map) {
      for (final e in raw.entries) {
        if (e.value is List) {
          map[e.key.toString()] = (e.value as List).map((v) => v.toString()).toList();
        }
      }
    }
    return map;
  }

  static List<GuDiscountTier> _parseDiscountTiers(dynamic raw) {
    if (raw == null) return [];
    if (raw is List) {
      return raw.map((e) => GuDiscountTier.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  static double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0;
  }
}

class GuDiscountTier {
  const GuDiscountTier({
    required this.minQty,
    required this.price,
  });

  final int minQty;
  final double price;

  factory GuDiscountTier.fromJson(Map<String, dynamic> j) {
    return GuDiscountTier(
      minQty: int.tryParse((j['minQty'] ?? j['min_qty'] ?? 0).toString()) ?? 0,
      price: GuShare._toDouble(j['price'] ?? 0),
    );
  }
}

class GuOrder {
  GuOrder({
    required this.id,
    required this.shareName,
    required this.qty,
    required this.totalPaid,
    required this.status,
    this.shareTicker,
    this.createdAt,
  });

  final String id;
  final String shareName;
  final int qty;
  final double totalPaid;
  final String status;
  final String? shareTicker;
  final String? createdAt;

  factory GuOrder.fromJson(Map<String, dynamic> j) {
    return GuOrder(
      id: (j['orderId'] ?? j['id'] ?? j['order_id'] ?? '').toString(),
      shareName: (j['shareName'] ?? j['companyName'] ?? j['share_name'] ?? '').toString(),
      shareTicker: (j['shareTicker'] ?? j['share_ticker'])?.toString(),
      qty: int.tryParse((j['qty'] ?? j['quantity'] ?? 0).toString()) ?? 0,
      totalPaid: GuShare._toDouble(j['totalPaid'] ?? j['total_amount'] ?? j['total']),
      status: (j['status'] ?? '').toString(),
      createdAt: (j['createdAt'] ?? j['date'] ?? j['created_at'])?.toString(),
    );
  }
}

class GuSettings {
  GuSettings({
    this.upiId,
    this.bankName,
    this.accountName,
    this.accountNumber,
    this.ifsc,
    this.qrUrl,
    this.phone,
    this.whatsapp,
  });

  final String? upiId;
  final String? bankName;
  final String? accountName;
  final String? accountNumber;
  final String? ifsc;
  final String? qrUrl;
  final String? phone;
  final String? whatsapp;

  factory GuSettings.fromJson(Map<String, dynamic> j) {
    // Live API keys match website Site Settings (bank_upi, bank_ac_no, …).
    String? pick(List<String> keys) {
      for (final k in keys) {
        final v = j[k]?.toString().trim();
        if (v != null && v.isNotEmpty) return v;
      }
      return null;
    }

    final qr = pick(['qrUrl', 'qr_url', 'qr_image']);
    return GuSettings(
      upiId: pick(['bank_upi', 'upiId', 'upi_id']),
      bankName: pick(['bank_name', 'bankName']),
      accountName: pick(['bank_ac_name', 'accountName', 'account_name']),
      accountNumber: pick(['bank_ac_no', 'accountNumber', 'account_number']),
      ifsc: pick(['bank_ifsc', 'ifsc']),
      qrUrl: qr != null
          ? ApiConfig.resolveMediaUrl(qr)
          : '${ApiConfig.baseUrl}/QR.jpeg',
      phone: pick(['mobile', 'phone']),
      whatsapp: pick(['whatsapp']),
    );
  }
}
