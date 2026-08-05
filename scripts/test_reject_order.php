#!/usr/bin/env php
<?php
/**
 * Tests: Order Reject — canReject rules + DB status flip Transfer Pending → Rejected.
 * Local MySQL only (127.0.0.1 / gounlisted).
 *
 * Run: php scripts/test_reject_order.php
 */
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'gounlisted';

$passed = 0;
$failed = 0;

function assert_true(bool $cond, string $name, string $detail = ''): void {
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "PASS  $name" . ($detail !== '' ? " — $detail" : '') . "\n";
    } else {
        $failed++;
        echo "FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n";
    }
}

/** Mirror of client canRejectOrder() */
function canRejectOrder(string $status): bool {
    $s = strtolower($status);
    if (str_contains($s, 'complete') || str_contains($s, 'cancel') || str_contains($s, 'reject') || str_contains($s, 'refund')) {
        return false;
    }
    // pending payment (not transfer)
    if (!str_contains($s, 'transfer') && (str_contains($s, 'pending verification') || $s === 'pending' || $s === 'initiated')) {
        return true;
    }
    // transfer pending / legacy confirmed|verified
    if (str_contains($s, 'transfer')) {
        return true;
    }
    if (str_contains($s, 'confirm') || str_contains($s, 'verif')) {
        return true;
    }
    return false;
}

echo "=== canRejectOrder (UI gate) ===\n";
$logicCases = [
    ['Pending Verification', true],
    ['Transfer Pending', true],
    ['Confirmed', true],
    ['Completed', false],
    ['Rejected', false],
    ['Cancelled', false],
    ['Refunded', false],
    ['Initiated', true],
];
foreach ($logicCases as [$status, $expect]) {
    $got = canRejectOrder($status);
    assert_true($got === $expect, "canRejectOrder($status)", "got " . ($got ? 'true' : 'false'));
}

echo "\n=== DB: Transfer Pending → Rejected ===\n";
try {
    $conn = new mysqli($host, $user, $pass, $db);
    $conn->set_charset('utf8mb4');
} catch (Throwable $e) {
    echo "SKIP  DB unavailable — {$e->getMessage()}\n";
    echo "\nDone: $passed passed, $failed failed (logic only)\n";
    exit($failed > 0 ? 1 : 0);
}

$testId = 'TSTREJ' . substr((string) time(), -5);
$shareId = 'test-reject-share';
$buyer = 'Reject Test Buyer';
$email = 'reject-test@example.com';
$phone = '9999900001';
$statusTp = 'Transfer Pending';
$statusRj = 'Rejected';
$now = date('Y-m-d H:i:s');

try {
    // ensure minimal share row optional — orders may not FK enforce
    $ins = $conn->prepare(
        "INSERT INTO orders (
            order_id, user_id, buyer_name, buyer_email, buyer_phone,
            share_id, share_name, share_ticker, price_per_share, quantity,
            total_paid, payment_method, transaction_id, status, order_source,
            employee_code, created_at
         ) VALUES (?, NULL, ?, ?, ?, ?, 'Test Co', 'TST', 10, 1, 10, 'UPI', 'UTRTESTREJ1', ?, 'Online', 'GUE001', ?)"
    );
    // adapt columns if schema differs — try then diagnose
} catch (Throwable $e) {
    // fall through to flexible insert
}

$cols = [];
$res = $conn->query('SHOW COLUMNS FROM orders');
while ($row = $res->fetch_assoc()) {
    $cols[$row['Field']] = true;
}

$fields = ['order_id', 'user_id', 'buyer_name', 'buyer_email', 'buyer_phone', 'share_id', 'share_name', 'price_per_share', 'quantity', 'status'];
$values = [$testId, 'user-reject-test', $buyer, $email, $phone, $shareId, 'Test Co', 10.0, 1, $statusTp];
$types = 'sssssssdis';

if (isset($cols['share_ticker'])) {
    $fields[] = 'share_ticker';
    $values[] = 'TST';
    $types .= 's';
}
if (isset($cols['total_amount'])) {
    $fields[] = 'total_amount';
    $values[] = 10.0;
    $types .= 'd';
} elseif (isset($cols['total_paid'])) {
    $fields[] = 'total_paid';
    $values[] = 10.0;
    $types .= 'd';
}
if (isset($cols['method'])) {
    $fields[] = 'method';
    $values[] = 'UPI';
    $types .= 's';
} elseif (isset($cols['payment_method'])) {
    $fields[] = 'payment_method';
    $values[] = 'UPI';
    $types .= 's';
}
if (isset($cols['transaction_id'])) {
    $fields[] = 'transaction_id';
    $values[] = 'UTRTESTREJ1';
    $types .= 's';
}
if (isset($cols['order_source'])) {
    $fields[] = 'order_source';
    $values[] = 'Online';
    $types .= 's';
}
if (isset($cols['employee_code'])) {
    $fields[] = 'employee_code';
    $values[] = 'GUE001';
    $types .= 's';
}
if (isset($cols['created_at'])) {
    $fields[] = 'created_at';
    $values[] = $now;
    $types .= 's';
}

$ph = implode(',', array_fill(0, count($fields), '?'));
$sql = 'INSERT INTO orders (' . implode(',', $fields) . ') VALUES (' . $ph . ')';
$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$values);
$stmt->execute();
assert_true($stmt->affected_rows === 1, 'insert Transfer Pending test order', $testId);

$chk = $conn->prepare('SELECT status FROM orders WHERE order_id = ?');
$chk->bind_param('s', $testId);
$chk->execute();
$row = $chk->get_result()->fetch_assoc();
assert_true(($row['status'] ?? '') === $statusTp, 'status is Transfer Pending before reject');

$upd = $conn->prepare('UPDATE orders SET status = ? WHERE order_id = ?');
$upd->bind_param('ss', $statusRj, $testId);
$upd->execute();
assert_true($upd->affected_rows === 1, 'update status to Rejected');

$chk->execute();
$row = $chk->get_result()->fetch_assoc();
assert_true(($row['status'] ?? '') === $statusRj, 'status is Rejected after update');
assert_true(!canRejectOrder($row['status']), 'canRejectOrder false after Rejected');

// cleanup
$del = $conn->prepare('DELETE FROM orders WHERE order_id = ?');
$del->bind_param('s', $testId);
$del->execute();
assert_true($del->affected_rows >= 1, 'cleanup deleted test order');

$conn->close();

echo "\n=== Source wiring ===\n";
$root = dirname(__DIR__);
$drawer = file_get_contents($root . '/client/src/pages/admin/components/OrderDetailDrawer.tsx');
$section = file_get_contents($root . '/client/src/pages/admin/components/AdminOrdersSection.tsx');
$statusUtil = file_get_contents($root . '/client/src/utils/orderStatus.ts');

assert_true(str_contains($statusUtil, 'function canRejectOrder'), 'orderStatus exports canRejectOrder');
assert_true(str_contains($drawer, 'canRejectOrder'), 'OrderDetailDrawer uses canRejectOrder');
assert_true(str_contains($drawer, 'Reject order'), 'drawer label Reject order');
assert_true(str_contains($section, 'canRejectOrder'), 'AdminOrdersSection uses canRejectOrder');

echo "\nDone: $passed passed, $failed failed\n";
exit($failed > 0 ? 1 : 0);
