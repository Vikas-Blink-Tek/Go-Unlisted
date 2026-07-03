<?php
// ============================================================
// Go-Unlisted — Backend API (Local XAMPP + ngrok compatible)
// ============================================================

// 1. Session & Error Security
ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 1 : 0);
ini_set('session.cookie_samesite', 'Lax');
session_start();

// 2. CORS — Allow same-origin, localhost, ngrok (SEC: no wildcard with credentials)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
$allowedPatterns = ['http://localhost', 'https://localhost', 'http://127.0.0.1', 'https://127.0.0.1', 'https://*.ngrok-free.app'];
$allowed = false;
if ($origin) {
    foreach ($allowedPatterns as $pattern) {
        if (strpos($pattern, '*') !== false) {
            $regex = str_replace('\*', '.*', preg_quote($pattern, '/'));
            if (preg_match('/^' . $regex . '$/', $origin)) { $allowed = true; break; }
        } else {
            if (strpos($origin, $pattern) === 0) { $allowed = true; break; }
        }
    }
    if (!$allowed) {
        $originHost = parse_url($origin, PHP_URL_HOST);
        if ($originHost && $host && strcasecmp($originHost, explode(':', $host)[0]) === 0) {
            $allowed = true;
        }
    }
}
if ($allowed && $origin) {
    header("Access-Control-Allow-Origin: " . $origin);
} elseif (!$origin) {
    // Same-origin requests omit Origin header — no CORS header needed
} else {
    http_response_code(403);
    echo json_encode(["error" => "Origin not allowed"]);
    exit;
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-CSRF-Token");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// Security Headers
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Strict-Transport-Security: max-age=31536000; includeSubDomains");
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}


require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/share_helpers.php';

$conn = new mysqli($host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

// -----------------------------------------
// AUTO-MIGRATE SCHEMA
// -----------------------------------------
function autoMigrateSchema($conn) {
    $res = $conn->query("SHOW COLUMNS FROM employees LIKE 'employee_id'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE employees ADD COLUMN employee_id VARCHAR(50) UNIQUE AFTER id");
    }
    
    $res = $conn->query("SHOW COLUMNS FROM orders LIKE 'transaction_id'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE orders ADD COLUMN transaction_id VARCHAR(100) AFTER method");
    }
    
    $conn->query("CREATE TABLE IF NOT EXISTS settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value TEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $conn->query("CREATE TABLE IF NOT EXISTS otps (id INT AUTO_INCREMENT PRIMARY KEY, identifier VARCHAR(100), otp_code VARCHAR(10), expires_at DATETIME) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $conn->query("CREATE TABLE IF NOT EXISTS login_attempts (id INT AUTO_INCREMENT PRIMARY KEY, ip_address VARCHAR(45), attempt_time DATETIME) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $conn->query("CREATE TABLE IF NOT EXISTS otp_attempts (id INT AUTO_INCREMENT PRIMARY KEY, identifier VARCHAR(100), ip_address VARCHAR(45), attempt_time DATETIME) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $conn->query("CREATE TABLE IF NOT EXISTS contact_messages (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), message TEXT, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $conn->query("CREATE TABLE IF NOT EXISTS otp_ip_attempts (id INT AUTO_INCREMENT PRIMARY KEY, ip_address VARCHAR(45), attempt_time DATETIME) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        user_id VARCHAR(50) DEFAULT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        details TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS otp_send_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(100) DEFAULT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        attempt_time DATETIME DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $res = $conn->query("SHOW COLUMNS FROM otps LIKE 'otp_code'");
    if ($res && ($col = $res->fetch_assoc()) && strpos($col['Type'], 'varchar(10)') !== false) {
        $conn->query("ALTER TABLE otps MODIFY otp_code VARCHAR(255) NOT NULL");
    }

    $res = $conn->query("SHOW COLUMNS FROM users LIKE 'bank_account'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN bank_account VARCHAR(30) DEFAULT NULL AFTER kyc_demat");
    }
    $res = $conn->query("SHOW COLUMNS FROM users LIKE 'ifsc'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN ifsc VARCHAR(15) DEFAULT NULL AFTER bank_account");
    }
    $res = $conn->query("SHOW COLUMNS FROM users LIKE 'kyc_reject_reason'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN kyc_reject_reason VARCHAR(255) DEFAULT NULL AFTER kyc_status");
    }

    $res = $conn->query("SHOW COLUMNS FROM orders LIKE 'ops_note'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE orders ADD COLUMN ops_note VARCHAR(500) DEFAULT NULL AFTER status");
    }

    $conn->query("CREATE TABLE IF NOT EXISTS initiated_checkouts (
        session_id VARCHAR(64) PRIMARY KEY,
        share_id VARCHAR(50) NOT NULL,
        share_name VARCHAR(100) NOT NULL,
        share_ticker VARCHAR(50) DEFAULT '',
        buyer_name VARCHAR(100) DEFAULT '',
        buyer_email VARCHAR(100) DEFAULT '',
        buyer_phone VARCHAR(20) DEFAULT '',
        qty INT NOT NULL DEFAULT 1,
        price_per_share DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        payment_mode VARCHAR(50) DEFAULT '',
        status VARCHAR(50) NOT NULL DEFAULT 'Initiated',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $res = $conn->query("SHOW COLUMNS FROM orders LIKE 'order_source'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE orders ADD COLUMN order_source VARCHAR(30) DEFAULT 'Online' AFTER status");
    }

    $conn->query("CREATE TABLE IF NOT EXISTS shares (
        share_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        ticker VARCHAR(20) NOT NULL DEFAULT '',
        sector VARCHAR(50) NOT NULL DEFAULT '',
        sector_color VARCHAR(20) DEFAULT '#7ac142',
        base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        min_qty INT NOT NULL DEFAULT 1,
        description TEXT,
        founded INT DEFAULT NULL,
        revenue VARCHAR(50) DEFAULT '',
        valuation VARCHAR(50) DEFAULT '',
        growth VARCHAR(20) DEFAULT '',
        change_positive TINYINT(1) NOT NULL DEFAULT 1,
        logo_initials VARCHAR(5) DEFAULT '',
        logo_gradient VARCHAR(200) DEFAULT '',
        price_history JSON DEFAULT NULL,
        chart_labels JSON DEFAULT NULL,
        is_builtin TINYINT(1) NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    seedDefaultSharesIfEmpty($conn);

    $shareCols = [
        'listing_type' => "VARCHAR(30) DEFAULT 'Pre-IPO'",
        'ipo_timeline' => "VARCHAR(120) DEFAULT ''",
        'buy_price' => 'DECIMAL(12,2) DEFAULT NULL',
        'inventory_status' => "VARCHAR(30) DEFAULT 'In Stock'",
        'key_highlights' => 'TEXT',
        'risk_notes' => 'TEXT',
        'lock_in_months' => 'INT DEFAULT 6',
        'is_featured' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ];
    foreach ($shareCols as $col => $def) {
        $res = $conn->query("SHOW COLUMNS FROM shares LIKE '$col'");
        if ($res && $res->num_rows === 0) {
            $conn->query("ALTER TABLE shares ADD COLUMN $col $def");
        }
    }

    $cfgRes = $conn->query("SELECT share_id, base_price FROM shares_config");
    if ($cfgRes) {
        while ($cfgRow = $cfgRes->fetch_assoc()) {
            $sync = $conn->prepare("UPDATE shares SET base_price = ? WHERE share_id = ?");
            $sync->bind_param('ds', $cfgRow['base_price'], $cfgRow['share_id']);
            $sync->execute();
        }
    }
}
autoMigrateSchema($conn);
if (getenv('GU_DEV_MODE') === '1') {
    seedDemoUserIfEmpty($conn);
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

// Helper to get POST data safely
function getPostData() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

// -----------------------------------------
// AUTHENTICATION & SECURITY HELPERS
// -----------------------------------------
function getClientIP() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
}

function isValidEmail($email) {
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function isValidMpin($mpin) {
    return (bool) preg_match('/^\d{4,6}$/', (string) $mpin);
}

function isLocalDev(): bool {
    if (getenv('GU_DEV_MODE') === '1') {
        return true;
    }
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return (bool) preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $host);
}

function isValidIndianMobile($phone) {
    $p = normalizeIndianPhone($phone);
    return (bool) preg_match('/^[6-9]\d{9}$/', $p);
}

function phoneOtpIdentifier($phone) {
    return 'phone:' . normalizeIndianPhone($phone);
}

