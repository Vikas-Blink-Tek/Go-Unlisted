import '../../models/models.dart';

/// Thin wrappers — prefer [GuShare.isPurchasable] / [GuShare.isTrackRecordOnly] on call sites.
bool isExchangeListedShare(GuShare share) => share.isExchangeListed;

bool isTrackRecordOnlyShare(GuShare share) => share.isTrackRecordOnly;

bool isShareUnavailable(GuShare share) => share.isUnavailable;

bool isSharePurchasable(GuShare share) => share.isPurchasable;
