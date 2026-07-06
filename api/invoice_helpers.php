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
    ];
}

function createInvoiceFromOrder(mysqli $conn, string $orderId): ?array {
    $check = $conn->prepare('SELECT invoice_id FROM invoices WHERE order_id = ? LIMIT 1');
    $check->bind_param('s', $orderId);
    $check->execute();
    $existing = $check->get_result()->fetch_assoc();
    if ($existing) {
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
    $platformFee = round($subtotal * 0.01, 2);
    $stampDuty = round($subtotal * 0.00015, 2);
    $total = (float) $order['total_amount'];
    if ($total <= 0) {
        $total = round($subtotal + $platformFee + $stampDuty, 2);
    }

    $invoiceId = generateInvoiceId($conn);
    $invoiceDate = date('Y-m-d');
    $status = $order['status'];

    $ins = $conn->prepare(
        'INSERT INTO invoices (invoice_id, order_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker, quantity, price_per_share, subtotal, platform_fee, stamp_duty, total_amount, payment_method, transaction_id, status, invoice_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->bind_param(
        'sssssssssiddddssss',
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
        $invoiceDate
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