function issueRegistrationOtp($conn, $phone, $email, $msg91_auth_key, $msg91_template_id, $msg91_sender_id) {
    $phoneNorm = normalizeIndianPhone($phone);
    if (!isValidIndianMobile($phoneNorm)) {
        return ['success' => false, 'error' => 'Enter a valid 10-digit Indian mobile number (starts with 6–9)'];
    }

    $email = strtolower(trim($email));
    if (!isValidEmail($email)) {
        return ['success' => false, 'error' => 'Invalid email address'];
    }

    $dupPhone = $conn->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
    $dupPhone->bind_param('s', $phoneNorm);
    $dupPhone->execute();
    if ($dupPhone->get_result()->num_rows > 0) {
        return ['success' => false, 'error' => 'This phone number is already registered. Try logging in instead.'];
    }

    $dupEmail = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $dupEmail->bind_param('s', $email);
    $dupEmail->execute();
    if ($dupEmail->get_result()->num_rows > 0) {
        return ['success' => false, 'error' => 'This email is already registered. Try logging in instead.'];
    }

    $otp = sprintf('%06d', random_int(100000, 999999));
    $otpHash = password_hash($otp, PASSWORD_DEFAULT);
    $identifier = phoneOtpIdentifier($phoneNorm);

    $stmt = $conn->prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))');
    $stmt->bind_param('ss', $identifier, $otpHash);
    $stmt->execute();

    $localDev = getenv('GU_DEV_MODE') === '1' || isLocalDev();
    $smsResult = null;

    if (!empty($msg91_auth_key)) {
        $smsResult = sendMsg91Otp($msg91_auth_key, $phoneNorm, $otp, $msg91_template_id ?? '', $msg91_sender_id ?? 'GOUNLS');
        if (!$smsResult['success']) {
            error_log('MSG91 registration OTP failed for ' . formatMsg91Mobile($phoneNorm) . ': ' . json_encode($smsResult));
        }
    } else {
        $smsResult = ['success' => false, 'error' => 'SMS gateway not configured on server'];
    }

    if (!$localDev && (!$smsResult || !$smsResult['success'])) {
        return [
            'success' => false,
            'error' => $smsResult['error'] ?? 'Could not send OTP to your phone. Please check the number and try again.',
        ];
    }

    if ($localDev) {
        error_log("DEV OTP for phone {$phoneNorm} (reg): {$otp}");
    }

    return [
        'success' => true,
        'message' => $localDev
            ? 'OTP generated (local dev — check api/php_errors.log)'
            : 'OTP sent to your phone',
        'sms_sent' => $smsResult['success'] ?? false,
        'dev_mode' => $localDev,
        'phone' => $phoneNorm,
    ];
}

function seedDemoUserIfEmpty(mysqli $conn): void {
    if (getenv('GU_DEV_MODE') !== '1') {
        return;
    }
    $id = 'usr-demo-local';
    $name = 'Demo Investor';
    $phone = '9876543210';
    $email = 'demo@gounlisted.com';
    $hash = password_hash('1234', PASSWORD_DEFAULT);
    $role = 'user';
    $referral = '';
    $kyc = 'Not Submitted';
    $stmt = $conn->prepare(
        'INSERT INTO users (id, name, phone, email, password, role, referral_code, kyc_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), password=VALUES(password), kyc_status=VALUES(kyc_status)'
    );
    $stmt->bind_param('ssssssss', $id, $name, $phone, $email, $hash, $role, $referral, $kyc);
    $stmt->execute();
}

function issueOtpForEmail($conn, $email, $phone, $msg91_auth_key, $msg91_template_id, $msg91_sender_id) {
    $email = strtolower(trim($email));
    $otp = sprintf('%06d', random_int(100000, 999999));
    $otpHash = password_hash($otp, PASSWORD_DEFAULT);

    $stmt = $conn->prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))');
    $stmt->bind_param('ss', $email, $otpHash);
    $stmt->execute();

    $subject = 'Your Go-Unlisted Verification Code';
    $message = "Welcome to Go-Unlisted!\n\nYour OTP code is: $otp\n\nThis code will expire in 10 minutes. Do not share this code with anyone.";
    $headers = 'From: noreply@gounlisted.com';
    @mail($email, $subject, $message, $headers);

    $smsResult = null;
    $phoneNorm = normalizeIndianPhone($phone);
    if (!empty($phoneNorm) && strlen($phoneNorm) === 10 && !empty($msg91_auth_key)) {
        $smsResult = sendMsg91Otp($msg91_auth_key, $phoneNorm, $otp, $msg91_template_id ?? '', $msg91_sender_id ?? 'GOUNLS');
        if (!$smsResult['success']) {
            error_log('MSG91 failed for ' . formatMsg91Mobile($phoneNorm) . ': ' . json_encode($smsResult));
        }
    } elseif (!empty($phoneNorm) && strlen($phoneNorm) === 10 && empty($msg91_auth_key)) {
        $smsResult = ['success' => false, 'error' => 'MSG91_AUTH_KEY not configured'];
    }

    $response = ['success' => true, 'message' => 'OTP sent successfully'];
    if (getenv('GU_DEV_MODE') === '1' || isLocalDev()) {
        error_log("DEV OTP for {$email}: {$otp}");
        $response['dev_mode'] = true;
        $response['message'] = 'OTP generated (local dev — check api/php_errors.log if email/SMS did not arrive)';
    }
    if ($smsResult !== null) {
        $response['sms_sent'] = $smsResult['success'];
        if (!$smsResult['success']) {
            $response['sms_error'] = $smsResult['error'] ?? 'SMS delivery failed';
            if (empty($msg91_auth_key)) {
                $response['sms_error'] = 'SMS not configured — add MSG91 key in api/db_config.local.php';
            }
        }
    }

    return $response;
}

function sanitizeArticleHtml($html) {
    $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $html);
    $html = preg_replace('/<iframe\b[^>]*>.*?<\/iframe>/is', '', $html);
    $html = preg_replace('/\s+on\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html);
    $html = preg_replace('/javascript\s*:/i', '', $html);
    $allowed = '<p><br><strong><em><b><i><ul><ol><li><h1><h2><h3><h4><h5><h6><a><img><blockquote><code><pre><span><div><table><thead><tbody><tr><th><td>';
    return strip_tags($html, $allowed);
}

const PUBLIC_SETTINGS_KEYS = [
    'email', 'mobile', 'whatsapp', 'address', 'disclaimer',
    'bank_name', 'bank_ac_name', 'bank_ac_no', 'bank_ifsc', 'bank_upi', 'bank_branch', 'bank_address',
];

function logAudit($conn, $action, $user_id, $details) {
    $ip = getClientIP();
    $detailsJson = json_encode($details);
    $stmt = $conn->prepare("INSERT INTO audit_log (action, user_id, ip_address, details) VALUES (?, ?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("ssss", $action, $user_id, $ip, $detailsJson);
        @$stmt->execute();
    }
}

function checkRateLimit($conn, $table, $identifierColumn, $identifierValue, $maxAttempts, $timeMinutes) {
    $ip = getClientIP();
    // Delete old attempts to keep table small
    $conn->query("DELETE FROM $table WHERE attempt_time < DATE_SUB(NOW(), INTERVAL $timeMinutes MINUTE)");
    
    if ($identifierColumn) {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM $table WHERE $identifierColumn = ? AND attempt_time >= DATE_SUB(NOW(), INTERVAL $timeMinutes MINUTE)");
        $stmt->bind_param("s", $identifierValue);
    } else {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM $table WHERE ip_address = ? AND attempt_time >= DATE_SUB(NOW(), INTERVAL $timeMinutes MINUTE)");
        $stmt->bind_param("s", $ip);
    }
    
    $stmt->execute();
    $count = $stmt->get_result()->fetch_assoc()['count'];
    return $count >= $maxAttempts;
}

function recordAttempt($conn, $table, $identifierColumn, $identifierValue) {
    $ip = getClientIP();
    if ($identifierColumn) {
        $stmt = $conn->prepare("INSERT INTO $table ($identifierColumn, ip_address, attempt_time) VALUES (?, ?, NOW())");
        $stmt->bind_param("ss", $identifierValue, $ip);
    } else {
        $stmt = $conn->prepare("INSERT INTO $table (ip_address, attempt_time) VALUES (?, NOW())");
        $stmt->bind_param("s", $ip);
    }
    $stmt->execute();
}

function requireAdmin() {
    if (!isset($_SESSION['admin_id'])) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized access. Admin privileges required."]);
        exit;
    }
}

function requireMasterAdmin() {
    requireAdmin();
    if (empty($_SESSION['is_master'])) {
        http_response_code(403);
        echo json_encode(["error" => "Forbidden. Master Admin privileges required."]);
        exit;
    }
}

function requireAuth() {
    if (!isset($_SESSION['user_id']) && !isset($_SESSION['admin_id'])) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized access. Please log in."]);
        exit;
    }
}

function sendResponse($data) {
    echo json_encode($data);
    exit;
}

function ensureCsrfToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validateCsrfToken() {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        http_response_code(403);
        sendResponse(["error" => "Invalid or missing CSRF token. Please refresh the page."]);
    }
}

function checkIpRateLimit($conn, $table, $maxAttempts, $timeMinutes) {
    return checkRateLimit($conn, $table, null, null, $maxAttempts, $timeMinutes);
}

