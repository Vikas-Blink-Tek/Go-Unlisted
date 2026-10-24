<?php

/**
 * Indicative price path ending at $price.
 * $rising true = chart goes up (green); false = chart goes down (red).
 * $growthPct e.g. 0.15 for 15% move over the period.
 */
function defaultPriceHistory(float $price, bool $rising = true, float $growthPct = 0.15): array {
    $points = 13;
    $move = max(0.02, min(2.0, abs($growthPct)));
    $start = $rising ? ($price / (1 + $move)) : ($price * (1 + $move));
    $series = [];
    for ($i = 0; $i < $points; $i++) {
        $t = $i / ($points - 1);
        $ease = $t * $t * (3 - 2 * $t);
        $wobble = sin($i * 1.7) * $price * 0.008;
        $series[] = max(1, round(($start + ($price - $start) * $ease + $wobble) * 100) / 100);
    }
    $series[$points - 1] = $price;
    return [
        '3M' => $series,
        '6M' => $series,
        '1Y' => $series,
    ];
}

function parseGrowthFraction(string $growth): float {
    if (preg_match('/-?\d+(\.\d+)?/', str_replace(',', '', $growth), $m)) {
        return max(0.02, min(2.0, abs((float) $m[0]) / 100));
    }
    return 0.15;
}

/** Admin-maintained SEBI draft status shown on share cards / detail. */
function normalizeDrhpStatus($raw): string {
    $allowed = ['Not Filed', 'DRHP Pending', 'DRHP Filed', 'DRHP Approved'];
    $value = trim((string) $raw);
    if ($value !== '' && in_array($value, $allowed, true)) {
        return $value;
    }
    $map = [
        'pending' => 'DRHP Pending',
        'filed' => 'DRHP Filed',
        'approved' => 'DRHP Approved',
        'yes' => 'DRHP Filed',
        'no' => 'Not Filed',
        'not filed' => 'Not Filed',
        'none' => 'Not Filed',
        '' => 'Not Filed',
    ];
    $key = strtolower($value);
    return $map[$key] ?? 'Not Filed';
}

function defaultChartLabels(): array {
    return [
        '3M' => ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
        '6M' => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
        '1Y' => ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    ];
}

function getDefaultSharesSeed(): array {
    return [
        ['tata-capital', 'Tata Capital', 'TATACAP', 'Fintech', '#6C63FF', 850, 20, 'TC', 'linear-gradient(135deg, #003478, #0050a8)', 2007, '₹12,400 Cr', '₹72,000 Cr', '+28%', 1],
        ['reliance-retail', 'Reliance Retail', 'RELRET', 'Retail', '#FF6B6B', 1200, 10, 'RR', 'linear-gradient(135deg, #1565C0, #42a5f5)', 2006, '₹2,60,000 Cr', '₹8,00,000 Cr', '+34%', 1],
        ['oyo-rooms', 'OYO Rooms', 'OYOROOMS', 'Hospitality', '#F5A623', 45, 100, 'OY', 'linear-gradient(135deg, #c62828, #ef5350)', 2013, '₹5,463 Cr', '₹20,000 Cr', '+18%', 0],
        ['phonepe', 'PhonePe', 'PHONEPE', 'Fintech', '#6C63FF', 3200, 5, 'PP', 'linear-gradient(135deg, #6a0dad, #9c27b0)', 2015, '₹5,064 Cr', '₹1,00,000 Cr', '+52%', 1],
        ['zepto', 'Zepto', 'ZEPTO', 'Quick Commerce', '#00B4D8', 620, 15, 'ZP', 'linear-gradient(135deg, #004d40, #00897b)', 2021, '₹4,454 Cr', '₹14,000 Cr', '+120%', 1],
        ['ola-electric', 'Ola Electric', 'OLAEV', 'EV', '#00B4D8', 95, 50, 'OE', 'linear-gradient(135deg, #1a1a2e, #16213e)', 2017, '₹5,010 Cr', '₹25,000 Cr', '+89%', 1],
    ];
}

