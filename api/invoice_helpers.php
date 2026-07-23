<?php

function generateInvoiceId(mysqli $conn): string {
    $year = date('Y');
    $prefix = "GU-INV-{$year}-";
    $stmt = $conn->prepare("SELECT invoice_id FROM invoices WHERE invoice_id LIKE ? ORDER BY invoice_id DESC LIMIT 1");
    $like = $prefix . '%';
    $stmt->bind_param('s', $like);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $next = 1;
    if ($row && preg_match('/-(\d+)$/', $row['invoice_id'], $m)) {
        $next = (int) $m[1] + 1;
    }
    return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
}

function mapInvoiceRow(array $row): array {
    return [
        'invoiceId' => $row['invoice_id'],
        'orderId' => $row['order_id'],
        'buyerName' => $row['buyer_name'],
        'buyerEmail' => $row['buyer_email'],
        'buyerPhone' => $row['buyer_phone'] ?? '',
        'shareId' => $row['share_id'],
        'shareName' => $row['share_name'],
        'shareTicker' => $row['share_ticker'],
        'qty' => (int) $row['quantity'],
        'pricePerShare' => (float) $row['price_per_share'],
        'subtotal' => (float) $row['subtotal'],
        'platformFee' => (float) $row['platform_fee'],
        'stampDuty' => (float) $row['stamp_duty'],
        'totalAmount' => (float) $row['total_amount'],
        'paymentMethod' => $row['payment_method'] ?? '',
        'transactionId' => $row['transaction_id'] ?? '',
        'status' => $row['status'] ?? '',
        'invoiceDate' => $row['invoice_date'],
        'createdAt' => $row['created_at'],
        'includePlatformFee' => (float) ($row['platform_fee'] ?? 0) > 0,
        'includeStampDuty' => (float) ($row['stamp_duty'] ?? 0) > 0,
        'customChargesJson' => $row['custom_charges_json'] ?? null,
    ];
}

/**
 * @param array{includePlatformFee?: bool, includeStampDuty?: bool, updateExisting?: bool} $options
 */
function calcInvoiceCharges(float $subtotal, array $options): array {
    $includeFee = !empty($options['includePlatformFee']);
    $includeStamp = !empty($options['includeStampDuty']);
    $platformFee = $includeFee ? round($subtotal * 0.01, 2) : 0.0;
    $stampDuty = $includeStamp ? round($subtotal * 0.00015, 2) : 0.0;
    $total = round($subtotal + $platformFee + $stampDuty, 2);
    return [
        'platformFee' => $platformFee,
        'stampDuty' => $stampDuty,
        'total' => $total,
    ];
}

/**
 * Create invoice from order. Fees are optional via $options.
 * Auto-confirm callers omit options → both charges included (legacy default).
 * Manual generate passes includePlatformFee / includeStampDuty from checkboxes.
 * If invoice exists and updateExisting is true, recalculates fee lines.
 *
 * @param array{includePlatformFee?: bool, includeStampDuty?: bool, updateExisting?: bool} $options
 */
