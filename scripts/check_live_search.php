#!/usr/bin/env php
<?php
/**
 * Check live DB (if GU_DB_HOST set) or local DB + live API search simulation.
 * Usage: source .env.local 2>/dev/null; php scripts/check_live_search.php [search-term]
 */
declare(strict_types=1);

$search = $argv[1] ?? 'UTRTEST123';

// Load repo-root .env.local when present (gitignored).
$envFile = dirname(__DIR__) . '/.env.local';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v, " \t\"'");
        if ($k !== '' && getenv($k) === false) {
            putenv("{$k}={$v}");
            $_ENV[$k] = $v;
        }
    }
}

function matchesSearch(string $q, string ...$fields): bool
{
    $q = trim($q);
    if ($q === '') {
        return true;
    }
    $ql = strtolower($q);
    $qDigits = preg_replace('/\D/', '', $q);
    $qNorm = strtoupper(preg_replace('/\s+/', '', $q));

    foreach ($fields as $field) {
        if ($field === '') {
            continue;
        }
        if (str_contains(strtolower($field), $ql)) {
            return true;
        }
        if (strlen($qNorm) >= 2 && str_contains(strtoupper(preg_replace('/\s+/', '', $field)), $qNorm)) {
            return true;
        }
        if (strlen($qDigits) >= 3 && str_contains(preg_replace('/\D/', '', $field), $qDigits)) {
            return true;
        }
    }
    return false;
}

echo "=== Database check ===\n";
require dirname(__DIR__) . '/api/db_config.php';
$c = new mysqli($host, $db_user, $db_pass, $db_name);
if ($c->connect_error) {
    echo "DB connect failed ({$host}/{$db_name}): {$c->connect_error}\n";
    if (getenv('GU_DB_HOST') === false || getenv('GU_DB_HOST') === '') {
        echo "Tip: Set GU_DB_HOST in .env.local (Hostinger → Databases → Remote MySQL) for live DB from your Mac.\n";
    }
} else {
    echo "Connected: {$db_name} @ {$host}\n\n";

    $statusRes = $c->query('SELECT status, COUNT(*) n FROM orders GROUP BY status ORDER BY n DESC');
    echo "Orders by status:\n";
    while ($row = $statusRes->fetch_assoc()) {
        echo "  {$row['status']}: {$row['n']}\n";
    }

    $all = [];
    $res = $c->query(
        "SELECT order_id, buyer_name, buyer_phone, buyer_email, transaction_id, status,
                CONVERT_TZ(created_at, '+00:00', '+05:30') AS ist
         FROM orders ORDER BY created_at DESC"
    );
    while ($row = $res->fetch_assoc()) {
        $all[] = $row;
    }

    $pending = array_filter($all, fn($o) => stripos($o['status'], 'pending') !== false);
    echo "\nPending Verification: " . count($pending) . " of " . count($all) . " total\n";

    $hits = array_values(array_filter(
        $all,
        fn($o) => matchesSearch(
            $search,
            $o['order_id'],
            $o['buyer_name'],
            $o['buyer_email'],
            $o['buyer_phone'],
            $o['transaction_id'] ?? '',
            $o['transaction_id'] ?? ''
        )
    ));
    echo "\nSearch \"{$search}\" → " . count($hits) . " match(es):\n";
    foreach (array_slice($hits, 0, 10) as $o) {
        echo "  {$o['order_id']} | {$o['status']} | UTR=" . ($o['transaction_id'] ?: '—') . " | {$o['buyer_name']} | {$o['ist']}\n";
    }
    if (count($hits) > 10) {
        echo "  … and " . (count($hits) - 10) . " more\n";
    }
}

echo "\n=== Live API (go-unlisted.com) ===\n";
$api = getenv('GU_API_TARGET') ?: 'https://go-unlisted.com';
$api = rtrim($api, '/') . '/api/api.php';
$email = getenv('GU_ADMIN_EMAIL') ?: '';
$pass = getenv('GU_ADMIN_PASSWORD') ?: '';

if ($email === '' || $pass === '') {
    echo "Set GU_ADMIN_EMAIL and GU_ADMIN_PASSWORD in .env.local\n";
    exit(0);
}

$cookie = tempnam(sys_get_temp_dir(), 'gu_ck_');
$ch = curl_init("{$api}?action=getCsrfToken");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_COOKIEJAR => $cookie,
    CURLOPT_COOKIEFILE => $cookie,
]);
$csrf = json_decode((string) curl_exec($ch), true)['csrfToken'] ?? '';
curl_close($ch);

$ch = curl_init("{$api}?action=loginAdmin");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_COOKIEJAR => $cookie,
    CURLOPT_COOKIEFILE => $cookie,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', "X-CSRF-Token: {$csrf}"],
    CURLOPT_POSTFIELDS => json_encode(['email' => $email, 'password' => $pass]),
]);
$login = json_decode((string) curl_exec($ch), true);
curl_close($ch);

if (!($login['success'] ?? false)) {
    echo "Admin login failed: " . ($login['error'] ?? json_encode($login)) . "\n";
    echo "(Production admin password may differ from .env.local)\n";
    @unlink($cookie);
    exit(0);
}
echo "Admin login: OK\n";

$ch = curl_init("{$api}?action=getOrders");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_COOKIEFILE => $cookie,
]);
$orders = json_decode((string) curl_exec($ch), true);
curl_close($ch);
@unlink($cookie);

if (!is_array($orders)) {
    echo "getOrders error: " . json_encode($orders) . "\n";
    exit(0);
}

$pendingApi = 0;
foreach ($orders as $o) {
    $s = strtolower((string) ($o['status'] ?? ''));
    if (str_contains($s, 'pending') || $s === 'initiated') {
        $pendingApi++;
    }
}
echo "getOrders returned: " . count($orders) . " orders, {$pendingApi} pending\n";

$apiHits = array_values(array_filter(
    $orders,
    fn($o) => matchesSearch(
        $search,
        (string) ($o['orderId'] ?? ''),
        (string) ($o['buyerName'] ?? ''),
        (string) ($o['buyerEmail'] ?? ''),
        (string) ($o['buyerPhone'] ?? ''),
        (string) ($o['transactionId'] ?? ''),
        (string) ($o['utr'] ?? '')
    )
));
echo "Search \"{$search}\" via API → " . count($apiHits) . " match(es):\n";
foreach (array_slice($apiHits, 0, 10) as $o) {
    echo '  ' . ($o['orderId'] ?? '') . ' | ' . ($o['status'] ?? '') . ' | UTR=' . (($o['transactionId'] ?? '') ?: '—') . "\n";
}