function seedDefaultSharesIfEmpty(mysqli $conn): void {
    $res = $conn->query("SELECT COUNT(*) AS c FROM shares");
    if (!$res || (int) $res->fetch_assoc()['c'] > 0) {
        return;
    }

    $stmt = $conn->prepare(
        "INSERT INTO shares (share_id, name, ticker, sector, sector_color, base_price, min_qty, logo_initials, logo_gradient, founded, revenue, valuation, growth, change_positive, price_history, chart_labels, is_builtin, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)"
    );

    foreach (getDefaultSharesSeed() as $row) {
        [$id, $name, $ticker, $sector, $color, $price, $minQty, $initials, $gradient, $founded, $revenue, $valuation, $growth, $positive] = $row;
        $history = json_encode(defaultPriceHistory((float) $price, (bool) $positive, parseGrowthFraction((string) $growth)));
        $labels = json_encode(defaultChartLabels());
        $stmt->bind_param(
            'sssssdississsiss',
            $id,
            $name,
            $ticker,
            $sector,
            $color,
            $price,
            $minQty,
            $initials,
            $gradient,
            $founded,
            $revenue,
            $valuation,
            $growth,
            $positive,
            $history,
            $labels
        );
        $stmt->execute();

        $cfg = $conn->prepare("INSERT IGNORE INTO shares_config (share_id, base_price) VALUES (?, ?)");
        $cfg->bind_param('sd', $id, $price);
        $cfg->execute();
    }
}

function syncShareConfigPrice(mysqli $conn, string $shareId, float $price): void {
    $stmt = $conn->prepare(
        "INSERT INTO shares_config (share_id, base_price) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE base_price = VALUES(base_price)"
    );
    $stmt->bind_param('sd', $shareId, $price);
    $stmt->execute();
}

/**
 * Strip monetary rates from a mapped share for guests (browse OK, rates after login).
 * Product exception: Market Activity + Pre-IPO vs Listing Price track record stay public.
 */
function maskShareRates(array $mapped): array {
    $listingType = strtolower(trim((string) ($mapped['listingType'] ?? '')));
    $listingPrice = isset($mapped['listingPrice']) ? (float) $mapped['listingPrice'] : 0.0;
    $keepPublicRates =
        !empty($mapped['isFeatured'])
        || $listingPrice > 0
        || in_array($listingType, ['listed', 'exchange listed', 'nse listed', 'bse listed'], true);

    if (!$keepPublicRates) {
        $mapped['basePrice'] = 0;
        $mapped['price'] = 0;
        $mapped['listingPrice'] = null;
        $mapped['growth'] = '';
        $mapped['week52High'] = '';
        $mapped['week52Low'] = '';
        $mapped['bookValue'] = '';
        $mapped['faceValue'] = '';
        $mapped['peRatio'] = '';
        $mapped['pbRatio'] = '';
        if (isset($mapped['priceHistory']) && is_array($mapped['priceHistory'])) {
            foreach (array_keys($mapped['priceHistory']) as $period) {
                $mapped['priceHistory'][$period] = [];
            }
        } else {
            $mapped['priceHistory'] = ['3M' => [], '6M' => [], '1Y' => []];
        }
        $mapped['ratesVisible'] = false;
    } else {
        // Track-record / Market Activity samples — invest & listing prices remain visible.
        $mapped['ratesVisible'] = true;
    }

    $mapped['discountTiers'] = [];
    unset($mapped['buyPrice']);
    return $mapped;
}

/**
 * Exchange-listed / IPO-done / Market Activity dummies — not sold as inventory.
 */
function isExchangeListedShare(array $row): bool {
    $type = strtolower(trim((string) ($row['listing_type'] ?? '')));
    if (in_array($type, ['listed', 'exchange listed', 'nse listed', 'bse listed'], true)) {
        return true;
    }
    $listingPrice = $row['listing_price'] ?? null;
    if ($listingPrice !== null && $listingPrice !== '' && (float) $listingPrice > 0) {
        return true;
    }
    static $listedIds = [
        'custom-adtech-systems-ltd-0ce13' => true,
        'custom-anand-rathi-wealth-52a7d' => true,
        'custom-bikaji-foods-c8739' => true,
        'custom-just-dial-ltd-c9d32' => true,
        'custom-nykaa-d23d5' => true,
    ];
    $id = (string) ($row['share_id'] ?? '');
    return isset($listedIds[$id]);
}

/** True when investors may place an online / app purchase for this share. */
function shareIsPurchasable(array $row): bool {
    $inv = trim((string) ($row['inventory_status'] ?? 'In Stock'));
    if ($inv === 'Out of Stock') {
        return false;
    }
    // Featured = homepage Market Activity sample — not checkout inventory
    if (((int) ($row['is_featured'] ?? 0)) === 1) {
        return false;
    }
    if (isExchangeListedShare($row)) {
        return false;
    }
    $price = (float) ($row['base_price'] ?? 0);
    if ($price <= 0) {
        return false;
    }
    return true;
}

/**
 * Real price history — one row each time an admin changes a share's price.
 * Replaces the old generated curve; prices from before this table existed were never stored.
 */
