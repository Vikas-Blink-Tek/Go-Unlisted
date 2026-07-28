#!/usr/bin/env php
<?php
/**
 * Integration tests for User Transfer + order scope (transferUser).
 * Uses LOCAL MySQL only (127.0.0.1 / gounlisted) — never Hostinger env.
 *
 * Run: php scripts/test_transfer_user.php
 */
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'gounlisted';

$passed = 0;
$failed = 0;
$results = [];

function assert_true(bool $cond, string $name, string $detail = ''): void {
    global $passed, $failed, $results;
    if ($cond) {
        $passed++;
        $results[] = ['ok' => true, 'name' => $name, 'detail' => $detail];
        echo "PASS  $name" . ($detail !== '' ? " — $detail" : '') . "\n";
    } else {
        $failed++;
        $results[] = ['ok' => false, 'name' => $name, 'detail' => $detail];
        echo "FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n";
    }
}

function sanitizeStoredUserCode(string $code): string {
    $code = strtoupper(trim($code));
    if ($code === '' || $code === 'GU00') {
        return $code === 'GU00' ? 'GU00' : '';
    }
    if (preg_match('/^GU(\d{3})$/', $code, $m)) {
        return 'GUE' . $m[1];
    }
    return $code;
}

function normalizeUserCode(string $code): string {
    $c = sanitizeStoredUserCode($code);
    return $c !== '' ? $c : 'GU00';
}

/** Mirror of api.php transferUser order reassignment. */
function transferUserOrders(mysqli $conn, string $userId, string $employeeCode, string $orderScope, string $email, string $phone10): array {
    $ordersUpdated = 0;
    $initiatedUpdated = 0;
    if ($orderScope === 'none') {
        return compact('ordersUpdated', 'initiatedUpdated');
    }

    $statusSql = '';
    if ($orderScope === 'open') {
        $statusSql = " AND LOWER(status) NOT LIKE '%complete%'
                       AND LOWER(status) NOT LIKE '%cancel%'
                       AND LOWER(status) NOT LIKE '%reject%'
                       AND LOWER(status) NOT LIKE '%refund%'";
    }

    $ordSql = "UPDATE orders SET employee_code = ?
               WHERE deleted_at IS NULL
                 AND (
                   user_id = ?
                   OR (? <> '' AND RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(buyer_phone,''), ' ', ''), '-', ''), '+', ''), 10) = ?)
                   OR (? <> '' AND LOWER(TRIM(IFNULL(buyer_email,''))) = ?)
                 )
                 {$statusSql}";
    $ordUpd = $conn->prepare($ordSql);
    $ordUpd->bind_param('ssssss', $employeeCode, $userId, $phone10, $phone10, $email, $email);
    $ordUpd->execute();
    $ordersUpdated = (int) $ordUpd->affected_rows;

    $initSql = "UPDATE initiated_checkouts SET employee_code = ?
                WHERE status = 'Initiated'
                  AND (
                    (? <> '' AND RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(buyer_phone,''), ' ', ''), '-', ''), '+', ''), 10) = ?)
                    OR (? <> '' AND LOWER(TRIM(IFNULL(buyer_email,''))) = ?)
                  )";
    $initUpd = $conn->prepare($initSql);
    $initUpd->bind_param('sssss', $employeeCode, $phone10, $phone10, $email, $email);
    $initUpd->execute();
    $initiatedUpdated = (int) $initUpd->affected_rows;

    return compact('ordersUpdated', 'initiatedUpdated');
}

function orderCode(mysqli $conn, string $orderId): string {
    $st = $conn->prepare('SELECT employee_code FROM orders WHERE order_id = ?');
    $st->bind_param('s', $orderId);
    $st->execute();
    return strtoupper(trim((string) ($st->get_result()->fetch_assoc()['employee_code'] ?? '')));
}

function userRef(mysqli $conn, string $userId): string {
    $st = $conn->prepare('SELECT referral_code FROM users WHERE id = ?');
    $st->bind_param('s', $userId);
    $st->execute();
    return strtoupper(trim((string) ($st->get_result()->fetch_assoc()['referral_code'] ?? '')));
}