function recordIpAttempt($conn, $table) {
    recordAttempt($conn, $table, null, null);
}

function normalizeIndianPhone($phone) {
    $phone = preg_replace('/\D/', '', $phone);
    if (strlen($phone) === 12 && str_starts_with($phone, '91')) {
        return substr($phone, 2);
    }
    if (strlen($phone) === 11 && str_starts_with($phone, '0')) {
        return substr($phone, 1);
    }
    return $phone;
}

function formatMsg91Mobile($phone) {
    $phone = normalizeIndianPhone($phone);
    if (strlen($phone) !== 10) {
        return null;
    }
    return '91' . $phone;
}

function sendMsg91Otp($authKey, $phone, $otp, $templateId = '', $senderId = 'GOUNLS') {
    if (empty($authKey)) {
        return ['success' => false, 'error' => 'MSG91 not configured'];
    }

    $mobile = formatMsg91Mobile($phone);
    if ($mobile === null) {
        return ['success' => false, 'error' => 'Invalid phone number (need 10-digit Indian mobile)'];
    }

    $curl = curl_init();
    $headers = [
        'authkey: ' . $authKey,
        'content-type: application/json',
        'accept: application/json',
    ];

    if (!empty($templateId)) {
        // MSG91 SendOTP v5 — requires DLT-approved template for India
        $payload = [
            'template_id' => $templateId,
            'mobile' => $mobile,
            'otp' => $otp,
            'otp_length' => strlen($otp),
            'otp_expiry' => 10,
        ];
        if (!empty($senderId)) {
            $payload['sender'] = $senderId;
        }
        curl_setopt_array($curl, [
            CURLOPT_URL => 'https://api.msg91.com/api/v5/otp',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => $headers,
        ]);
    } else {
        // Legacy API — send our own OTP text (no template_id configured)
        curl_setopt_array($curl, [
            CURLOPT_URL => 'https://api.msg91.com/api/sendotp.php',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_POSTFIELDS => http_build_query([
                'authkey' => $authKey,
                'mobile' => $mobile,
                'message' => "Your Go-Unlisted OTP is $otp. Valid for 10 minutes. Do not share with anyone.",
                'sender' => $senderId,
                'otp' => $otp,
                'otp_length' => strlen($otp),
                'otp_expiry' => 10,
            ]),
            CURLOPT_HTTPHEADER => [
                'accept: application/json',
            ],
        ]);
    }

    $response = curl_exec($curl);
    $httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $err = curl_error($curl);
    curl_close($curl);

    if ($err) {
        error_log('MSG91 cURL error: ' . $err);
        return ['success' => false, 'error' => $err];
    }

    $result = json_decode($response, true);
    error_log('MSG91 response (HTTP ' . $httpCode . '): ' . $response);

    $ok = false;
    if (is_array($result)) {
        $type = strtolower((string) ($result['type'] ?? ''));
        $msg = strtolower((string) ($result['message'] ?? ''));
        $ok = $type === 'success'
            || str_contains($msg, 'success')
            || !empty($result['request_id'])
            || ($result['status'] ?? '') === 'success';
    } elseif (is_string($response) && stripos($response, 'success') !== false) {
        $ok = true;
    }

    if (!$ok && $httpCode >= 200 && $httpCode < 300 && is_string($response) && preg_match('/otp sent/i', $response)) {
        $ok = true;
    }

    return [
        'success' => $ok,
        'response' => $result ?: $response,
        'error' => $ok ? null : (is_array($result) ? ($result['message'] ?? json_encode($result)) : (string) $response),
    ];
}

// CSRF — validate all state-changing POSTs except public auth entry points
ensureCsrfToken();
$csrfExempt = [
    'getCsrfToken', 'sendOtp', 'verifyOtp', 'sendResetOtp', 'resetMpin',
    'loginAdmin', 'loginUser', 'saveUser', 'checkAuth', 'checkEmail',
];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action && !in_array($action, $csrfExempt, true)) {
    validateCsrfToken();
}

