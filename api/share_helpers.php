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

function mapShareRow(array $row, bool $includeInternal = false): array {
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
        'listingType' => $row['listing_type'] ?? 'Pre-IPO',
        'ipoTimeline' => $row['ipo_timeline'] ?? '',
        'listingPrice' => isset($row['listing_price']) && $row['listing_price'] !== null && $row['listing_price'] !== ''
            ? (float) $row['listing_price']
            : null,
        'inventoryStatus' => $row['inventory_status'] ?? 'In Stock',
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
        'isFeatured' => ((int) ($row['is_featured'] ?? 0)) === 1,
        'isTop10' => ((int) ($row['is_top10'] ?? 0)) === 1,
        'discountTiers' => isset($row['discount_tiers']) ? json_decode($row['discount_tiers'], true) : [],
        'isBuiltin' => (bool) $row['is_builtin'],
        'lastUpdated' => $row['updated_at'] ?? null,
        'qtyOnHand' => isset($row['qty_on_hand']) ? (int) $row['qty_on_hand'] : 0,
    ];

    if ($includeInternal && isset($row['buy_price']) && $row['buy_price'] !== null) {
        $mapped['buyPrice'] = (float) $row['buy_price'];
    }
    if ($includeInternal) {
        $mapped['qtyOnHand'] = isset($row['qty_on_hand']) ? (int) $row['qty_on_hand'] : 0;
    }

    return $mapped;
}