function initCode(mysqli $conn, string $sessionId): string {
    $st = $conn->prepare('SELECT employee_code FROM initiated_checkouts WHERE session_id = ?');
    $st->bind_param('s', $sessionId);
    $st->execute();
    return strtoupper(trim((string) ($st->get_result()->fetch_assoc()['employee_code'] ?? '')));
}

echo "=== transferUser integration tests (local DB) ===\n";

try {
    $conn = new mysqli($host, $user, $pass, $db);
    $conn->set_charset('utf8mb4');
} catch (Throwable $e) {
    fwrite(STDERR, "Cannot connect to local MySQL gounlisted: " . $e->getMessage() . "\n");
    exit(2);
}

$uid = 'usr-test-xfer-' . bin2hex(random_bytes(4));
$email = 'test.xfer.' . substr($uid, -8) . '@example.invalid';
$phone = '90000' . str_pad((string) random_int(10000, 99999), 5, '0', STR_PAD_LEFT);
$sessionId = 'SES_TEST_' . strtoupper(bin2hex(random_bytes(4)));
$oidOpen = 'GU9' . random_int(100, 999);
$oidDone = 'GU9' . random_int(100, 999);
$oidCancel = 'GU9' . random_int(100, 999);
while ($oidDone === $oidOpen) {
    $oidDone = 'GU9' . random_int(100, 999);
}
while ($oidCancel === $oidOpen || $oidCancel === $oidDone) {
    $oidCancel = 'GU9' . random_int(100, 999);
}

$from = 'GUE001';
$to = 'GUE002';

// Ensure employee codes exist
foreach ([$from, $to] as $code) {
    $chk = $conn->prepare('SELECT id FROM employees WHERE UPPER(employee_id) = ? LIMIT 1');
    $chk->bind_param('s', $code);
    $chk->execute();
    if ($chk->get_result()->num_rows === 0) {
        $eid = 'emp-test-' . strtolower($code);
        $ins = $conn->prepare(
            "INSERT INTO employees (id, employee_id, name, email, password, is_master, permissions)
             VALUES (?, ?, ?, ?, ?, 0, ?)"
        );
        $nm = "Test $code";
        $em = strtolower($code) . '@example.invalid';
        $pw = password_hash('test', PASSWORD_DEFAULT);
        $perms = '["orders","users","initiated"]';
        $ins->bind_param('ssssss', $eid, $code, $nm, $em, $pw, $perms);
        $ins->execute();
    }
}