switch ($action) {
    case 'getCsrfToken':
        sendResponse(['csrfToken' => ensureCsrfToken()]);
        break;

    case 'submitContact':
        $data = getPostData();
        $name = htmlspecialchars(trim($data['name'] ?? ''));
        $email = htmlspecialchars(trim($data['email'] ?? ''));
        $message = htmlspecialchars(trim($data['message'] ?? ''));

        if (empty($name) || empty($email) || empty($message)) {
            http_response_code(400);
            sendResponse(['error' => 'Name, email and message are required']);
        }
        if (!isValidEmail($email)) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid email address']);
        }
        if (checkIpRateLimit($conn, 'otp_ip_attempts', 5, 60)) {
            http_response_code(429);
            sendResponse(['error' => 'Too many messages. Please try again later.']);
        }
        recordIpAttempt($conn, 'otp_ip_attempts');

        $stmt = $conn->prepare("INSERT INTO contact_messages (name, email, message, ip_address) VALUES (?, ?, ?, ?)");
        $ip = getClientIP();
        $stmt->bind_param('ssss', $name, $email, $message, $ip);
        $stmt->execute();

        $to = 'infogounlisted@gmail.com';
        $subject = "Go-Unlisted Contact: $name";
        $body = "Name: $name\nEmail: $email\nIP: $ip\n\nMessage:\n$message";
        $headers = "From: noreply@gounlisted.com\r\nReply-To: $email";
        @mail($to, $subject, $body, $headers);

        logAudit($conn, 'Contact Form', $email, ['name' => $name]);
        sendResponse(['success' => true, 'message' => 'Message sent successfully']);
        break;

    // -----------------------------------------
    // OTP GENERATION & VERIFICATION
    // -----------------------------------------
    case 'sendOtp':
        $data = getPostData();
        $email = $data['email'] ?? '';
        $phone = $data['phone'] ?? '';

        if (empty($phone)) {
            http_response_code(400);
            sendResponse(["error" => "Phone number is required"]);
            break;
        }
        if (!isValidIndianMobile($phone)) {
            http_response_code(400);
            sendResponse(["error" => "Enter a valid 10-digit Indian mobile number"]);
            break;
        }
        if (empty($email)) {
            http_response_code(400);
            sendResponse(["error" => "Email is required"]);
            break;
        }
        if (!isValidEmail($email)) {
            http_response_code(400);
            sendResponse(["error" => "Invalid email address"]);
            break;
        }

        $phoneNorm = normalizeIndianPhone($phone);
        $rateKey = phoneOtpIdentifier($phoneNorm);

        if (!isLocalDev() && checkRateLimit($conn, 'otp_send_attempts', 'identifier', $rateKey, 5, 15)) {
            http_response_code(429);
            sendResponse(["error" => "Too many OTP requests. Please try again in 15 minutes."]);
            break;
        }
        if (!isLocalDev() && checkIpRateLimit($conn, 'otp_ip_attempts', 20, 60)) {
            http_response_code(429);
            sendResponse(["error" => "Too many requests from your network. Please try again later."]);
            break;
        }
        recordAttempt($conn, 'otp_send_attempts', 'identifier', $rateKey);
        recordIpAttempt($conn, 'otp_ip_attempts');

        sendResponse(issueRegistrationOtp($conn, $phone, $email, $msg91_auth_key, $msg91_template_id ?? '', $msg91_sender_id ?? 'GOUNLS'));
        break;

    case 'sendResetOtp':
        $data = getPostData();
        $loginId = trim($data['loginId'] ?? $data['email'] ?? '');

        if (empty($loginId)) {
            http_response_code(400);
            sendResponse(['error' => 'Email or phone number is required']);
            break;
        }

        $stmt = $conn->prepare('SELECT email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1');
        $stmt->bind_param('ss', $loginId, $loginId);
        $stmt->execute();
        $userRow = $stmt->get_result()->fetch_assoc();

        if (!$userRow) {
            sleep(1);
            sendResponse([
                'success' => true,
                'message' => 'If an account exists, OTP has been sent to your registered email.',
            ]);
            break;
        }

        $email = $userRow['email'];
        $phone = $userRow['phone'] ?? '';

        if (!isLocalDev() && checkRateLimit($conn, 'otp_send_attempts', 'identifier', $email, 5, 15)) {
            http_response_code(429);
            sendResponse(['error' => 'Too many OTP requests. Please try again in 15 minutes.']);
            break;
        }
        if (!isLocalDev() && checkIpRateLimit($conn, 'otp_ip_attempts', 20, 60)) {
            http_response_code(429);
            sendResponse(['error' => 'Too many requests from your network. Please try again later.']);
            break;
        }

        recordAttempt($conn, 'otp_send_attempts', 'identifier', $email);
        recordIpAttempt($conn, 'otp_ip_attempts');

        $response = issueOtpForEmail($conn, $email, $phone, $msg91_auth_key, $msg91_template_id ?? '', $msg91_sender_id ?? 'GOUNLS');
        $response['email'] = $email;
        sendResponse($response);
        break;

    case 'resetMpin':
        $data = getPostData();
        $email = strtolower(trim($data['email'] ?? ''));
        $mpin = $data['mpin'] ?? $data['password'] ?? '';

        if (empty($email) || !isValidEmail($email)) {
            http_response_code(400);
            sendResponse(['error' => 'Valid email is required']);
            break;
        }
        if (!isValidMpin($mpin)) {
            http_response_code(400);
            sendResponse(['error' => 'MPIN must be 4-6 digits']);
            break;
        }

        $verifiedAt = $_SESSION['otp_verified'][$email] ?? null;
        if (!$verifiedAt || (time() - $verifiedAt) > 900) {
            http_response_code(403);
            sendResponse(['error' => 'OTP verification required. Please verify OTP first.']);
            break;
        }

        $hash = password_hash($mpin, PASSWORD_DEFAULT);
        $stmt = $conn->prepare('UPDATE users SET password = ? WHERE email = ?');
        $stmt->bind_param('ss', $hash, $email);
        $stmt->execute();

        if ($stmt->affected_rows === 0) {
            http_response_code(404);
            sendResponse(['error' => 'Account not found']);
            break;
        }

        unset($_SESSION['otp_verified'][$email]);
        sendResponse(['success' => true, 'message' => 'MPIN reset successfully']);
        break;

    case 'verifyOtp':
        $data = getPostData();
        $phone = normalizeIndianPhone($data['phone'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $otp = $data['otp'] ?? '';

        if (empty($otp) || !preg_match('/^\d{6}$/', $otp)) {
            http_response_code(400);
            sendResponse(["success" => false, "error" => "Enter the 6-digit OTP"]);
            break;
        }

        $usePhone = isValidIndianMobile($phone);
        $useEmail = !$usePhone && !empty($email) && isValidEmail($email);

        if (!$usePhone && !$useEmail) {
            http_response_code(400);
            sendResponse(["error" => "Valid phone number or email is required"]);
            break;
        }

        $identifier = $usePhone ? phoneOtpIdentifier($phone) : $email;
        $rateKey = $identifier;

        if (!isLocalDev() && checkRateLimit($conn, 'otp_attempts', 'identifier', $rateKey, 10, 15)) {
            http_response_code(429);
            sendResponse(["error" => "Too many failed attempts. Please try again in 15 minutes."]);
            break;
        }
        if (!isLocalDev() && checkIpRateLimit($conn, 'otp_ip_attempts', 30, 60)) {
            http_response_code(429);
            sendResponse(["error" => "Too many requests from your network. Please try again later."]);
            break;
        }

        $stmt = $conn->prepare("SELECT id, otp_code FROM otps WHERE identifier = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("s", $identifier);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($row = $result->fetch_assoc()) {
            if (password_verify($otp, $row['otp_code'])) {
                $delStmt = $conn->prepare("DELETE FROM otps WHERE id = ?");
                $delStmt->bind_param("i", $row['id']);
                $delStmt->execute();

                if ($usePhone) {
                    if (!isset($_SESSION['phone_verified'])) {
                        $_SESSION['phone_verified'] = [];
                    }
                    $_SESSION['phone_verified'][$phone] = time();
                } else {
                    if (!isset($_SESSION['otp_verified'])) {
                        $_SESSION['otp_verified'] = [];
                    }
                    $_SESSION['otp_verified'][$email] = time();
                }

                sendResponse(["success" => true, "message" => "OTP verified"]);
                break;
            }
        }
        recordAttempt($conn, 'otp_attempts', 'identifier', $rateKey);
        recordIpAttempt($conn, 'otp_ip_attempts');
        http_response_code(400);
        sendResponse(["success" => false, "error" => "Invalid or expired OTP"]);
        break;

    // -----------------------------------------
    // LOGIN & LOGOUT
    // -----------------------------------------
    case 'loginAdmin':
        if (checkRateLimit($conn, 'login_attempts', null, null, 5, 15)) {
            http_response_code(429);
            sendResponse(["error" => "Too many login attempts. Please try again in 15 minutes."]);
            break;
        }

        $data = getPostData();
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        $stmt = $conn->prepare("SELECT id, password, is_master, name, employee_id FROM employees WHERE email = ? OR employee_id = ?");
        $stmt->bind_param("ss", $email, $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($row = $result->fetch_assoc()) {
            if (password_verify($password, $row['password'])) {
                session_regenerate_id(true);
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
                $_SESSION['admin_id'] = $row['id'];
                $_SESSION['is_master'] = $row['is_master'];
                $_SESSION['employee_id'] = $row['employee_id'] ?? '';
                logAudit($conn, 'Admin Login', $row['id'], []);
                sendResponse([
                    "success" => true,
                    "id" => $row['id'],
                    "isMaster" => (bool)$row['is_master'],
                    "name" => $row['name'],
                    "employeeId" => $row['employee_id'] ?? ''
                ]);
            }
        }
        recordAttempt($conn, 'login_attempts', null, null);
        http_response_code(401);
        sleep(1); // Anti-brute-force delay
        sendResponse(["error" => "Invalid credentials"]);
        break;

    case 'loginUser':
        if (!isLocalDev() && checkRateLimit($conn, 'login_attempts', null, null, 5, 15)) {
            http_response_code(429);
            sendResponse(["error" => "Too many login attempts. Please try again in 15 minutes."]);
            break;
        }

        $data = getPostData();
        $loginId = $data['email'] ?? $data['loginId'] ?? '';
        $password = $data['password'] ?? '';

        $stmt = $conn->prepare("SELECT id, password, name, email, phone, kyc_status, kyc_reject_reason, kyc_pan, kyc_demat, bank_account, ifsc FROM users WHERE email = ? OR phone = ?");
        $stmt->bind_param("ss", $loginId, $loginId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($row = $result->fetch_assoc()) {
            if (password_verify($password, $row['password'])) {
                session_regenerate_id(true);
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
                $_SESSION['user_id'] = $row['id'];
                logAudit($conn, 'User Login', $row['id'], []);
                sendResponse([
                    "success" => true,
                    "user" => [
                        "id" => $row['id'],
                        "name" => $row['name'],
                        "email" => $row['email'],
                        "phone" => $row['phone'],
                        "kycStatus" => $row['kyc_status'],
                        "kycRejectReason" => $row['kyc_reject_reason'] ?? '',
                        "kycPan" => $row['kyc_pan'],
                        "kycDemat" => $row['kyc_demat'],
                        "bankAccount" => $row['bank_account'],
                        "ifsc" => $row['ifsc']
                    ]
                ]);
            }
        }
        recordAttempt($conn, 'login_attempts', null, null);
        http_response_code(401);
        sleep(1); // Anti-brute-force delay
        sendResponse(["error" => "Invalid email/phone or MPIN"]);
        break;

    case 'logout':
        session_destroy();
        sendResponse(["success" => true]);
        break;

    case 'checkAuth':
        if (isset($_SESSION['admin_id'])) {
            sendResponse([
                "authenticated" => true,
                "type" => "admin",
                "id" => $_SESSION['admin_id'],
                "isMaster" => !empty($_SESSION['is_master']),
                "csrfToken" => ensureCsrfToken(),
            ]);
        } else if (isset($_SESSION['user_id'])) {
            $uid = $_SESSION['user_id'];
            $stmt = $conn->prepare('SELECT id, name, email, phone, kyc_status, kyc_reject_reason, kyc_pan, kyc_demat, bank_account, ifsc FROM users WHERE id = ?');
            $stmt->bind_param('s', $uid);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            if ($row) {
                sendResponse([
                    'authenticated' => true,
                    'type' => 'user',
                    'id' => $row['id'],
                    'user' => [
                        'id' => $row['id'],
                        'name' => $row['name'],
                        'email' => $row['email'],
                        'phone' => $row['phone'],
                        'kycStatus' => $row['kyc_status'],
                        'kycRejectReason' => $row['kyc_reject_reason'] ?? '',
                        'kycPan' => $row['kyc_pan'],
                        'kycDemat' => $row['kyc_demat'],
                        'bankAccount' => $row['bank_account'],
                        'ifsc' => $row['ifsc'],
                    ],
                    'csrfToken' => ensureCsrfToken(),
                ]);
                break;
            }
            unset($_SESSION['user_id']);
        }
        sendResponse(["authenticated" => false, "csrfToken" => ensureCsrfToken()]);
        break;

    // -----------------------------------------
    // BUG 2 FIX: Check if email exists (no auth needed, used during registration)
    // -----------------------------------------
    case 'checkEmail':
        // A04: Return generic response to prevent email enumeration
        sendResponse(["success" => true]);
        break;

    // -----------------------------------------
    // EMPLOYEES (Admin Only)
    // -----------------------------------------
    case 'getEmployees':
        requireAdmin();
        $res = $conn->query("SELECT id, employee_id, name, email, is_master, created_at FROM employees");
        $data = [];
        while($row = $res->fetch_assoc()) { 
            // Never return password hashes
            $data[] = $row; 
        }
        sendResponse($data);
        break;

    case 'saveEmployee':
        requireAdmin();
        $data = getPostData();
        $id = !empty($data['id']) ? $data['id'] : 'emp-' . uniqid();
        $name = htmlspecialchars($data['name']);
        $email = htmlspecialchars($data['email']);
        $employee_id = htmlspecialchars($data['employeeId'] ?? '');
        
        $stmtCheck = $conn->prepare("SELECT id FROM employees WHERE id=?");
        $stmtCheck->bind_param("s", $id);
        $stmtCheck->execute();
        $exists = $stmtCheck->get_result()->num_rows > 0;

        if ($exists) {
            if (!empty($data['password'])) {
                $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
                $stmt = $conn->prepare("UPDATE employees SET name=?, email=?, employee_id=?, password=? WHERE id=?");
                $stmt->bind_param("sssss", $name, $email, $employee_id, $hashed, $id);
            } else {
                $stmt = $conn->prepare("UPDATE employees SET name=?, email=?, employee_id=? WHERE id=?");
                $stmt->bind_param("ssss", $name, $email, $employee_id, $id);
            }
            if (!$stmt->execute()) {
                http_response_code(400);
                sendResponse(["error" => "Failed to update employee. Employee ID may already exist."]);
            }
        } else {
            if (empty($data['password']) || strlen($data['password']) < 6) {
                http_response_code(400);
                sendResponse(["error" => "Password must be at least 6 characters"]);
            }
            $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
            $stmt = $conn->prepare("INSERT INTO employees (id, name, email, employee_id, password) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("sssss", $id, $name, $email, $employee_id, $hashed);
            if (!$stmt->execute()) {
                http_response_code(400);
                sendResponse(["error" => "Failed to add employee. Email or Employee ID may already exist."]);
            }
        }
        sendResponse(["success" => true, "id" => $id]);
        break;

    case 'deleteEmployee':
        requireAdmin();
        $data = getPostData();
        $id = $data['id'];
        $stmt = $conn->prepare("DELETE FROM employees WHERE id=? AND is_master=0"); // Protect master admin
        $stmt->bind_param("s", $id);
        $stmt->execute();
        sendResponse(["success" => true]);
        break;

    // -----------------------------------------
    // USERS (Admin Only or Self)
    // -----------------------------------------
    case 'getUsers':
        requireAdmin();
        $res = $conn->query("SELECT id, name, phone, email, role, referral_code, kyc_status, kyc_reject_reason, kyc_pan, kyc_demat, bank_account, ifsc, created_at FROM users");
        $data = [];
        while($row = $res->fetch_assoc()) { $data[] = $row; }
        sendResponse($data);
        break;

    case 'saveUser':
        $data = getPostData();
        $id = !empty($data['id']) ? $data['id'] : 'usr-' . uniqid();
        
        // Authorization check for updates
        $stmtCheck = $conn->prepare("SELECT id FROM users WHERE id=?");
        $stmtCheck->bind_param("s", $id);
        $stmtCheck->execute();
        $exists = $stmtCheck->get_result()->num_rows > 0;

        if ($exists && !isset($_SESSION['admin_id']) && (!isset($_SESSION['user_id']) || $_SESSION['user_id'] !== $id)) {
            http_response_code(403);
            sendResponse(["error" => "Forbidden"]);
        }

        // SEC 1 FIX: Force role to 'user' for non-admin callers
        $role = 'user';
        if (isset($_SESSION['admin_id'])) {
            $role = $data['role'] ?? 'user';
        }

        $name = htmlspecialchars($data['name']);
        $phone = htmlspecialchars($data['phone']);
        $email = htmlspecialchars($data['email']);
        $referral_code = htmlspecialchars($data['referralCode'] ?? '');
        $kyc_status = htmlspecialchars($data['kycStatus'] ?? 'Not Submitted');
        $kyc_reject_reason = htmlspecialchars($data['kycRejectReason'] ?? $data['kyc_reject_reason'] ?? '');
        if ($kyc_status === 'Verified') {
            $kyc_reject_reason = '';
        }
        $kyc_pan = htmlspecialchars($data['kycPan'] ?? '');
        $kyc_demat = htmlspecialchars($data['kycDemat'] ?? '');
        $bank_account = htmlspecialchars($data['bankAccount'] ?? $data['bank_account'] ?? '');
        $ifsc = htmlspecialchars(strtoupper($data['ifsc'] ?? $data['ifscCode'] ?? ''));

        // SEC 3 FIX: Reject empty passwords for new users; require OTP verification
        if (!$exists) {
            if (empty($data['password'])) {
                http_response_code(400);
                sendResponse(["error" => "MPIN is required"]);
            }
            if (!isValidMpin($data['password'])) {
                http_response_code(400);
                sendResponse(["error" => "MPIN must be 4-6 digits"]);
            }
            if (!isValidEmail($email)) {
                http_response_code(400);
                sendResponse(["error" => "Invalid email address"]);
            }
            $phoneNorm = normalizeIndianPhone($phone);
            if (!isValidIndianMobile($phoneNorm)) {
                http_response_code(400);
                sendResponse(["error" => "Invalid phone number"]);
            }
            $verifiedAt = $_SESSION['phone_verified'][$phoneNorm] ?? null;
            if (!$verifiedAt || (time() - $verifiedAt) > 900) {
                http_response_code(403);
                sendResponse(["error" => "Phone verification required. Enter the OTP sent to your mobile."]);
            }
            unset($_SESSION['phone_verified'][$phoneNorm]);
            $phone = $phoneNorm;

            if (!isLocalDev() && checkRateLimit($conn, 'otp_send_attempts', 'identifier', phoneOtpIdentifier($phoneNorm), 10, 60)) {
                http_response_code(429);
                sendResponse(["error" => "Too many registration attempts. Please try again later."]);
            }
            recordAttempt($conn, 'otp_send_attempts', 'identifier', phoneOtpIdentifier($phoneNorm));
        }

        if ($exists) {
            if (!empty($data['password'])) {
                $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
                $stmt = $conn->prepare("UPDATE users SET name=?, phone=?, email=?, role=?, referral_code=?, kyc_status=?, kyc_reject_reason=?, kyc_pan=?, kyc_demat=?, bank_account=?, ifsc=?, password=? WHERE id=?");
                $stmt->bind_param("sssssssssssss", $name, $phone, $email, $role, $referral_code, $kyc_status, $kyc_reject_reason, $kyc_pan, $kyc_demat, $bank_account, $ifsc, $hashed, $id);
            } else {
                $stmt = $conn->prepare("UPDATE users SET name=?, phone=?, email=?, role=?, referral_code=?, kyc_status=?, kyc_reject_reason=?, kyc_pan=?, kyc_demat=?, bank_account=?, ifsc=? WHERE id=?");
                $stmt->bind_param("ssssssssssss", $name, $phone, $email, $role, $referral_code, $kyc_status, $kyc_reject_reason, $kyc_pan, $kyc_demat, $bank_account, $ifsc, $id);
            }
            $stmt->execute();
        } else {
            $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
            $dup = $conn->prepare('SELECT id FROM users WHERE email = ? OR phone = ?');
            $dup->bind_param('ss', $email, $phone);
            $dup->execute();
            if ($dup->get_result()->num_rows > 0) {
                http_response_code(409);
                sendResponse(['error' => 'An account with this email or phone already exists. Try logging in instead.']);
                break;
            }
            $stmt = $conn->prepare("INSERT INTO users (id, name, phone, email, password, role, referral_code, kyc_status, kyc_pan, kyc_demat, bank_account, ifsc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssssssssss", $id, $name, $phone, $email, $hashed, $role, $referral_code, $kyc_status, $kyc_pan, $kyc_demat, $bank_account, $ifsc);
            $stmt->execute();

            session_regenerate_id(true);
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            $_SESSION['user_id'] = $id;
        }
        // BUG 1 FIX: Return the generated id so the frontend can store it
        sendResponse(["success" => true, "id" => $id]);
        break;

    // -----------------------------------------
    // BUG 5 FIX: Delete User (Admin Only)
    // -----------------------------------------
    case 'deleteUser':
        requireAdmin();
        $data = getPostData();
        $email = $data['email'] ?? '';
        $stmt = $conn->prepare("DELETE FROM users WHERE email=?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        sendResponse(["success" => true, "deleted" => $stmt->affected_rows]);
        break;

    // -----------------------------------------
    // BUG 6 FIX: User-facing KYC update (requires user auth, not admin)
    // -----------------------------------------
    case 'updateKyc':
        requireAuth();
        $data = getPostData();
        $user_id = $_SESSION['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(403);
            sendResponse(["error" => "Only logged-in users can update their KYC"]);
        }

        $kyc_pan = htmlspecialchars($data['pan'] ?? '');
        $kyc_demat = htmlspecialchars($data['demat'] ?? '');
        $bank_account = htmlspecialchars($data['bankAccount'] ?? $data['bank'] ?? '');
        $ifsc = htmlspecialchars(strtoupper($data['ifsc'] ?? ''));
        $kyc_status = 'Under Review';

        $stmt = $conn->prepare("UPDATE users SET kyc_pan=?, kyc_demat=?, bank_account=?, ifsc=?, kyc_status=?, kyc_reject_reason=NULL WHERE id=?");
        $stmt->bind_param("ssssss", $kyc_pan, $kyc_demat, $bank_account, $ifsc, $kyc_status, $user_id);
        $stmt->execute();

        sendResponse(["success" => true, "kycStatus" => $kyc_status]);
        break;

    // -----------------------------------------
    // ORDERS
    // -----------------------------------------
    case 'getOrders':
        requireAuth();
        // If user is not admin, only return their own orders
        if (isset($_SESSION['admin_id'])) {
            $stmt = $conn->prepare("SELECT * FROM orders ORDER BY created_at DESC");
        } else {
            $stmt = $conn->prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC");
            $stmt->bind_param("s", $_SESSION['user_id']);
        }
        $stmt->execute();
        $res = $stmt->get_result();
        
        $data = [];
        while($row = $res->fetch_assoc()) { 
            // BUG 3 FIX: Return ALL fields the frontend expects
            $data[] = [
                "orderId" => htmlspecialchars($row['order_id']),
                "buyerName" => htmlspecialchars($row['buyer_name']),
                "buyerEmail" => htmlspecialchars($row['buyer_email']),
                "buyerPhone" => htmlspecialchars($row['buyer_phone']),
                "shareId" => htmlspecialchars($row['share_id']),
                "companyName" => htmlspecialchars($row['share_name']),
                "shareName" => htmlspecialchars($row['share_name']),
                "shareTicker" => htmlspecialchars($row['share_ticker']),
                "sector" => htmlspecialchars($row['share_ticker']),
                "logoInitials" => strtoupper(substr($row['share_name'] ?? '', 0, 2)),
                "logoGradient" => "linear-gradient(135deg, #333, #555)",
                "pricePerShare" => (float)$row['price_per_share'],
                "qty" => (int)$row['quantity'],
                "totalPaid" => (float)$row['total_amount'],
                "total" => (float)$row['total_amount'],
                "status" => htmlspecialchars($row['status']),
                "method" => htmlspecialchars($row['method']),
                "buyerPAN" => htmlspecialchars($row['transaction_id'] ?? ''),
                "buyerDemat" => '',
                "clientId" => '',
                "source" => '',
                "paymentMethod" => htmlspecialchars($row['method']),
                "transactionId" => htmlspecialchars($row['transaction_id'] ?? ''),
                "orderSource" => htmlspecialchars($row['order_source'] ?? 'Online'),
                "date" => $row['created_at']
            ];
        }
        sendResponse($data);
        break;

    case 'saveOrder':
        $data = getPostData();
        $order_id = $data['orderId'] ?? '';
        
        // A01: Validate order_id format
        if (!preg_match('/^GU[A-Z0-9]{5,15}$/', $order_id)) {
            http_response_code(400);
            sendResponse(["error" => "Invalid Order ID format"]);
        }

        $isAdmin = isset($_SESSION['admin_id']);
        $isUser = isset($_SESSION['user_id']);
        
        $buyer_name = htmlspecialchars($data['buyerName'] ?? '');
        $buyer_email = htmlspecialchars($data['buyerEmail'] ?? '');
        $buyer_phone = htmlspecialchars($data['buyerPhone'] ?? '');
        $share_id = htmlspecialchars($data['shareId'] ?? '');
        $share_name = htmlspecialchars($data['companyName'] ?? $data['shareName'] ?? '');
        $share_ticker = htmlspecialchars($data['shareTicker'] ?? '');
        $price_per_share = (float)($data['pricePerShare'] ?? 0);
        
        $priceStmt = $conn->prepare("SELECT base_price FROM shares WHERE share_id = ? AND is_active = 1");
        $priceStmt->bind_param("s", $share_id);
        $priceStmt->execute();
        $priceResult = $priceStmt->get_result();
        if ($priceRow = $priceResult->fetch_assoc()) {
            $price_per_share = (float)$priceRow['base_price'];
        } else {
            $priceStmt = $conn->prepare("SELECT base_price FROM shares_config WHERE share_id = ?");
            $priceStmt->bind_param("s", $share_id);
            $priceStmt->execute();
            $priceResult = $priceStmt->get_result();
            if ($priceRow = $priceResult->fetch_assoc()) {
                $price_per_share = (float)$priceRow['base_price'];
            }
        }
        
        $quantity = (int)($data['qty'] ?? 0);
        $subtotal = $price_per_share * $quantity;
        $platformFee = round($subtotal * 0.01);
        $total_amount = $subtotal + $platformFee;
        $method = htmlspecialchars($data['method'] ?? $data['paymentMethod'] ?? 'Online');
        $status = htmlspecialchars($data['status'] ?? 'Pending Verification');
        $transaction_id = htmlspecialchars($data['transactionId'] ?? '');
        $order_source = htmlspecialchars($data['orderSource'] ?? $data['source'] ?? 'Online');

        $stmtCheck = $conn->prepare("SELECT order_id FROM orders WHERE order_id=?");
        $stmtCheck->bind_param("s", $order_id);
        $stmtCheck->execute();
        
        if ($stmtCheck->get_result()->num_rows > 0) {
            requireAdmin();
            if (!empty($data['_fullUpdate'])) {
                $stmt = $conn->prepare("UPDATE orders SET buyer_name=?, buyer_phone=?, share_name=?, price_per_share=?, quantity=?, total_amount=?, method=?, status=?, transaction_id=?, order_source=? WHERE order_id=?");
                $stmt->bind_param("sssdiidssss", $buyer_name, $buyer_phone, $share_name, $price_per_share, $quantity, $total_amount, $method, $status, $transaction_id, $order_source, $order_id);
            } else {
                $ops_note = htmlspecialchars($data['opsNote'] ?? $data['ops_note'] ?? '');
                if ($ops_note !== '') {
                    $stmt = $conn->prepare("UPDATE orders SET status=?, transaction_id=?, ops_note=? WHERE order_id=?");
                    $stmt->bind_param("ssss", $status, $transaction_id, $ops_note, $order_id);
                } else {
                    $stmt = $conn->prepare("UPDATE orders SET status=?, transaction_id=? WHERE order_id=?");
                    $stmt->bind_param("sss", $status, $transaction_id, $order_id);
                }
            }
            $stmt->execute();
            logAudit($conn, 'Update Order', $_SESSION['admin_id'], ['orderId' => $order_id, 'status' => $status]);
        } else {
            if ($isUser) {
                $user_id = $_SESSION['user_id'];
            } elseif ($isAdmin) {
                $user_id = 'admin:' . $_SESSION['admin_id'];
            } else {
                $user_id = 'guest';
            }
            $stmt = $conn->prepare("INSERT INTO orders (order_id, user_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker, price_per_share, quantity, total_amount, method, transaction_id, status, order_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssssssdidssss", $order_id, $user_id, $buyer_name, $buyer_email, $buyer_phone, $share_id, $share_name, $share_ticker, $price_per_share, $quantity, $total_amount, $method, $transaction_id, $status, $order_source);
            $stmt->execute();
            if ($isAdmin) {
                logAudit($conn, 'Create Order', $_SESSION['admin_id'], ['orderId' => $order_id, 'source' => $order_source]);
            }
        }
        sendResponse(["success" => true]);
        break;

    case 'saveInitiatedCheckout':
        $data = getPostData();
        $session_id = htmlspecialchars($data['sessionId'] ?? '');
        if (strlen($session_id) < 8) {
            http_response_code(400);
            sendResponse(["error" => "Invalid session"]);
        }
        $share_id = htmlspecialchars($data['shareId'] ?? '');
        $share_name = htmlspecialchars($data['shareName'] ?? '');
        $share_ticker = htmlspecialchars($data['shareTicker'] ?? '');
        $buyer_name = htmlspecialchars($data['buyerName'] ?? '');
        $buyer_email = htmlspecialchars($data['buyerEmail'] ?? '');
        $buyer_phone = htmlspecialchars($data['buyerPhone'] ?? '');
        $qty = (int)($data['qty'] ?? 1);
        $price = (float)($data['pricePerShare'] ?? 0);
        $total = (float)($data['totalAmount'] ?? 0);
        $mode = htmlspecialchars($data['paymentMode'] ?? '');
        $stmt = $conn->prepare("INSERT INTO initiated_checkouts (session_id, share_id, share_name, share_ticker, buyer_name, buyer_email, buyer_phone, qty, price_per_share, total_amount, payment_mode, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Initiated') ON DUPLICATE KEY UPDATE share_id=VALUES(share_id), share_name=VALUES(share_name), qty=VALUES(qty), price_per_share=VALUES(price_per_share), total_amount=VALUES(total_amount), payment_mode=VALUES(payment_mode), created_at=CURRENT_TIMESTAMP");
        $stmt->bind_param("sssssssidds", $session_id, $share_id, $share_name, $share_ticker, $buyer_name, $buyer_email, $buyer_phone, $qty, $price, $total, $mode);
        $stmt->execute();
        sendResponse(["success" => true]);
        break;

    case 'getInitiatedCheckouts':
        requireAdmin();
        $res = $conn->query("SELECT * FROM initiated_checkouts WHERE status = 'Initiated' ORDER BY created_at DESC");
        $rows = [];
        while ($row = $res->fetch_assoc()) {
            $rows[] = [
                'sessionId' => $row['session_id'],
                'shareId' => $row['share_id'],
                'shareName' => $row['share_name'],
                'shareTicker' => $row['share_ticker'],
                'buyerName' => $row['buyer_name'],
                'buyerEmail' => $row['buyer_email'],
                'buyerPhone' => $row['buyer_phone'],
                'qty' => (int)$row['qty'],
                'pricePerShare' => (float)$row['price_per_share'],
                'totalAmount' => (float)$row['total_amount'],
                'paymentMode' => $row['payment_mode'],
                'status' => $row['status'],
                'initiatedAt' => $row['created_at'],
            ];
        }
        sendResponse($rows);
        break;

    case 'deleteInitiatedCheckout':
        requireAdmin();
        $data = getPostData();
        $session_id = htmlspecialchars($data['sessionId'] ?? '');
        $stmt = $conn->prepare("DELETE FROM initiated_checkouts WHERE session_id = ?");
        $stmt->bind_param("s", $session_id);
        $stmt->execute();
        sendResponse(["success" => true]);
        break;

    case 'approveInitiatedCheckout':
        requireAdmin();
        $data = getPostData();
        $session_id = htmlspecialchars($data['sessionId'] ?? '');
        $stmt = $conn->prepare("SELECT * FROM initiated_checkouts WHERE session_id = ?");
        $stmt->bind_param("s", $session_id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            http_response_code(404);
            sendResponse(["error" => "Initiated checkout not found"]);
        }
        $order_id = $data['orderId'] ?? ('GU' . strtoupper(substr(md5(uniqid('', true)), 0, 8)));
        $user_id = 'admin:' . $_SESSION['admin_id'];
        $method = $row['payment_mode'] ?: 'Offline';
        $status = 'Confirmed';
        $ins = $conn->prepare("INSERT INTO orders (order_id, user_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker, price_per_share, quantity, total_amount, method, status, order_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Offline')");
        $ins->bind_param("ssssssssdiiss", $order_id, $user_id, $row['buyer_name'], $row['buyer_email'], $row['buyer_phone'], $row['share_id'], $row['share_name'], $row['share_ticker'], $row['price_per_share'], $row['qty'], $row['total_amount'], $method, $status);
        $ins->execute();
        $del = $conn->prepare("DELETE FROM initiated_checkouts WHERE session_id = ?");
        $del->bind_param("s", $session_id);
        $del->execute();
        logAudit($conn, 'Approve Initiated Checkout', $_SESSION['admin_id'], ['sessionId' => $session_id, 'orderId' => $order_id]);
        sendResponse(["success" => true, "orderId" => $order_id]);
        break;

    // -----------------------------------------
    // SHARES CATALOG
    // -----------------------------------------
    case 'getShares':
        $isAdmin = isset($_SESSION['admin_id']);
        $res = $conn->query("SELECT * FROM shares WHERE is_active = 1 ORDER BY is_featured DESC, is_builtin DESC, name ASC");
        $shares = [];
        while ($row = $res->fetch_assoc()) {
            $shares[] = mapShareRow($row, $isAdmin);
        }
        sendResponse($shares);
        break;

    case 'saveShare':
        requireAdmin();
        $data = getPostData();
        $share_id = preg_replace('/[^a-z0-9-]/', '', strtolower($data['id'] ?? $data['shareId'] ?? ''));
        $name = trim($data['name'] ?? '');
        $ticker = strtoupper(trim($data['ticker'] ?? ''));
        $sector = trim($data['sector'] ?? '');
        $base_price = (float) ($data['basePrice'] ?? $data['price'] ?? 0);
        $min_qty = max(1, (int) ($data['minQty'] ?? 1));
        $description = trim($data['description'] ?? '');
        $founded = isset($data['founded']) && $data['founded'] !== '' ? (int) $data['founded'] : null;
        $revenue = trim($data['revenue'] ?? '');
        $valuation = trim($data['valuation'] ?? '');
        $growth = trim($data['growth'] ?? '');
        $change_positive = !empty($data['changePositive']) ? 1 : 0;
        $logo_initials = strtoupper(substr(trim($data['logoInitials'] ?? ''), 0, 3));
        $logo_gradient = trim($data['logoGradient'] ?? 'linear-gradient(135deg, #003478, #0050a8)');
        $sector_color = trim($data['sectorColor'] ?? '#7ac142');
        $listing_type = trim($data['listingType'] ?? 'Pre-IPO');
        $ipo_timeline = trim($data['ipoTimeline'] ?? '');
        $buy_price = isset($data['buyPrice']) && $data['buyPrice'] !== '' && $data['buyPrice'] !== null
            ? (float) $data['buyPrice'] : null;
        $inventory_status = trim($data['inventoryStatus'] ?? 'In Stock');
        $risk_notes = trim($data['riskNotes'] ?? '');
        $lock_in_months = max(0, (int) ($data['lockInMonths'] ?? 6));
        $is_featured = !empty($data['isFeatured']) ? 1 : 0;
        $highlights = $data['keyHighlights'] ?? [];
        if (is_string($highlights)) {
            $highlights = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $highlights))));
        }
        $key_highlights = json_encode(is_array($highlights) ? $highlights : []);

        if (!$share_id && $name) {
            $share_id = 'custom-' . preg_replace('/[^a-z0-9]+/', '-', strtolower($name)) . '-' . substr(uniqid(), -5);
        }

        if (!$share_id || strlen($name) < 2 || strlen($ticker) < 2 || !$sector || $base_price <= 0 || !$logo_initials) {
            sendResponse(["error" => "Missing or invalid share fields"], 400);
            break;
        }

        $price_history = json_encode($data['priceHistory'] ?? defaultPriceHistory($base_price));
        $chart_labels = json_encode($data['chartLabels'] ?? defaultChartLabels());

        $check = $conn->prepare("SELECT share_id, is_builtin FROM shares WHERE share_id = ?");
        $check->bind_param('s', $share_id);
        $check->execute();
        $existing = $check->get_result()->fetch_assoc();

        if ($existing) {
            $stmt = $conn->prepare(
                "UPDATE shares SET name=?, ticker=?, sector=?, sector_color=?, base_price=?, min_qty=?, description=?, founded=?, revenue=?, valuation=?, growth=?, change_positive=?, logo_initials=?, logo_gradient=?, price_history=?, chart_labels=?, listing_type=?, ipo_timeline=?, buy_price=?, inventory_status=?, key_highlights=?, risk_notes=?, lock_in_months=?, is_featured=?, is_active=1 WHERE share_id=?"
            );
            $stmt->bind_param(
                'sssssdisisssissssssdsssiis',
                $name,
                $ticker,
                $sector,
                $sector_color,
                $base_price,
                $min_qty,
                $description,
                $founded,
                $revenue,
                $valuation,
                $growth,
                $change_positive,
                $logo_initials,
                $logo_gradient,
                $price_history,
                $chart_labels,
                $listing_type,
                $ipo_timeline,
                $buy_price,
                $inventory_status,
                $key_highlights,
                $risk_notes,
                $lock_in_months,
                $is_featured,
                $share_id
            );
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO shares (share_id, name, ticker, sector, sector_color, base_price, min_qty, description, founded, revenue, valuation, growth, change_positive, logo_initials, logo_gradient, price_history, chart_labels, listing_type, ipo_timeline, buy_price, inventory_status, key_highlights, risk_notes, lock_in_months, is_featured, is_builtin, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)"
            );
            $stmt->bind_param(
                'sssssdisisssissssssdsssii',
                $share_id,
                $name,
                $ticker,
                $sector,
                $sector_color,
                $base_price,
                $min_qty,
                $description,
                $founded,
                $revenue,
                $valuation,
                $growth,
                $change_positive,
                $logo_initials,
                $logo_gradient,
                $price_history,
                $chart_labels,
                $listing_type,
                $ipo_timeline,
                $buy_price,
                $inventory_status,
                $key_highlights,
                $risk_notes,
                $lock_in_months,
                $is_featured
            );
        }

        if (!$stmt->execute()) {
            sendResponse(["error" => "Failed to save share"], 500);
            break;
        }

        syncShareConfigPrice($conn, $share_id, $base_price);
        logAudit($conn, $existing ? 'Update Share' : 'Add Share', $_SESSION['admin_id'], ['shareId' => $share_id, 'name' => $name]);
        sendResponse(["success" => true, "shareId" => $share_id]);
        break;

    case 'deleteShare':
        requireAdmin();
        $data = getPostData();
        $share_id = preg_replace('/[^a-z0-9-]/', '', strtolower($data['shareId'] ?? ''));
        if (!$share_id) {
            sendResponse(["error" => "Invalid share ID"], 400);
            break;
        }
        $stmt = $conn->prepare("UPDATE shares SET is_active = 0 WHERE share_id = ?");
        $stmt->bind_param('s', $share_id);
        $stmt->execute();
        logAudit($conn, 'Delete Share', $_SESSION['admin_id'], ['shareId' => $share_id]);
        sendResponse(["success" => true]);
        break;

    case 'getSharesConfig':
        $res = $conn->query("SELECT share_id, base_price FROM shares WHERE is_active = 1");
        if (!$res || $res->num_rows === 0) {
            $res = $conn->query("SELECT * FROM shares_config");
        }
        $data = [];
        while ($row = $res->fetch_assoc()) {
            $data[$row['share_id']] = (float) $row['base_price'];
        }
        sendResponse($data);
        break;

    case 'saveShareConfig':
        requireAdmin();
        $data = getPostData();
        $share_id = htmlspecialchars($data['shareId']);
        $base_price = (float) $data['basePrice'];

        $stmt = $conn->prepare("UPDATE shares SET base_price = ? WHERE share_id = ?");
        $stmt->bind_param('ds', $base_price, $share_id);
        $stmt->execute();

        syncShareConfigPrice($conn, $share_id, $base_price);
        sendResponse(["success" => true]);
        break;

    case 'getSettings':
        $isAdmin = isset($_SESSION['admin_id']);
        $stmt = $conn->prepare("SELECT setting_key, setting_value FROM settings");
        $stmt->execute();
        $res = $stmt->get_result();
        $settings = [];
        while ($row = $res->fetch_assoc()) {
            if ($isAdmin || in_array($row['setting_key'], PUBLIC_SETTINGS_KEYS, true)) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }
        sendResponse($settings);
        break;

    // SEC 2 FIX: Use prepared statements instead of string interpolation
    case 'saveSettings':
        requireAdmin();
        $data = getPostData();
        $stmt = $conn->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        foreach ($data as $key => $val) {
            $k = htmlspecialchars($key);
            $v = htmlspecialchars($val);
            $stmt->bind_param("ss", $k, $v);
            $stmt->execute();
        }
        sendResponse(["success" => true]);
        break;

    case 'uploadQr':
        requireAdmin();
        if (isset($_FILES['qr_image']) && $_FILES['qr_image']['error'] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['qr_image']['tmp_name'];
            $fileSize = $_FILES['qr_image']['size'];
            
            // A01: Validate file size (max 2MB)
            if ($fileSize > 2 * 1024 * 1024) {
                http_response_code(400);
                sendResponse(["error" => "File too large (max 2MB)"]);
            }
            
            // A01: Validate MIME type using finfo
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $tmpName);
            finfo_close($finfo);
            
            $allowedMimes = ['image/jpeg', 'image/png'];
            if (!in_array($mime, $allowedMimes)) {
                http_response_code(400);
                sendResponse(["error" => "Invalid file type. Only JPG and PNG allowed."]);
            }
            
            $target = "../QR.jpeg";
            if (move_uploaded_file($tmpName, $target)) {
                logAudit($conn, 'Admin QR Upload', $_SESSION['admin_id'], ['file' => 'QR.jpeg', 'size' => $fileSize]);
                sendResponse(["success" => true, "message" => "QR updated"]);
            } else {
                http_response_code(500);
                sendResponse(["error" => "Failed to save file"]);
            }
        } else {
            http_response_code(400);
            sendResponse(["error" => "No file uploaded or upload error"]);
        }
        break;

    // -----------------------------------------
    // ARTICLES & BLOGS
    // -----------------------------------------
    case 'getArticles':
        $res = $conn->query("SELECT id, title, slug, image_url, author, created_at FROM articles WHERE status = 'published' ORDER BY created_at DESC");
        $articles = [];
        while($row = $res->fetch_assoc()) { 
            $articles[] = $row; 
        }
        sendResponse($articles);
        break;

    case 'getArticle':
        $slug = $_GET['slug'] ?? '';
        $stmt = $conn->prepare("SELECT * FROM articles WHERE slug = ? AND status = 'published'");
        $stmt->bind_param("s", $slug);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($row = $result->fetch_assoc()) {
            sendResponse($row);
        } else {
            http_response_code(404);
            sendResponse(["error" => "Article not found"]);
        }
        break;

    case 'adminGetArticles':
        requireMasterAdmin();
        $res = $conn->query("SELECT id, title, slug, image_url, author, status, created_at FROM articles ORDER BY created_at DESC");
        $articles = [];
        while($row = $res->fetch_assoc()) { 
            $articles[] = $row; 
        }
        sendResponse($articles);
        break;

    case 'adminGetArticle':
        requireMasterAdmin();
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $conn->prepare("SELECT * FROM articles WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                sendResponse($row);
            } else {
                http_response_code(404);
                sendResponse(["error" => "Article not found"]);
            }
        } else {
            http_response_code(400);
            sendResponse(["error" => "Article ID is required"]);
        }
        break;

    case 'adminSaveArticle':
        requireMasterAdmin();
        $data = getPostData();
        $id = $data['id'] ?? null;
        $title = htmlspecialchars($data['title'] ?? '', ENT_QUOTES, 'UTF-8');
        $slug = preg_replace('/[^a-z0-9-]/', '', strtolower($data['slug'] ?? ''));
        $content = sanitizeArticleHtml($data['content'] ?? '');
        $image_url = filter_var($data['image_url'] ?? '', FILTER_VALIDATE_URL) ? $data['image_url'] : '';
        $status = $data['status'] ?? 'published';
        $author = 'GoUnlisted Team';
        
        if (empty($title) || empty($slug) || empty($content)) {
            http_response_code(400);
            sendResponse(["error" => "Title, slug and content are required"]);
            break;
        }

        if ($id) {
            $stmt = $conn->prepare("UPDATE articles SET title=?, slug=?, content=?, image_url=?, status=? WHERE id=?");
            $stmt->bind_param("sssssi", $title, $slug, $content, $image_url, $status, $id);
            $stmt->execute();
            logAudit($conn, 'Update Article', $_SESSION['admin_id'], ['id' => $id, 'title' => $title]);
            sendResponse(["success" => true, "id" => $id]);
        } else {
            $stmt = $conn->prepare("INSERT INTO articles (title, slug, content, image_url, author, status) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssss", $title, $slug, $content, $image_url, $author, $status);
            $stmt->execute();
            $newId = $conn->insert_id;
            logAudit($conn, 'Create Article', $_SESSION['admin_id'], ['id' => $newId, 'title' => $title]);
            sendResponse(["success" => true, "id" => $newId]);
        }
        break;

    case 'adminDeleteArticle':
        requireMasterAdmin();
        $data = getPostData();
        $id = $data['id'] ?? null;
        if ($id) {
            $stmt = $conn->prepare("DELETE FROM articles WHERE id=?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            logAudit($conn, 'Delete Article', $_SESSION['admin_id'], ['id' => $id]);
            sendResponse(["success" => true]);
        } else {
            http_response_code(400);
            sendResponse(["error" => "Article ID is required"]);
        }
        break;

    case 'adminUploadImage':
        requireMasterAdmin();
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['image']['tmp_name'];
            $fileSize = $_FILES['image']['size'];
            
            if ($fileSize > 5 * 1024 * 1024) {
                http_response_code(400);
                sendResponse(["error" => "File too large (max 5MB)"]);
                break;
            }
            
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $tmpName);
            finfo_close($finfo);
            
            $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!in_array($mime, $allowedMimes)) {
                http_response_code(400);
                sendResponse(["error" => "Invalid file type. Only JPG, PNG and WEBP allowed."]);
                break;
            }
            
            $ext = 'jpg';
            if ($mime === 'image/png') $ext = 'png';
            if ($mime === 'image/webp') $ext = 'webp';
            
            $uploadDir = '../uploads/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $filename = 'article_' . time() . '_' . random_int(1000, 9999) . '.' . $ext;
            $target = $uploadDir . $filename;
            
            if (move_uploaded_file($tmpName, $target)) {
                logAudit($conn, 'Upload Article Image', $_SESSION['admin_id'], ['file' => $filename]);
                sendResponse(["success" => true, "url" => "uploads/" . $filename]);
            } else {
                http_response_code(500);
                sendResponse(["error" => "Failed to save file"]);
            }
        } else {
            http_response_code(400);
            sendResponse(["error" => "No file uploaded or upload error"]);
        }
        break;

    default:
        http_response_code(400);
        sendResponse(["error" => "Invalid action"]);
        break;
}

$conn->close();
?>