function createInvoiceFromOrder(mysqli $conn, string $orderId, array $options = []): ?array {
    $hasFeeOpt = array_key_exists('includePlatformFee', $options);
    $hasStampOpt = array_key_exists('includeStampDuty', $options);
    // Legacy auto-create (no options): include both. Explicit false/true from UI wins.
    $includePlatformFee = $hasFeeOpt ? !empty($options['includePlatformFee']) : true;
    $includeStampDuty = $hasStampOpt ? !empty($options['includeStampDuty']) : true;
    $updateExisting = !empty($options['updateExisting']) || $hasFeeOpt || $hasStampOpt;

    $chargeOpts = [
        'includePlatformFee' => $includePlatformFee,
        'includeStampDuty' => $includeStampDuty,
    ];

    $check = $conn->prepare('SELECT invoice_id FROM invoices WHERE order_id = ? LIMIT 1');
    $check->bind_param('s', $orderId);
    $check->execute();
    $existing = $check->get_result()->fetch_assoc();
    if ($existing) {
        if ($updateExisting) {
            return updateInvoiceCharges($conn, (string) $existing['invoice_id'], $chargeOpts);
        }
        $get = $conn->prepare('SELECT * FROM invoices WHERE invoice_id = ? LIMIT 1');
        $get->bind_param('s', $existing['invoice_id']);
        $get->execute();
        $row = $get->get_result()->fetch_assoc();
        return $row ? mapInvoiceRow($row) : null;
    }

    $stmt = $conn->prepare('SELECT * FROM orders WHERE order_id = ? LIMIT 1');
    $stmt->bind_param('s', $orderId);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    if (!$order) {
        return null;
    }

    $qty = (int) $order['quantity'];
    $price = (float) $order['price_per_share'];
    $subtotal = round($qty * $price, 2);
    $total = (float) $order['total_amount'];
    
    // Legacy fields for backward compatibility
    $platformFee = 0;
    $stampDuty = 0;
    $customChargesJson = $order['custom_charges_json'] ?? null;
    if ($customChargesJson === null) {
        $customChargesJson = '';
    }

    $invoiceId = generateInvoiceId($conn);
    $invoiceDate = date('Y-m-d');
    $status = $order['status'];

    $ins = $conn->prepare(
        'INSERT INTO invoices (invoice_id, order_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker, quantity, price_per_share, subtotal, platform_fee, stamp_duty, total_amount, payment_method, transaction_id, status, invoice_date, custom_charges_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    if (!$ins) {
        error_log('createInvoiceFromOrder prepare failed: ' . $conn->error);
        return null;
    }
    // 8s + i + 5d + 5s = 19 params (qty int; price/subtotal/fee/stamp/total doubles)
    $ins->bind_param(
        'ssssssssidddddsssss',
        $invoiceId,
        $order['order_id'],
        $order['buyer_name'],
        $order['buyer_email'],
        $order['buyer_phone'],
        $order['share_id'],
        $order['share_name'],
        $order['share_ticker'],
        $qty,
        $price,
        $subtotal,
        $platformFee,
        $stampDuty,
        $total,
        $order['method'],
        $order['transaction_id'],
        $status,
        $invoiceDate,
        $customChargesJson
    );
    if (!$ins->execute()) {
        return null;
    }

    $get = $conn->prepare('SELECT * FROM invoices WHERE invoice_id = ? LIMIT 1');
    $get->bind_param('s', $invoiceId);
    $get->execute();
    $row = $get->get_result()->fetch_assoc();
    return $row ? mapInvoiceRow($row) : null;
}

/**
 * Recalculate platform fee / stamp duty on an existing invoice.
 *
 * @param array{includePlatformFee?: bool, includeStampDuty?: bool} $options
 */
function updateInvoiceCharges(mysqli $conn, string $invoiceId, array $options): ?array {
    $get = $conn->prepare('SELECT * FROM invoices WHERE invoice_id = ? LIMIT 1');
    $get->bind_param('s', $invoiceId);
    $get->execute();
    $row = $get->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }

    $subtotal = (float) $row['subtotal'];
    $charges = calcInvoiceCharges($subtotal, $options);
    $platformFee = $charges['platformFee'];
    $stampDuty = $charges['stampDuty'];
    $total = $charges['total'];

    $upd = $conn->prepare(
        'UPDATE invoices SET platform_fee = ?, stamp_duty = ?, total_amount = ? WHERE invoice_id = ?'
    );
    $upd->bind_param('ddds', $platformFee, $stampDuty, $total, $invoiceId);
    if (!$upd->execute()) {
        return null;
    }

    $get2 = $conn->prepare('SELECT * FROM invoices WHERE invoice_id = ? LIMIT 1');
    $get2->bind_param('s', $invoiceId);
    $get2->execute();
    $updated = $get2->get_result()->fetch_assoc();
    return $updated ? mapInvoiceRow($updated) : null;
}