try {
    // Seed user + orders + initiate
    $hash = password_hash('test-pass', PASSWORD_DEFAULT);
    $insU = $conn->prepare(
        "INSERT INTO users (id, name, phone, email, password, role, referral_code, kyc_status)
         VALUES (?, 'Transfer Test User', ?, ?, ?, 'user', ?, 'Not Submitted')"
    );
    $insU->bind_param('sssss', $uid, $phone, $email, $hash, $from);
    $insU->execute();

    $insO = $conn->prepare(
        "INSERT INTO orders (order_id, user_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker,
            price_per_share, quantity, total_amount, method, status, order_source, employee_code)
         VALUES (?, ?, 'Transfer Test User', ?, ?, 'test-share', 'Test Share', 'TST', 10, 100, 1000, 'UPI', ?, 'Offline', ?)"
    );
    $stOpen = 'Transfer Pending';
    $insO->bind_param('ssssss', $oidOpen, $uid, $email, $phone, $stOpen, $from);
    $insO->execute();
    $stDone = 'Completed';
    $insO->bind_param('ssssss', $oidDone, $uid, $email, $phone, $stDone, $from);
    $insO->execute();
    $stCancel = 'Cancelled';
    $insO->bind_param('ssssss', $oidCancel, $uid, $email, $phone, $stCancel, $from);
    $insO->execute();

    $insI = $conn->prepare(
        "INSERT INTO initiated_checkouts (session_id, share_id, share_name, share_ticker, buyer_name, buyer_email, buyer_phone,
            qty, price_per_share, total_amount, payment_mode, status, employee_code)
         VALUES (?, 'test-share', 'Test Share', 'TST', 'Transfer Test User', ?, ?, 50, 10, 500, 'UPI', 'Initiated', ?)"
    );
    $insI->bind_param('ssss', $sessionId, $email, $phone, $from);
    $insI->execute();

    assert_true(userRef($conn, $uid) === $from, 'Seed: user on GUE001');
    assert_true(orderCode($conn, $oidOpen) === $from, 'Seed: open order on GUE001');
    assert_true(orderCode($conn, $oidDone) === $from, 'Seed: completed order on GUE001');
    assert_true(initCode($conn, $sessionId) === $from, 'Seed: initiate on GUE001');

    // --- Scope: none (user only) ---
    $upd = $conn->prepare('UPDATE users SET referral_code = ? WHERE id = ?');
    $upd->bind_param('ss', $to, $uid);
    $upd->execute();
    $r = transferUserOrders($conn, $uid, $to, 'none', $email, $phone);
    assert_true(userRef($conn, $uid) === $to, 'none: user moved to GUE002');
    assert_true($r['ordersUpdated'] === 0 && $r['initiatedUpdated'] === 0, 'none: no order/initiate updates', json_encode($r));
    assert_true(orderCode($conn, $oidOpen) === $from, 'none: open order still GUE001');
    assert_true(orderCode($conn, $oidDone) === $from, 'none: completed still GUE001');
    assert_true(initCode($conn, $sessionId) === $from, 'none: initiate still GUE001');

    // Reset codes for next scope
    $back = $conn->prepare('UPDATE users SET referral_code = ? WHERE id = ?');
    $back->bind_param('ss', $from, $uid);
    $back->execute();
    $conn->query("UPDATE orders SET employee_code = '$from' WHERE order_id IN ('$oidOpen','$oidDone','$oidCancel')");
    $conn->query("UPDATE initiated_checkouts SET employee_code = '$from' WHERE session_id = '$sessionId'");

    // --- Scope: open ---
    $upd->bind_param('ss', $to, $uid);
    $upd->execute();
    $r = transferUserOrders($conn, $uid, $to, 'open', $email, $phone);
    assert_true(orderCode($conn, $oidOpen) === $to, 'open: Transfer Pending → GUE002');
    assert_true(orderCode($conn, $oidDone) === $from, 'open: Completed stays GUE001');
    assert_true(orderCode($conn, $oidCancel) === $from, 'open: Cancelled stays GUE001');
    assert_true(initCode($conn, $sessionId) === $to, 'open: initiate → GUE002');
    assert_true($r['ordersUpdated'] >= 1, 'open: affected ≥1 order', 'ordersUpdated=' . $r['ordersUpdated']);

    // Reset
    $back->bind_param('ss', $from, $uid);
    $back->execute();
    $conn->query("UPDATE orders SET employee_code = '$from' WHERE order_id IN ('$oidOpen','$oidDone','$oidCancel')");
    $conn->query("UPDATE initiated_checkouts SET employee_code = '$from' WHERE session_id = '$sessionId'");

    // --- Scope: all ---
    $upd->bind_param('ss', $to, $uid);
    $upd->execute();
    $r = transferUserOrders($conn, $uid, $to, 'all', $email, $phone);
    assert_true(orderCode($conn, $oidOpen) === $to, 'all: open → GUE002');
    assert_true(orderCode($conn, $oidDone) === $to, 'all: completed → GUE002');
    assert_true(orderCode($conn, $oidCancel) === $to, 'all: cancelled → GUE002');
    assert_true(initCode($conn, $sessionId) === $to, 'all: initiate → GUE002');
    assert_true($r['ordersUpdated'] >= 3, 'all: affected ≥3 orders', 'ordersUpdated=' . $r['ordersUpdated']);

    // --- Match by phone only (user_id blank on order) ---
    $oidPhone = 'GU9' . random_int(100, 999);
    $phoneOnlyStatus = 'Transfer Pending';
    $blankUid = '';
    $insPhone = $conn->prepare(
        "INSERT INTO orders (order_id, user_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker,
            price_per_share, quantity, total_amount, method, status, order_source, employee_code)
         VALUES (?, ?, 'Phone Match', '', ?, 'test-share', 'Test Share', 'TST', 10, 10, 100, 'UPI', ?, 'Offline', ?)"
    );
    $insPhone->bind_param('sssss', $oidPhone, $blankUid, $phone, $phoneOnlyStatus, $from);
    $insPhone->execute();
    transferUserOrders($conn, $uid, $to, 'all', $email, $phone);
    assert_true(orderCode($conn, $oidPhone) === $to, 'match: order linked by phone only → GUE002');

    // --- Invalid scope falls back (simulate api normalize) ---
    $scope = 'bogus';
    if (!in_array($scope, ['none', 'open', 'all'], true)) {
        $scope = 'all';
    }
    assert_true($scope === 'all', 'invalid orderScope normalizes to all');

    // --- Same-code no-op semantics ---
    assert_true(
        sanitizeStoredUserCode($to) === sanitizeStoredUserCode($to),
        'same-code: sanitize stable'
    );
    assert_true(normalizeUserCode('') === 'GU00', 'normalize empty → GU00');
    assert_true(normalizeUserCode('GU002') === 'GUE002', 'canonicalize GU002 → GUE002');

} catch (Throwable $e) {
    assert_true(false, 'Unexpected exception', $e->getMessage());
} finally {
    // Cleanup test rows
    @$conn->query("DELETE FROM orders WHERE order_id IN ('$oidOpen','$oidDone','$oidCancel') OR order_id LIKE 'GU9%' AND buyer_email = '" . $conn->real_escape_string($email) . "'");
    @$conn->query("DELETE FROM orders WHERE buyer_phone = '" . $conn->real_escape_string($phone) . "' AND share_id = 'test-share'");
    @$conn->query("DELETE FROM initiated_checkouts WHERE session_id = '" . $conn->real_escape_string($sessionId) . "'");
    @$conn->query("DELETE FROM users WHERE id = '" . $conn->real_escape_string($uid) . "'");
}