function ensureSharePriceHistoryTable(mysqli $conn): void {
    $exists = $conn->query("SHOW TABLES LIKE 'share_price_history'");
    if ($exists && $exists->num_rows > 0) {
        return;
    }
    $conn->query("CREATE TABLE share_price_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        share_id VARCHAR(50) NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        recorded_at DATETIME NOT NULL,
        KEY idx_share_time (share_id, recorded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    // History starts today at each share's current price
    $conn->query("INSERT INTO share_price_history (share_id, price, recorded_at)
                  SELECT share_id, base_price, NOW() FROM shares WHERE base_price > 0");
}

/** Log a price change (no-op when the price is unchanged). */
function recordSharePrice(mysqli $conn, string $shareId, float $price): void {
    if ($shareId === '' || $price <= 0) {
        return;
    }
    try {
        $last = $conn->prepare('SELECT price FROM share_price_history WHERE share_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1');
        $last->bind_param('s', $shareId);
        $last->execute();
        $row = $last->get_result()->fetch_assoc();
        if ($row && abs((float) $row['price'] - $price) < 0.005) {
            return;
        }
        $ins = $conn->prepare('INSERT INTO share_price_history (share_id, price, recorded_at) VALUES (?, ?, NOW())');
        $ins->bind_param('sd', $shareId, $price);
        $ins->execute();
    } catch (Throwable $e) {
        error_log("recordSharePrice failed for {$shareId}: " . $e->getMessage());
    }
}

/**
 * Price points per share for the last $days, plus the price already in effect when that window opens.
 * Returns share_id => [[unix_ts, price], ...] oldest first.
 */
function loadSharePricePoints(mysqli $conn, int $days = 366): array {
    $points = [];
    try {
        $cutoff = date('Y-m-d H:i:s', time() - $days * 86400);
        $before = $conn->prepare(
            'SELECT h.share_id, h.price, h.recorded_at FROM share_price_history h
             JOIN (SELECT share_id, MAX(id) AS id FROM share_price_history WHERE recorded_at < ? GROUP BY share_id) last
               ON last.id = h.id'
        );
        $before->bind_param('s', $cutoff);
        $before->execute();
        $res = $before->get_result();
        while ($r = $res->fetch_assoc()) {
            $points[$r['share_id']][] = [strtotime($r['recorded_at']), (float) $r['price']];
        }
        $within = $conn->prepare('SELECT share_id, price, recorded_at FROM share_price_history WHERE recorded_at >= ? ORDER BY recorded_at, id');
        $within->bind_param('s', $cutoff);
        $within->execute();
        $res = $within->get_result();
        while ($r = $res->fetch_assoc()) {
            $points[$r['share_id']][] = [strtotime($r['recorded_at']), (float) $r['price']];
        }
    } catch (Throwable $e) {
        error_log('loadSharePricePoints failed: ' . $e->getMessage());
    }
    return $points;
}

/**
 * Chart series from real price points: evenly spaced dates across each period (never before the first
 * recorded price), each showing the price in effect that day; the last point is always the current price.
 */
function buildSharePriceSeries(array $points, float $currentPrice): array {
    $now = time();
    if (!$points) {
        $points = [[$now, $currentPrice]];
    }
    $firstTs = $points[0][0];
    $history = [];
    $labels = [];
    foreach (['3M' => 91, '6M' => 182, '1Y' => 365] as $period => $days) {
        $start = max($now - $days * 86400, $firstTs);
        $spanDays = ($now - $start) / 86400;
        $n = (int) max(2, min(13, floor($spanDays) + 1));
        $i = 0;
        $price = $points[0][1];
        $values = [];
        $periodLabels = [];
        for ($k = 0; $k < $n; $k++) {
            $t = $start + ($now - $start) * $k / ($n - 1);
            while ($i < count($points) && $points[$i][0] <= $t) {
                $price = $points[$i][1];
                $i++;
            }
            $values[] = round($price, 2);
            $periodLabels[] = date($spanDays > 200 ? "M 'y" : 'j M', (int) $t);
        }
        $values[$n - 1] = round($currentPrice, 2);
        $history[$period] = $values;
        $labels[$period] = $periodLabels;
    }
    return ['history' => $history, 'labels' => $labels, 'since' => date('Y-m-d', $firstTs)];
}

/** @param array|null $pricePoints real price points from loadSharePricePoints() for this share */
function mapShareRow(array $row, bool $includeInternal = false, bool $includeRates = true, ?array $pricePoints = null): array {
    $price = (float) $row['base_price'];
    $history = json_decode($row['price_history'] ?? '', true);
    $labels = json_decode($row['chart_labels'] ?? '', true);
    $highlights = json_decode($row['key_highlights'] ?? '', true);
    $fundamentals = json_decode($row['fundamentals'] ?? '', true);
    if (!is_array($fundamentals)) {
        $fundamentals = [];
    }

    if (!is_array($history) || empty($history)) {
        $history = defaultPriceHistory($price);
    }
    if (!is_array($labels) || empty($labels)) {
        $labels = defaultChartLabels();
    }
    $historySince = null;
    if ($pricePoints !== null) {
        $series = buildSharePriceSeries($pricePoints, $price);
        $history = $series['history'];
        $labels = $series['labels'];
        $historySince = $series['since'];
    }
    if (!is_array($highlights)) {
        $highlights = [];
    }

    $mapped = [
        'id' => $row['share_id'],
        'name' => $row['name'],
        'ticker' => $row['ticker'],
        'sector' => $row['sector'],
        'sectorColor' => $row['sector_color'] ?: '#7ac142',
        'basePrice' => $price,
        'price' => $price,
        'minQty' => (int) $row['min_qty'],
        'description' => $row['description'] ?? '',
        'founded' => $row['founded'] ? (int) $row['founded'] : null,
        'revenue' => $row['revenue'] ?? '',
        'valuation' => $row['valuation'] ?? '',
        'growth' => $row['growth'] ?? '',
        'changePositive' => (bool) $row['change_positive'],
        'logoInitials' => $row['logo_initials'] ?? '',
        'logoGradient' => $row['logo_gradient'] ?? 'linear-gradient(135deg, #003478, #0050a8)',
        'logoUrl' => trim($row['logo_url'] ?? ''),
        'priceHistory' => $history,
        'chartLabels' => $labels,
        'priceHistorySince' => $historySince,
        'listingType' => isExchangeListedShare($row) ? 'Listed' : ($row['listing_type'] ?? 'Pre-IPO'),
        'ipoTimeline' => $row['ipo_timeline'] ?? '',
        'drhpStatus' => normalizeDrhpStatus($row['drhp_status'] ?? ''),
        'listingPrice' => isset($row['listing_price']) && $row['listing_price'] !== null && $row['listing_price'] !== ''
            ? (float) $row['listing_price']
            : null,
        'inventoryStatus' => $row['inventory_status'] ?? 'In Stock',
        'purchasable' => shareIsPurchasable($row),
        'keyHighlights' => $highlights,
        'riskNotes' => $row['risk_notes'] ?? '',
        'lockInMonths' => isset($row['lock_in_months']) ? (int) $row['lock_in_months'] : 0,
        'isin' => trim($row['isin'] ?? ''),
        'week52High' => trim($fundamentals['week52High'] ?? ''),
        'week52Low' => trim($fundamentals['week52Low'] ?? ''),
        'marketCap' => trim($fundamentals['marketCap'] ?? ''),
        'peRatio' => trim($fundamentals['peRatio'] ?? ''),
        'pbRatio' => trim($fundamentals['pbRatio'] ?? ''),
        'debtEquity' => trim($fundamentals['debtEquity'] ?? ''),
        'roe' => trim($fundamentals['roe'] ?? ''),
        'bookValue' => trim($fundamentals['bookValue'] ?? ''),
        'faceValue' => trim($fundamentals['faceValue'] ?? ''),
        'website' => trim($fundamentals['website'] ?? $fundamentals['companyWebsite'] ?? ''),
        'balanceSheetUrl' => trim($fundamentals['balanceSheetUrl'] ?? ''),
        'isFeatured' => ((int) ($row['is_featured'] ?? 0)) === 1,
        'isTop10' => ((int) ($row['is_top10'] ?? 0)) === 1,
        'cardBadge' => trim((string) ($row['card_badge'] ?? '')),
        'discountTiers' => (static function ($raw) {
            $tiers = is_string($raw) ? json_decode($raw, true) : $raw;
            if (!is_array($tiers)) {
                return [];
            }
            $out = [];
            foreach ($tiers as $tier) {
                if (!is_array($tier)) {
                    continue;
                }
                $mq = (int) ($tier['minQty'] ?? $tier['min_qty'] ?? 0);
                $pr = (float) ($tier['price'] ?? $tier['rate'] ?? 0);
                if ($mq > 0 && $pr > 0) {
                    $out[] = ['minQty' => $mq, 'price' => $pr];
                }
            }
            return $out;
        })($row['discount_tiers'] ?? null),
        'isBuiltin' => (bool) $row['is_builtin'],
        'lastUpdated' => $row['updated_at'] ?? null,
        'qtyOnHand' => isset($row['qty_on_hand']) ? (int) $row['qty_on_hand'] : 0,
        'ratesVisible' => true,
    ];

    if ($includeInternal && isset($row['buy_price']) && $row['buy_price'] !== null) {
        $mapped['buyPrice'] = (float) $row['buy_price'];
    }
    if ($includeInternal) {
        $mapped['qtyOnHand'] = isset($row['qty_on_hand']) ? (int) $row['qty_on_hand'] : 0;
    }

    if (!$includeRates) {
        return maskShareRates($mapped);
    }

    return $mapped;
}