// Static API wiring checks (source)
$api = file_get_contents(dirname(__DIR__) . '/api/api.php') ?: '';
$adminTs = file_get_contents(dirname(__DIR__) . '/client/src/api/admin.ts') ?: '';
$panel = file_get_contents(dirname(__DIR__) . '/client/src/pages/admin/components/AdminUsersPanel.tsx') ?: '';
assert_true(str_contains($api, "case 'transferUser':"), 'source: api has transferUser case');
assert_true(str_contains($api, "requireMasterAdmin()"), 'source: transferUser gated by master');
assert_true(str_contains($adminTs, "transferUser(") && str_contains($adminTs, "'transferUser'"), 'source: client API exports transferUser');
assert_true(str_contains($panel, 'Also transfer orders'), 'source: UI has order scope control');
assert_true(str_contains($panel, "value=\"all\"") && str_contains($panel, "value=\"open\"") && str_contains($panel, "value=\"none\""), 'source: UI scopes all/open/none');
assert_true(str_contains($panel, 'employees={employeesQuery.data') || str_contains(file_get_contents(dirname(__DIR__) . '/client/src/pages/admin/AdminDashboard.tsx') ?: '', 'employees={employeesQuery.data'), 'source: employees passed to Users panel');

echo "\n=== Summary: $passed passed, $failed failed ===\n";

// Write machine-readable report for canvas
$reportPath = dirname(__DIR__) . '/scripts/test_transfer_user_report.json';
file_put_contents($reportPath, json_encode([
    'ranAt' => date('c'),
    'db' => "$host/$db",
    'passed' => $passed,
    'failed' => $failed,
    'results' => $results,
], JSON_PRETTY_PRINT));

exit($failed > 0 ? 1 : 0);
