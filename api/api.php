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


require_once __DIR__ . '/load_env.php';
require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/share_helpers.php';
require_once __DIR__ . '/mail_helpers.php';
require_once __DIR__ . '/invoice_helpers.php';

$conn = new mysqli($host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

date_default_timezone_set('Asia/Kolkata');
$conn->query("SET time_zone = '+05:30'");

// -----------------------------------------
// AUTO-MIGRATE SCHEMA (structure only — never UPDATE/DELETE existing rows)
// -----------------------------------------
function autoMigrateSchema($conn) {
    $res = $conn->query("SHOW COLUMNS FROM employees LIKE 'employee_id'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE employees ADD COLUMN employee_id VARCHAR(50) UNIQUE AFTER id");
    }
    $res = $conn->query("SHOW COLUMNS FROM employees LIKE 'permissions'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE employees ADD COLUMN permissions TEXT NULL");
    }
    $res = $conn->query("SHOW COLUMNS FROM employees LIKE 'phone'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE employees ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER email");
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
    $res = $conn->query("SHOW COLUMNS FROM users LIKE 'bank_name'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN bank_name VARCHAR(100) DEFAULT NULL AFTER bank_account");
    }
    $res = $conn->query("SHOW COLUMNS FROM users LIKE 'kyc_demat_proof'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN kyc_demat_proof VARCHAR(255) DEFAULT NULL AFTER kyc_demat");
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

    $res = $conn->query("SHOW COLUMNS FROM orders LIKE 'employee_code'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE orders ADD COLUMN employee_code VARCHAR(50) DEFAULT NULL AFTER order_source");
    }
    $res = $conn->query("SHOW COLUMNS FROM orders LIKE 'created_at'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE orders ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    }
    $res = $conn->query("SHOW COLUMNS FROM orders LIKE 'deleted_at'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE orders ADD COLUMN deleted_at DATETIME DEFAULT NULL");
    }
    $res = $conn->query("SHOW COLUMNS FROM orders LIKE 'custom_charges_json'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE orders ADD COLUMN custom_charges_json TEXT DEFAULT NULL");
    }

    // Fix legacy employee codes GU002 → GUE002 (exactly 3 digits after GU, missing E)
    $conn->query("UPDATE employees SET employee_id = CONCAT('GUE', SUBSTRING(employee_id, 3))
                  WHERE employee_id REGEXP '^GU[0-9]{3}$' AND employee_id <> 'GU00'");
    $conn->query("UPDATE orders SET employee_code = CONCAT('GUE', SUBSTRING(employee_code, 3))
                  WHERE employee_code REGEXP '^GU[0-9]{3}$' AND employee_code <> 'GU00'");
    $conn->query("UPDATE users SET referral_code = CONCAT('GUE', SUBSTRING(referral_code, 3))
                  WHERE referral_code REGEXP '^GU[0-9]{3}$' AND referral_code <> 'GU00'");
    $conn->query("UPDATE initiated_checkouts SET employee_code = CONCAT('GUE', SUBSTRING(employee_code, 3))
                  WHERE employee_code REGEXP '^GU[0-9]{3}$' AND employee_code <> 'GU00'");

    // Backfill: orders stuck on blank/GU00 but buyer signed up under an employee (GUE003…)
    // Guarded — never crash the API if join matches are messy on live data
    try {
        $conn->query(
            "UPDATE orders o
             INNER JOIN users u ON u.id = o.user_id
             SET o.employee_code = UPPER(TRIM(u.referral_code))
             WHERE (o.employee_code IS NULL OR TRIM(o.employee_code) = '' OR UPPER(TRIM(o.employee_code)) = 'GU00')
               AND u.referral_code IS NOT NULL
               AND TRIM(u.referral_code) <> ''
               AND UPPER(TRIM(u.referral_code)) <> 'GU00'
               AND u.referral_code REGEXP '^GUE[0-9]{3}$'"
        );
        // Phone match only for full 10-digit mobiles (avoids empty/short false joins)
        $conn->query(
            "UPDATE orders o
             INNER JOIN users u
               ON RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(u.phone,''), ' ', ''), '-', ''), '+', ''), 10)
                = RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(o.buyer_phone,''), ' ', ''), '-', ''), '+', ''), 10)
             SET o.employee_code = UPPER(TRIM(u.referral_code))
             WHERE (o.employee_code IS NULL OR TRIM(o.employee_code) = '' OR UPPER(TRIM(o.employee_code)) = 'GU00')
               AND LENGTH(RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(o.buyer_phone,''), ' ', ''), '-', ''), '+', ''), 10)) = 10
               AND LENGTH(RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(u.phone,''), ' ', ''), '-', ''), '+', ''), 10)) = 10
               AND u.referral_code IS NOT NULL
               AND TRIM(u.referral_code) <> ''
               AND UPPER(TRIM(u.referral_code)) <> 'GU00'
               AND u.referral_code REGEXP '^GUE[0-9]{3}$'"
        );
        // Portfolio: attach orphan admin:/blank orders to signup user by 10-digit mobile
        $conn->query(
            "UPDATE orders o
             INNER JOIN (
               SELECT RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(phone,''), ' ', ''), '-', ''), '+', ''), 10) AS p10,
                      MIN(id) AS id
               FROM users
               WHERE LENGTH(RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(phone,''), ' ', ''), '-', ''), '+', ''), 10)) = 10
               GROUP BY p10
             ) u ON u.p10 = RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(o.buyer_phone,''), ' ', ''), '-', ''), '+', ''), 10)
             SET o.user_id = u.id
             WHERE o.deleted_at IS NULL
               AND LENGTH(RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(o.buyer_phone,''), ' ', ''), '-', ''), '+', ''), 10)) = 10
               AND (o.user_id IS NULL OR TRIM(o.user_id) = '' OR o.user_id LIKE 'admin:%')"
        );
        $conn->query(
            "UPDATE orders o
             INNER JOIN (
               SELECT LOWER(TRIM(email)) AS e, MIN(id) AS id
               FROM users
               WHERE email IS NOT NULL AND TRIM(email) <> '' AND LOCATE('@', email) > 1
               GROUP BY e
             ) u ON u.e = LOWER(TRIM(o.buyer_email))
             SET o.user_id = u.id
             WHERE o.deleted_at IS NULL
               AND o.buyer_email IS NOT NULL AND TRIM(o.buyer_email) <> '' AND LOCATE('@', o.buyer_email) > 1
               AND (o.user_id IS NULL OR TRIM(o.user_id) = '' OR o.user_id LIKE 'admin:%')"
        );
    } catch (Throwable $e) {
        error_log('autoMigrate order backfill skipped: ' . $e->getMessage());
    }

    $res = $conn->query("SHOW COLUMNS FROM initiated_checkouts LIKE 'employee_code'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE initiated_checkouts ADD COLUMN employee_code VARCHAR(50) DEFAULT NULL AFTER status");
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
        'isin' => "VARCHAR(20) DEFAULT ''",
        'logo_url' => "VARCHAR(255) DEFAULT ''",
        'fundamentals' => 'TEXT',
        'listing_price' => 'DECIMAL(12,2) DEFAULT NULL',
        'qty_on_hand' => 'INT NOT NULL DEFAULT 0',
        'is_top10' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'discount_tiers' => 'TEXT',
    ];
    foreach ($shareCols as $col => $def) {
        $res = $conn->query("SHOW COLUMNS FROM shares LIKE '$col'");
        if ($res && $res->num_rows === 0) {
            $conn->query("ALTER TABLE shares ADD COLUMN $col $def");
        }
    }

    $conn->query("CREATE TABLE IF NOT EXISTS invoices (
        invoice_id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL,
        buyer_name VARCHAR(100) NOT NULL,
        buyer_email VARCHAR(100) NOT NULL,
        buyer_phone VARCHAR(20) DEFAULT NULL,
        share_id VARCHAR(50) NOT NULL,
        share_name VARCHAR(100) NOT NULL,
        share_ticker VARCHAR(50) NOT NULL,
        quantity INT NOT NULL,
        price_per_share DECIMAL(12,2) NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        platform_fee DECIMAL(15,2) NOT NULL DEFAULT 0,
        stamp_duty DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT NULL,
        transaction_id VARCHAR(100) DEFAULT NULL,
        status VARCHAR(50) NOT NULL,
        invoice_date DATE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_order_invoice (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $res = $conn->query("SHOW COLUMNS FROM invoices LIKE 'custom_charges_json'");
    if ($res && $res->num_rows === 0) {
        $conn->query("ALTER TABLE invoices ADD COLUMN custom_charges_json TEXT DEFAULT NULL AFTER invoice_date");
    }

    $conn->query("CREATE TABLE IF NOT EXISTS articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        image_url VARCHAR(255) DEFAULT NULL,
        category VARCHAR(100) DEFAULT '',
        tags VARCHAR(255) DEFAULT '',
        author VARCHAR(100) DEFAULT 'GoUnlisted Team',
        status ENUM('draft','published') DEFAULT 'published',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $articleCols = [
        'category' => "VARCHAR(100) DEFAULT '' AFTER image_url",
        'tags' => "VARCHAR(255) DEFAULT '' AFTER category",
    ];
    foreach ($articleCols as $col => $def) {
        $res = $conn->query("SHOW COLUMNS FROM articles LIKE '$col'");
        if ($res && $res->num_rows === 0) {
            $conn->query("ALTER TABLE articles ADD COLUMN $col $def");
        }
    }

    seedDefaultSharesIfEmpty($conn);
}
try {
    autoMigrateSchema($conn);
} catch (Throwable $e) {
    error_log('autoMigrateSchema failed: ' . $e->getMessage());
}
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

function issueOtpForEmail($conn, $email) {
    $email = strtolower(trim($email));
    $otp = sprintf('%06d', random_int(100000, 999999));
    $otpHash = password_hash($otp, PASSWORD_DEFAULT);

    $stmt = $conn->prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))');
    $stmt->bind_param('ss', $email, $otpHash);
    $stmt->execute();

    $localDev = getenv('GU_DEV_MODE') === '1' || isLocalDev();
    $sent = guSendOtpEmail($email, $otp);

    if ($localDev) {
        error_log("DEV OTP for {$email}: {$otp}");
    } elseif (!$sent) {
        error_log("OTP email failed for {$email} — configure GU_SMTP_* or Hostinger mail()");
    }

    if ($localDev) {
        return [
            'success' => true,
            'dev_mode' => true,
            'email_sent' => $sent,
            'dev_otp' => $otp,
            'message' => $sent
                ? "OTP sent to {$email} (dev mode: code also shown below)"
                : 'Email not delivered locally — use the OTP code shown below',
        ];
    }

    if (!$sent) {
        error_log("OTP email failed for {$email} — set GU_SMTP_* in .env.local or api/mail_config.php");
        return [
            'success' => false,
            'dev_mode' => false,
            'email_sent' => false,
            'error' => guSmtpConfigured()
                ? 'Could not deliver verification email. Please try again in a minute or contact support.'
                : 'Email service is not configured on the server. Contact support — admin must set up SMTP (info@go-unlisted.com).',
        ];
    }

    return [
        'success' => true,
        'dev_mode' => false,
        'email_sent' => true,
        'message' => 'OTP sent to your email',
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
         ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), kyc_status=VALUES(kyc_status)'
    );
    $stmt->bind_param('ssssssss', $id, $name, $phone, $email, $hash, $role, $referral, $kyc);
    $stmt->execute();
}

function sanitizeArticleHtml($html) {
    $html = (string) $html;
    $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $html) ?? '';
    $html = preg_replace('/<iframe\b[^>]*>.*?<\/iframe>/is', '', $html) ?? '';
    $html = preg_replace('/javascript\s*:/i', '', $html) ?? '';

    if (!class_exists('DOMDocument')) {
        $allowed = '<p><br><strong><em><b><i><u><ul><ol><li><h1><h2><h3><h4><h5><h6><a><img><blockquote><code><pre><span><div><table><thead><tbody><tr><th><td>';
        return strip_tags($html, $allowed);
    }

    $allowedTags = [
        'p' => true, 'br' => true, 'strong' => true, 'em' => true, 'b' => true, 'i' => true, 'u' => true,
        'ul' => true, 'ol' => true, 'li' => true,
        'h1' => true, 'h2' => true, 'h3' => true, 'h4' => true, 'h5' => true, 'h6' => true,
        'a' => true, 'img' => true, 'blockquote' => true, 'code' => true, 'pre' => true,
        'span' => true, 'div' => true, 'table' => true, 'thead' => true, 'tbody' => true,
        'tr' => true, 'th' => true, 'td' => true,
    ];

    $prev = libxml_use_internal_errors(true);
    $doc = new DOMDocument('1.0', 'UTF-8');
    $wrapped = '<?xml encoding="UTF-8"><div id="gu-root">' . $html . '</div>';
    if (!@$doc->loadHTML($wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD)) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $allowed = '<' . implode('><', array_keys($allowedTags)) . '>';
        return strip_tags($html, $allowed);
    }

    $xpath = new DOMXPath($doc);
    // Remove / unwrap disallowed tags first (snapshot list)
    $all = [];
    foreach ($xpath->query('//*') as $node) {
        if ($node instanceof DOMElement) {
            $all[] = $node;
        }
    }
    foreach (array_reverse($all) as $node) {
        $tag = strtolower($node->tagName);
        if ($tag === 'div' && $node->getAttribute('id') === 'gu-root') {
            continue;
        }
        if (!isset($allowedTags[$tag])) {
            $parent = $node->parentNode;
            if ($parent) {
                while ($node->firstChild) {
                    $parent->insertBefore($node->firstChild, $node);
                }
                $parent->removeChild($node);
            }
        }
    }

    foreach ($xpath->query('//*') as $node) {
        if (!($node instanceof DOMElement)) {
            continue;
        }
        $tag = strtolower($node->tagName);
        if ($tag === 'div' && $node->getAttribute('id') === 'gu-root') {
            continue;
        }
        if (!isset($allowedTags[$tag])) {
            continue;
        }

        $keep = [];
        if ($tag === 'a') {
            $href = trim((string) $node->getAttribute('href'));
            if ($href !== '' && !preg_match('/^\s*javascript:/i', $href)) {
                $keep['href'] = $href;
            }
        }
        if ($tag === 'img') {
            $src = trim((string) $node->getAttribute('src'));
            if ($src !== '' && (preg_match('#^https?://#i', $src) || preg_match('#^uploads/#', $src))) {
                $keep['src'] = $src;
            }
            $alt = trim((string) $node->getAttribute('alt'));
            if ($alt !== '') {
                $keep['alt'] = mb_substr($alt, 0, 200);
            }
        }
        $style = (string) $node->getAttribute('style');
        if (preg_match('/text-align\s*:\s*(left|right|center|justify)\s*;?/i', $style, $m)) {
            $keep['style'] = 'text-align: ' . strtolower($m[1]) . ';';
        }

        $attrNames = [];
        if ($node->hasAttributes()) {
            foreach ($node->attributes as $attr) {
                $attrNames[] = $attr->name;
            }
        }
        foreach ($attrNames as $name) {
            $node->removeAttribute($name);
        }
        foreach ($keep as $k => $v) {
            $node->setAttribute($k, $v);
        }
    }

    $root = null;
    foreach ($xpath->query('//*[@id="gu-root"]') as $candidate) {
        if ($candidate instanceof DOMElement) {
            $root = $candidate;
            break;
        }
    }
    $out = '';
    if ($root) {
        foreach ($root->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }
    }
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    return $out;
}

function normalizeArticleTags($raw): string {
    $parts = preg_split('/[,;]+/', (string) $raw) ?: [];
    $clean = [];
    foreach ($parts as $p) {
        $t = trim(preg_replace('/\s+/', ' ', $p) ?? '');
        $t = mb_substr($t, 0, 40);
        if ($t === '') {
            continue;
        }
        $key = mb_strtolower($t);
        if (!isset($clean[$key])) {
            $clean[$key] = $t;
        }
        if (count($clean) >= 12) {
            break;
        }
    }
    return implode(', ', array_values($clean));
}

const PUBLIC_SETTINGS_KEYS = [
    'email', 'mobile', 'whatsapp', 'address', 'disclaimer',
    'bank_name', 'bank_ac_name', 'bank_ac_no', 'bank_ifsc', 'bank_upi', 'bank_branch', 'bank_address',
    // Needed on public checkout so fee toggle + charge lines match admin Site Settings
    'enable_invoice_charges', 'invoice_custom_charges',
];

/** Fallback company contact when settings row is missing (Admin → Site Settings overrides). */
const SITE_CONTACT_DEFAULTS = [
    'email' => 'infogounlisted@gmail.com',
    'mobile' => '+91 81694 49826',
    'whatsapp' => '918169449826',
    'address' => 'Malad West, Ijmima, Mumbai – 400064',
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

function refreshAdminSession(mysqli $conn): bool {
    if (empty($_SESSION['admin_id'])) {
        return false;
    }
    $adminId = (string) $_SESSION['admin_id'];
    $stmt = $conn->prepare('SELECT name, is_master, permissions, employee_id FROM employees WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('s', $adminId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        unset($_SESSION['admin_id'], $_SESSION['is_master'], $_SESSION['admin_permissions'], $_SESSION['employee_id'], $_SESSION['admin_portal'], $_SESSION['admin_name']);
        return false;
    }
    $isMaster = (int) ($row['is_master'] ?? 0) === 1;
    // Only master-admin may hold master flag (blocks DB tampering + stale sessions)
    if ($isMaster && $adminId !== 'master-admin') {
        $fix = $conn->prepare("UPDATE employees SET is_master = 0 WHERE id = ? AND id != 'master-admin'");
        $fix->bind_param('s', $adminId);
        $fix->execute();
        $isMaster = false;
    }
    $_SESSION['is_master'] = $isMaster ? 1 : 0;
    $_SESSION['admin_permissions'] = $isMaster
        ? ['*']
        : parseEmployeePermissions($row['permissions'] ?? '');
    $_SESSION['employee_id'] = strtoupper(trim((string) ($row['employee_id'] ?? '')));
    $_SESSION['admin_name'] = trim((string) ($row['name'] ?? ''));
    $_SESSION['admin_portal'] = $isMaster ? 'master' : 'staff';
    return true;
}

function requireAdmin(): void {
    global $conn;
    if (!refreshAdminSession($conn)) {
        http_response_code(401);
        sendResponse(['error' => 'Unauthorized access. Admin privileges required.']);
    }
}

function requireMasterAdmin(): void {
    requireAdmin();
    if (empty($_SESSION['is_master'])) {
        http_response_code(403);
        sendResponse(['error' => 'Forbidden. Master Admin privileges required.']);
    }
}

/** Default permissions for new employees (orders pipeline only). */
function defaultEmployeePermissions(): array {
    return ['dashboard', 'pending', 'initiated', 'orders', 'manual-order', 'cancel-refund', 'users'];
}

function parseEmployeePermissions($raw): array {
    if (is_array($raw)) {
        return array_values(array_unique(array_filter(array_map('strval', $raw))));
    }
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return array_values(array_unique(array_filter(array_map('strval', $decoded))));
        }
    }
    return defaultEmployeePermissions();
}

function adminCan(string $permission): bool {
    if (!empty($_SESSION['is_master'])) {
        return true;
    }
    $perms = $_SESSION['admin_permissions'] ?? [];
    if (!is_array($perms)) {
        $perms = [];
    }
    return in_array($permission, $perms, true) || in_array('*', $perms, true);
}

function requirePermission(string $permission): void {
    requireAdmin();
    if (!adminCan($permission)) {
        http_response_code(403);
        sendResponse(['error' => 'You do not have permission for this action']);
    }
}

function requireAnyPermission(array $permissions): void {
    requireAdmin();
    foreach ($permissions as $permission) {
        if (adminCan((string) $permission)) {
            return;
        }
    }
    http_response_code(403);
    sendResponse(['error' => 'You do not have permission for this action']);
}

function isMasterAdminSession(): bool {
    return !empty($_SESSION['is_master']);
}

function currentEmployeeCode(mysqli $conn): string {
    if (isMasterAdminSession()) {
        return '';
    }
    if (!refreshAdminSession($conn)) {
        return '';
    }
    return strtoupper(trim((string) ($_SESSION['employee_id'] ?? '')));
}

function getSettingValue(mysqli $conn, string $key, string $default = ''): string {
    $stmt = $conn->prepare('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1');
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return trim((string) ($row['setting_value'] ?? $default));
}

function lookupRmForReferralCode(mysqli $conn, string $code): ?array {
    $code = strtoupper(trim($code));
    if ($code === '') {
        return null;
    }
    $stmt = $conn->prepare(
        'SELECT name, email, phone, employee_id FROM employees
         WHERE is_master = 0 AND UPPER(TRIM(employee_id)) = ? LIMIT 1'
    );
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ?: null;
}

function defaultDirectUserCode(): string {
    return 'GU00';
}

/**
 * Employee codes are GUE001, GUE002… Direct signups use GU00.
 * Legacy mistakes like GU002 (missing E) → GUE002. Do not touch order IDs (GU0001 = 4+ digits).
 */
function canonicalizeEmployeeUserCode(string $code): string {
    $code = strtoupper(trim($code));
    if ($code === '' || $code === 'GU00') {
        return $code;
    }
    if (preg_match('/^GU(\d{3})$/', $code, $m)) {
        return 'GUE' . $m[1];
    }
    return $code;
}

function normalizeUserCode(string $code): string {
    $code = canonicalizeEmployeeUserCode($code);
    return $code !== '' ? $code : defaultDirectUserCode();
}

/** Raw code for DB writes — never invent GU00 on save; fix GU002 → GUE002. */
function sanitizeStoredUserCode(string $code): string {
    return canonicalizeEmployeeUserCode($code);
}

/** Short sequential IDs for new orders: GU0001, GU0002, … (legacy long IDs still accepted). */
function allocateNextOrderId(mysqli $conn): string {
    $res = $conn->query(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(order_id, 3) AS UNSIGNED)), 0) AS n
         FROM orders WHERE order_id REGEXP '^GU[0-9]+$'"
    );
    $next = (int) (($res->fetch_assoc()['n'] ?? 0)) + 1;
    $id = $next < 10000 ? sprintf('GU%04d', $next) : 'GU' . $next;
    $chk = $conn->prepare('SELECT 1 FROM orders WHERE order_id = ? LIMIT 1');
    $chk->bind_param('s', $id);
    $chk->execute();
    if ($chk->get_result()->fetch_assoc()) {
        return 'GU' . strtoupper(bin2hex(random_bytes(3)));
    }
    return $id;
}

function isValidOrderId(string $orderId): bool {
    return (bool) preg_match('/^GU[A-Z0-9]{3,20}$/', strtoupper($orderId));
}

function orderRowDate(array $row): ?string {
    return rowTimestampIst($row, 'created_at');
}

/** TIMESTAMP from MySQL — connection uses SET time_zone = '+05:30', so values are already IST. */
function rowTimestampIst(array $row, string $column = 'created_at'): ?string {
    $raw = $row[$column] ?? null;
    if ($raw === null || trim((string) $raw) === '') {
        return null;
    }
    return (string) $raw;
}

function mapUserRow(array $row): array {
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'kycStatus' => $row['kyc_status'],
        'kycRejectReason' => $row['kyc_reject_reason'] ?? '',
        'kycPan' => $row['kyc_pan'],
        'kycDemat' => $row['kyc_demat'],
        'kycDematProof' => $row['kyc_demat_proof'] ?? '',
        'bankAccount' => $row['bank_account'],
        'bankName' => $row['bank_name'] ?? '',
        'ifsc' => $row['ifsc'],
        'referralCode' => normalizeUserCode((string) ($row['referral_code'] ?? '')),
    ];
}

function lookupEmployeeCodeForUser(mysqli $conn, string $userId): string {
    if ($userId === '' || str_starts_with($userId, 'admin:')) {
        return '';
    }
    $stmt = $conn->prepare('SELECT referral_code FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('s', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return sanitizeStoredUserCode((string) ($row['referral_code'] ?? ''));
}

function orderBelongsToEmployee(mysqli $conn, array $orderRow): bool {
    if (isMasterAdminSession() || adminCan('view-all-orders')) {
        return true;
    }
    $code = currentEmployeeCode($conn);
    if ($code === '') {
        return false;
    }
    if (strtoupper(trim((string) ($orderRow['employee_code'] ?? ''))) === $code) {
        return true;
    }
    $userId = (string) ($orderRow['user_id'] ?? '');
    if ($userId !== '' && lookupEmployeeCodeForUser($conn, $userId) === $code) {
        return true;
    }
    if ($userId === 'admin:' . ($_SESSION['admin_id'] ?? '')) {
        return true;
    }
    return false;
}

function initiatedBelongsToEmployee(mysqli $conn, array $row): bool {
    if (isMasterAdminSession() || adminCan('view-all-orders')) {
        return true;
    }
    $code = currentEmployeeCode($conn);
    if ($code === '') {
        return false;
    }
    return strtoupper(trim((string) ($row['employee_code'] ?? ''))) === $code;
}

function mapInitiatedCheckoutRow(array $row): array {
    return [
        'sessionId' => $row['session_id'],
        'shareId' => $row['share_id'],
        'shareName' => $row['share_name'],
        'shareTicker' => $row['share_ticker'],
        'buyerName' => $row['buyer_name'],
        'buyerEmail' => $row['buyer_email'],
        'buyerPhone' => $row['buyer_phone'],
        'qty' => (int) $row['qty'],
        'pricePerShare' => (float) $row['price_per_share'],
        'totalAmount' => (float) $row['total_amount'],
        'paymentMode' => $row['payment_mode'],
        'status' => $row['status'],
        'employeeCode' => normalizeUserCode((string) ($row['employee_code'] ?? '')),
        'initiatedAt' => rowTimestampIst($row, 'created_at'),
    ];
}

/** Payment accepted / transfer in progress / done — invoice + inventory apply. */
function orderStatusIsPaid(string $status): bool {
    $s = strtolower(trim($status));
    // "Pending Verification" is unpaid until admin approves
    if (strpos($s, 'pending') !== false && strpos($s, 'verif') !== false) {
        return false;
    }
    if (strpos($s, 'pending') !== false && strpos($s, 'transfer') === false) {
        return false;
    }
    return strpos($s, 'confirm') !== false
        || strpos($s, 'verif') !== false
        || strpos($s, 'transfer') !== false
        || strpos($s, 'complete') !== false;
}

/** Platform fee + custom charges — matches invoice snapshot logic. */
function computeOrderChargeTotals(float $subtotal, mysqli $conn): array {
    $total_amount = $subtotal;
    $custom_charges_json = null;
    $setStmt = $conn->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('enable_invoice_charges', 'invoice_custom_charges')");
    $settings = [];
    if ($setStmt) {
        while ($sRow = $setStmt->fetch_assoc()) {
            $settings[$sRow['setting_key']] = $sRow['setting_value'];
        }
    }
    $enableCharges = ($settings['enable_invoice_charges'] ?? '0') === '1';
    if ($enableCharges) {
        $chargesStr = $settings['invoice_custom_charges'] ?? '[]';
        $charges = json_decode($chargesStr, true);
        if (is_array($charges) && !empty($charges)) {
            $snapshot = [];
            foreach ($charges as $c) {
                $cType = $c['type'] ?? 'flat';
                $cVal = (float) ($c['value'] ?? $c['price'] ?? 0);
                $cName = $c['name'] ?? 'Charge';
                $amt = 0.0;
                if ($cType === 'percentage') {
                    $amt = round($subtotal * ($cVal / 100), 2);
                } else {
                    $amt = round($cVal, 2);
                }
                $total_amount += $amt;
                $snapshot[] = [
                    'name' => $cName,
                    'type' => $cType,
                    'value' => $cVal,
                    'amount' => $amt,
                ];
            }
            $custom_charges_json = json_encode($snapshot);
        }
    }
    return [
        'total' => round($total_amount, 2),
        'custom_charges_json' => $custom_charges_json,
    ];
}

function employeeCodeExists(mysqli $conn, string $code): bool {
    $code = canonicalizeEmployeeUserCode($code);
    if ($code === '' || $code === 'GU00') {
        return true;
    }
    $stmt = $conn->prepare('SELECT id FROM employees WHERE UPPER(employee_id) = ? LIMIT 1');
    $stmt->bind_param('s', $code);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        return true;
    }
    // Before migrate: accept legacy GU002 if that row still exists
    if (preg_match('/^GUE(\d{3})$/', $code, $m)) {
        $legacy = 'GU' . $m[1];
        $stmt2 = $conn->prepare('SELECT id FROM employees WHERE UPPER(employee_id) = ? LIMIT 1');
        $stmt2->bind_param('s', $legacy);
        $stmt2->execute();
        return $stmt2->get_result()->num_rows > 0;
    }
    return false;
}

/** Prefer a real employee code (GUE###). GU00 / blank = unassigned / direct. */
function isRealEmployeeUserCode(string $code): bool {
    $code = canonicalizeEmployeeUserCode($code);
    return $code !== '' && $code !== 'GU00';
}

/**
 * Resolve the employee code that should be stored / shown for an order.
 * Priority: explicit assign → order row → linked buyer referral → phone match.
 */
function resolveBuyerEmployeeCode(mysqli $conn, string $userId, string $buyerPhone = '', string $buyerEmail = ''): string {
    if ($userId !== '' && !str_starts_with($userId, 'admin:')) {
        $fromUser = lookupEmployeeCodeForUser($conn, $userId);
        if (isRealEmployeeUserCode($fromUser)) {
            return sanitizeStoredUserCode($fromUser);
        }
    }
    $phone10 = preg_replace('/\D/', '', $buyerPhone);
    if (strlen($phone10) > 10) {
        $phone10 = substr($phone10, -10);
    }
    $emailLower = strtolower(trim($buyerEmail));
    if ($phone10 === '' && $emailLower === '') {
        return '';
    }
    $stmt = $conn->prepare(
        "SELECT referral_code FROM users
         WHERE (? <> '' AND RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(phone,''), ' ', ''), '-', ''), '+', ''), 10) = ?)
            OR (? <> '' AND LOWER(email) = ?)
         ORDER BY created_at DESC LIMIT 1"
    );
    $stmt->bind_param('ssss', $phone10, $phone10, $emailLower, $emailLower);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $ref = sanitizeStoredUserCode((string) ($row['referral_code'] ?? ''));
    return isRealEmployeeUserCode($ref) ? $ref : '';
}

function resolveOrderEmployeeCode(mysqli $conn, array $data, ?array $existingOrder, bool $isAdmin, bool $isUser, string $user_id, string $buyerPhone = '', string $buyerEmail = ''): string {
    $assigned = strtoupper(trim((string) ($data['assignEmployeeCode'] ?? $data['employeeCode'] ?? '')));

    // Staff: always tag with the logged-in employee (never GU00)
    if ($isAdmin && !isMasterAdminSession()) {
        $mine = sanitizeStoredUserCode(currentEmployeeCode($conn));
        return isRealEmployeeUserCode($mine) ? $mine : '';
    }

    if ($assigned !== '' && isRealEmployeeUserCode($assigned)) {
        return sanitizeStoredUserCode($assigned);
    }

    if ($existingOrder) {
        $prev = sanitizeStoredUserCode((string) ($existingOrder['employee_code'] ?? ''));
        if (isRealEmployeeUserCode($prev)) {
            return $prev;
        }
    }

    $fromBuyer = resolveBuyerEmployeeCode($conn, $user_id, $buyerPhone, $buyerEmail);
    if (isRealEmployeeUserCode($fromBuyer)) {
        return $fromBuyer;
    }

    if ($isUser) {
        $fromSession = sanitizeStoredUserCode(lookupEmployeeCodeForUser($conn, $user_id));
        return isRealEmployeeUserCode($fromSession) ? $fromSession : '';
    }

    // Master with no assign / no buyer referral → leave blank (UI shows Direct / —)
    return '';
}

/** Block privilege escalation via manipulated order status (Burp Suite). */
function requireOrderStatusChange(string $newStatus): void {
    requireAdmin();
    $s = strtolower(trim($newStatus));
    if ($s === '') {
        requireAnyPermission(['pending', 'orders', 'cancel-refund', 'manual-order']);
        return;
    }
    // Verify Payments: confirm/reject, or move to share-transfer / complete / undo-complete
    if (strpos($s, 'confirm') !== false || strpos($s, 'verif') !== false || strpos($s, 'reject') !== false) {
        requirePermission('pending');
        return;
    }
    if (strpos($s, 'complete') !== false || strpos($s, 'transfer') !== false) {
        requirePermission('pending');
        return;
    }
    // Undo Completed → Pending Verification is rare; allow with pending
    if (strpos($s, 'pending') !== false) {
        requirePermission('pending');
        return;
    }
    if (strpos($s, 'cancel') !== false || strpos($s, 'refund') !== false) {
        requirePermission('cancel-refund');
        return;
    }
    requireAnyPermission(['pending', 'orders', 'cancel-refund', 'manual-order']);
}

function rejectPrivilegedEmployeeFields(array $data): void {
    foreach (['isMaster', 'is_master'] as $key) {
        if (array_key_exists($key, $data)) {
            http_response_code(403);
            sendResponse(['error' => 'Master privileges cannot be granted via API']);
        }
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

function resolveUserByLoginId(mysqli $conn, string $loginId): ?array {
    $loginId = trim($loginId);
    if ($loginId === '') {
        return null;
    }

    if (isValidEmail($loginId)) {
        $email = strtolower($loginId);
        $stmt = $conn->prepare('SELECT id, email, phone FROM users WHERE LOWER(email) = ? LIMIT 1');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ?: null;
    }

    $phone = normalizeIndianPhone($loginId);
    if ($phone !== '' && isValidIndianMobile($phone)) {
        $stmt = $conn->prepare('SELECT id, email, phone FROM users WHERE phone = ? LIMIT 1');
        $stmt->bind_param('s', $phone);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if ($row) {
            return $row;
        }
    }

    // Legacy rows or partial match (last 10 digits).
    $stmt = $conn->prepare('SELECT id, email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1');
    $stmt->bind_param('ss', $loginId, $loginId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ?: null;
}

// CSRF — validate all state-changing POSTs except public auth entry points
ensureCsrfToken();
$csrfExempt = [
    'getCsrfToken', 'sendOtp', 'verifyOtp', 'sendResetOtp', 'resetMpin',
    'sendStaffResetOtp', 'resetStaffPassword',
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

        $to = getSettingValue($conn, 'email', SITE_CONTACT_DEFAULTS['email']);
        $subject = "Go-Unlisted Contact: $name";
        $body = "Name: $name\nEmail: $email\nIP: $ip\n\nMessage:\n$message";
        $headers = "From: Go-Unlisted <info@go-unlisted.com>\r\nReply-To: $email";
        @mail($to, $subject, $body, $headers);

        logAudit($conn, 'Contact Form', $email, ['name' => $name]);
        sendResponse(['success' => true, 'message' => 'Message sent successfully']);
        break;

    // -----------------------------------------
    // OTP GENERATION & VERIFICATION
    // -----------------------------------------
    case 'sendOtp':
        $data = getPostData();
        $email = strtolower(trim($data['email'] ?? ''));

        if (empty($email) || !isValidEmail($email)) {
            http_response_code(400);
            sendResponse(["error" => "Valid email address is required"]);
            break;
        }

        $dupEmail = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $dupEmail->bind_param('s', $email);
        $dupEmail->execute();
        if ($dupEmail->get_result()->num_rows > 0) {
            http_response_code(409);
            sendResponse(['error' => 'This email is already registered. Try logging in instead.']);
            break;
        }

        $otpResult = issueOtpForEmail($conn, $email);
        if (($otpResult['success'] ?? true) === false) {
            http_response_code(503);
        }
        sendResponse($otpResult);
        break;

    case 'sendResetOtp':
        $data = getPostData();
        $loginId = trim($data['loginId'] ?? $data['email'] ?? '');

        if (empty($loginId)) {
            http_response_code(400);
            sendResponse(['error' => 'Email or phone number is required']);
            break;
        }

        $userRow = resolveUserByLoginId($conn, $loginId);

        if (!$userRow) {
            $empLookup = trim($loginId);
            $empEmail = isValidEmail($empLookup) ? strtolower($empLookup) : $empLookup;
            $empStmt = $conn->prepare('SELECT email FROM employees WHERE LOWER(email) = ? OR employee_id = ? LIMIT 1');
            $empStmt->bind_param('ss', $empEmail, $empLookup);
            $empStmt->execute();
            if ($empStmt->get_result()->num_rows > 0) {
                http_response_code(400);
                sendResponse([
                    'success' => false,
                    'error' => 'This email is for team login (/staff/login), not investor MPIN. Use your investor email or sign in as staff.',
                ]);
                break;
            }
            sleep(1);
            sendResponse([
                'success' => false,
                'email_sent' => false,
                'error' => 'No investor account found with this email or phone. Check spelling or register first.',
            ]);
            break;
        }

        $email = strtolower(trim((string) $userRow['email']));

        $response = issueOtpForEmail($conn, $email);
        $response['email'] = $email;
        if (($response['success'] ?? true) === false) {
            http_response_code(503);
        }
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

    case 'sendStaffResetOtp':
        $data = getPostData();
        $loginId = trim($data['loginId'] ?? $data['email'] ?? '');

        if (empty($loginId)) {
            http_response_code(400);
            sendResponse(['error' => 'Email or employee ID is required']);
            break;
        }

        $empStmt = $conn->prepare('SELECT email FROM employees WHERE email = ? OR employee_id = ? LIMIT 1');
        $empStmt->bind_param('ss', $loginId, $loginId);
        $empStmt->execute();
        $empRow = $empStmt->get_result()->fetch_assoc();

        if (!$empRow) {
            sleep(1);
            sendResponse([
                'success' => true,
                'message' => 'If a team account exists, OTP has been sent to the registered work email.',
            ]);
            break;
        }

        $email = strtolower(trim((string) $empRow['email']));
        $response = issueOtpForEmail($conn, $email);
        $response['email'] = $email;
        if (($response['success'] ?? true) === false) {
            http_response_code(503);
        }
        sendResponse($response);
        break;

    case 'resetStaffPassword':
        $data = getPostData();
        $email = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';

        if (empty($email) || !isValidEmail($email)) {
            http_response_code(400);
            sendResponse(['error' => 'Valid work email is required']);
            break;
        }
        if (strlen($password) < 6) {
            http_response_code(400);
            sendResponse(['error' => 'Password must be at least 6 characters']);
            break;
        }

        $verifiedAt = $_SESSION['otp_verified'][$email] ?? null;
        if (!$verifiedAt || (time() - $verifiedAt) > 900) {
            http_response_code(403);
            sendResponse(['error' => 'OTP verification required. Please verify OTP first.']);
            break;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare('UPDATE employees SET password = ? WHERE email = ?');
        $stmt->bind_param('ss', $hash, $email);
        $stmt->execute();

        if ($stmt->affected_rows === 0) {
            http_response_code(404);
            sendResponse(['error' => 'Team account not found']);
            break;
        }

        unset($_SESSION['otp_verified'][$email]);
        sendResponse(['success' => true, 'message' => 'Password reset successfully. You can sign in at /staff/login']);
        break;

    case 'verifyOtp':
        $data = getPostData();
        $email = strtolower(trim($data['email'] ?? ''));
        $otp = $data['otp'] ?? '';

        if (empty($otp) || !preg_match('/^\d{6}$/', $otp)) {
            http_response_code(400);
            sendResponse(["success" => false, "error" => "Enter the 6-digit OTP"]);
            break;
        }

        if (empty($email) || !isValidEmail($email)) {
            http_response_code(400);
            sendResponse(["error" => "Valid email address is required"]);
            break;
        }

        $stmt = $conn->prepare("SELECT id, otp_code FROM otps WHERE identifier = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($row = $result->fetch_assoc()) {
            if (password_verify($otp, $row['otp_code'])) {
                $delStmt = $conn->prepare("DELETE FROM otps WHERE id = ?");
                $delStmt->bind_param("i", $row['id']);
                $delStmt->execute();

                if (!isset($_SESSION['otp_verified'])) {
                    $_SESSION['otp_verified'] = [];
                }
                $_SESSION['otp_verified'][$email] = time();

                sendResponse(["success" => true, "message" => "OTP verified"]);
                break;
            }
        }
        http_response_code(400);
        sendResponse(["success" => false, "error" => "Invalid or expired OTP"]);
        break;

    // -----------------------------------------
    // LOGIN & LOGOUT
    // -----------------------------------------
    case 'loginAdmin':
        $data = getPostData();
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';
        $portal = strtolower(trim((string) ($data['portal'] ?? 'master')));
        if (!in_array($portal, ['master', 'staff'], true)) {
            $portal = 'master';
        }

        $stmt = $conn->prepare("SELECT id, password, is_master, name, employee_id, permissions FROM employees WHERE email = ? OR employee_id = ?");
        $stmt->bind_param("ss", $email, $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($row = $result->fetch_assoc()) {
            $isMasterRow = (int) ($row['is_master'] ?? 0) === 1 && $row['id'] === 'master-admin';
            if ($portal === 'master' && !$isMasterRow) {
                http_response_code(401);
                sendResponse(['error' => 'Employee accounts must sign in at /staff/login']);
                break;
            }
            if ($portal === 'staff' && $isMasterRow) {
                http_response_code(401);
                sendResponse(['error' => 'Master Admin must sign in at /admin/login']);
                break;
            }
            if (password_verify($password, $row['password'])) {
                session_regenerate_id(true);
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
                $_SESSION['admin_id'] = $row['id'];
                $_SESSION['is_master'] = $isMasterRow ? 1 : 0;
                $_SESSION['admin_portal'] = $portal;
                $_SESSION['employee_id'] = $row['employee_id'] ?? '';
                $_SESSION['admin_name'] = trim((string) ($row['name'] ?? ''));
                $perms = $isMasterRow
                    ? ['*']
                    : parseEmployeePermissions($row['permissions'] ?? '');
                $_SESSION['admin_permissions'] = $perms;
                logAudit($conn, 'Admin Login', $row['id'], ['portal' => $portal]);
                sendResponse([
                    "success" => true,
                    "id" => $row['id'],
                    "isMaster" => $isMasterRow,
                    "portal" => $portal,
                    "name" => $row['name'],
                    "employeeId" => $row['employee_id'] ?? '',
                    "employeeCode" => $row['employee_id'] ?? '',
                    "permissions" => $perms,
                ]);
            }
        }
        http_response_code(401);
        sendResponse(["error" => "Invalid credentials"]);
        break;

    case 'loginUser':
        $data = getPostData();
        $loginId = trim($data['email'] ?? $data['loginId'] ?? '');
        $password = $data['password'] ?? '';

        $userRow = resolveUserByLoginId($conn, $loginId);
        if ($userRow) {
            $uid = $userRow['id'];
            $stmt = $conn->prepare("SELECT id, password, name, email, phone, referral_code, kyc_status, kyc_reject_reason, kyc_pan, kyc_demat, kyc_demat_proof, bank_account, bank_name, ifsc FROM users WHERE id = ? LIMIT 1");
            $stmt->bind_param('s', $uid);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
        } else {
            $row = null;
        }

        if ($row && password_verify($password, $row['password'])) {
            session_regenerate_id(true);
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            $_SESSION['user_id'] = $row['id'];
            logAudit($conn, 'User Login', $row['id'], []);
            sendResponse([
                'success' => true,
                'user' => mapUserRow($row),
            ]);
        }
        http_response_code(401);
        sendResponse(['error' => 'Invalid email/phone or MPIN']);
        break;

    case 'logout':
        session_destroy();
        sendResponse(["success" => true]);
        break;

    case 'checkAuth':
        if (isset($_SESSION['admin_id'])) {
            if (!refreshAdminSession($conn)) {
                sendResponse(['authenticated' => false]);
                break;
            }
            $perms = !empty($_SESSION['is_master'])
                ? ['*']
                : (is_array($_SESSION['admin_permissions'] ?? null)
                    ? $_SESSION['admin_permissions']
                    : defaultEmployeePermissions());
            $portal = $_SESSION['admin_portal'] ?? (!empty($_SESSION['is_master']) ? 'master' : 'staff');
            sendResponse([
                "authenticated" => true,
                "type" => "admin",
                "id" => $_SESSION['admin_id'],
                "isMaster" => !empty($_SESSION['is_master']),
                "portal" => $portal,
                "name" => $_SESSION['admin_name'] ?? '',
                "employeeId" => $_SESSION['employee_id'] ?? '',
                "employeeCode" => $_SESSION['employee_id'] ?? '',
                "permissions" => $perms,
                "csrfToken" => ensureCsrfToken(),
            ]);
        } else if (isset($_SESSION['user_id'])) {
            $uid = $_SESSION['user_id'];
            $stmt = $conn->prepare('SELECT id, name, email, phone, referral_code, kyc_status, kyc_reject_reason, kyc_pan, kyc_demat, kyc_demat_proof, bank_account, bank_name, ifsc FROM users WHERE id = ?');
            $stmt->bind_param('s', $uid);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            if ($row) {
                sendResponse([
                    'authenticated' => true,
                    'type' => 'user',
                    'id' => $row['id'],
                    'user' => mapUserRow($row),
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
        requireMasterAdmin();
        // Master Admin first, then employees by name
        $res = $conn->query("SELECT id, employee_id, name, email, phone, is_master, permissions, created_at FROM employees ORDER BY is_master DESC, name ASC");
        $data = [];
        while ($row = $res->fetch_assoc()) {
            $row['is_master'] = (int) ($row['is_master'] ?? 0);
            $row['permissions'] = !empty($row['is_master'])
                ? ['*']
                : parseEmployeePermissions($row['permissions'] ?? '');
            $data[] = $row;
        }
        sendResponse($data);
        break;

    case 'saveEmployee':
        requireMasterAdmin();
        $data = getPostData();
        rejectPrivilegedEmployeeFields($data);
        $id = !empty($data['id']) ? $data['id'] : 'emp-' . uniqid();
        $name = htmlspecialchars($data['name']);
        $email = htmlspecialchars($data['email']);
        $employee_id = canonicalizeEmployeeUserCode(htmlspecialchars($data['employeeId'] ?? ''));
        $phoneRaw = trim((string) ($data['phone'] ?? ''));
        $phone = $phoneRaw !== '' ? htmlspecialchars(normalizeIndianPhone($phoneRaw)) : '';
        $permissionsJson = json_encode(parseEmployeePermissions($data['permissions'] ?? defaultEmployeePermissions()));

        $stmtCheck = $conn->prepare("SELECT id, is_master FROM employees WHERE id=?");
        $stmtCheck->bind_param("s", $id);
        $stmtCheck->execute();
        $existingEmp = $stmtCheck->get_result()->fetch_assoc();
        $exists = (bool) $existingEmp;

        // Never change master permissions via this form
        if ($exists && !empty($existingEmp['is_master'])) {
            $permissionsJson = null;
        }

        if ($exists) {
            if (!empty($data['password'])) {
                $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
                if ($permissionsJson !== null) {
                    $stmt = $conn->prepare("UPDATE employees SET name=?, email=?, phone=?, employee_id=?, password=?, permissions=? WHERE id=? AND is_master=0");
                    $stmt->bind_param("sssssss", $name, $email, $phone, $employee_id, $hashed, $permissionsJson, $id);
                } else {
                    $stmt = $conn->prepare("UPDATE employees SET name=?, email=?, phone=?, employee_id=?, password=? WHERE id=?");
                    $stmt->bind_param("ssssss", $name, $email, $phone, $employee_id, $hashed, $id);
                }
            } else {
                if ($permissionsJson !== null) {
                    $stmt = $conn->prepare("UPDATE employees SET name=?, email=?, phone=?, employee_id=?, permissions=? WHERE id=? AND is_master=0");
                    $stmt->bind_param("ssssss", $name, $email, $phone, $employee_id, $permissionsJson, $id);
                } else {
                    $stmt = $conn->prepare("UPDATE employees SET name=?, email=?, phone=?, employee_id=? WHERE id=?");
                    $stmt->bind_param("sssss", $name, $email, $phone, $employee_id, $id);
                }
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
            $stmt = $conn->prepare("INSERT INTO employees (id, name, email, phone, employee_id, password, permissions, is_master) VALUES (?, ?, ?, ?, ?, ?, ?, 0)");
            $stmt->bind_param("sssssss", $id, $name, $email, $phone, $employee_id, $hashed, $permissionsJson);
            if (!$stmt->execute()) {
                http_response_code(400);
                sendResponse(["error" => "Failed to add employee. Email or Employee ID may already exist."]);
            }
        }
        sendResponse(["success" => true, "id" => $id]);
        break;

    case 'deleteEmployee':
        requireMasterAdmin();
        $data = getPostData();
        $id = $data['id'];
        $stmt = $conn->prepare("DELETE FROM employees WHERE id=? AND is_master=0");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        sendResponse(["success" => true]);
        break;

    case 'demoteEmployee':
        requireMasterAdmin();
        $data = getPostData();
        $id = $data['id'] ?? '';
        if ($id === '' || $id === 'master-admin') {
            http_response_code(400);
            sendResponse(['error' => 'Cannot demote the primary master admin account']);
            break;
        }
        $perms = json_encode(defaultEmployeePermissions());
        $stmt = $conn->prepare("UPDATE employees SET is_master = 0, permissions = ? WHERE id = ? AND is_master = 1");
        $stmt->bind_param('ss', $perms, $id);
        $stmt->execute();
        if ($stmt->affected_rows === 0) {
            http_response_code(404);
            sendResponse(['error' => 'Employee not found or is not a master admin']);
            break;
        }
        logAudit($conn, 'Demote Master Admin', $_SESSION['admin_id'], ['employeeId' => $id]);
        sendResponse(['success' => true, 'message' => 'Master access removed. Employee now has default permissions.']);
        break;

    case 'getInventory':
        requireMasterAdmin();
        $res = $conn->query("SELECT * FROM shares WHERE is_active = 1 ORDER BY name ASC");
        $items = [];
        while ($row = $res->fetch_assoc()) {
            $mapped = mapShareRow($row, true);
            $sell = (float) $mapped['price'];
            $buy = isset($mapped['buyPrice']) ? (float) $mapped['buyPrice'] : 0;
            $qty = (int) ($mapped['qtyOnHand'] ?? 0);
            $mapped['marginPerShare'] = $buy > 0 ? round($sell - $buy, 2) : null;
            $mapped['marginPct'] = $buy > 0 ? round((($sell - $buy) / $buy) * 100, 1) : null;
            $mapped['inventoryValue'] = $buy > 0 ? round($qty * $buy, 2) : null;
            $items[] = $mapped;
        }
        sendResponse($items);
        break;

    case 'updateInventory':
        requireMasterAdmin();
        $data = getPostData();
        $share_id = preg_replace('/[^a-z0-9-]/', '', strtolower($data['shareId'] ?? ''));
        if (!$share_id) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid share']);
            break;
        }
        $qty = max(0, (int) ($data['qtyOnHand'] ?? 0));
        $inventory_status = trim($data['inventoryStatus'] ?? 'In Stock');
        $has_buy = array_key_exists('buyPrice', $data);
        $buy_price = null;
        if ($has_buy && $data['buyPrice'] !== '' && $data['buyPrice'] !== null) {
            $buy_price = (float) $data['buyPrice'];
            if ($buy_price <= 0) {
                $buy_price = null;
            }
        }
        $stmt = $conn->prepare('UPDATE shares SET qty_on_hand = ?, inventory_status = ? WHERE share_id = ? AND is_active = 1');
        $stmt->bind_param('iss', $qty, $inventory_status, $share_id);
        $stmt->execute();
        if ($stmt->affected_rows === 0) {
            http_response_code(404);
            sendResponse(['error' => 'Share not found']);
            break;
        }
        if ($has_buy) {
            if ($buy_price === null) {
                $bp = $conn->prepare('UPDATE shares SET buy_price = NULL WHERE share_id = ?');
                $bp->bind_param('s', $share_id);
                $bp->execute();
            } else {
                $bp = $conn->prepare('UPDATE shares SET buy_price = ? WHERE share_id = ?');
                $bp->bind_param('ds', $buy_price, $share_id);
                $bp->execute();
            }
        }
        logAudit($conn, 'Update Inventory', $_SESSION['admin_id'], ['shareId' => $share_id, 'qty' => $qty]);
        sendResponse(['success' => true]);
        break;

    case 'getInvoices':
        requireMasterAdmin();
        $res = $conn->query('SELECT * FROM invoices ORDER BY created_at DESC');
        $data = [];
        while ($row = $res->fetch_assoc()) {
            $data[] = mapInvoiceRow($row);
        }
        sendResponse($data);
        break;

    case 'getInvoice':
        requireAuth();
        $invoiceId = $_GET['invoiceId'] ?? '';
        if (!$invoiceId) {
            http_response_code(400);
            sendResponse(['error' => 'Invoice ID required']);
            break;
        }
        $stmt = $conn->prepare('
            SELECT i.*, o.user_id 
            FROM invoices i 
            LEFT JOIN orders o ON i.order_id = o.order_id 
            WHERE i.invoice_id = ? LIMIT 1
        ');
        $stmt->bind_param('s', $invoiceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            http_response_code(404);
            sendResponse(['error' => 'Invoice not found']);
            break;
        }
        if (!isset($_SESSION['admin_id']) && $row['user_id'] !== $_SESSION['user_id']) {
            http_response_code(403);
            sendResponse(['error' => 'Access denied']);
            break;
        }
        sendResponse(mapInvoiceRow($row));
        break;

    case 'getInvoiceByOrder':
        requireAuth();
        $orderId = $_GET['orderId'] ?? '';
        if (!$orderId) {
            http_response_code(400);
            sendResponse(['error' => 'Order ID required']);
            break;
        }
        $stmt = $conn->prepare('
            SELECT i.*, o.user_id 
            FROM invoices i 
            LEFT JOIN orders o ON i.order_id = o.order_id 
            WHERE i.order_id = ? LIMIT 1
        ');
        $stmt->bind_param('s', $orderId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            http_response_code(404);
            sendResponse(['error' => 'Invoice not found']);
            break;
        }
        if (!isset($_SESSION['admin_id']) && $row['user_id'] !== $_SESSION['user_id']) {
            http_response_code(403);
            sendResponse(['error' => 'Access denied']);
            break;
        }
        sendResponse(mapInvoiceRow($row));
        break;

    case 'generateInvoice':
        requireMasterAdmin();
        validateCsrfToken();
        $data = getPostData();
        $orderId = trim($data['orderId'] ?? '');
        if (!$orderId) {
            http_response_code(400);
            sendResponse(['error' => 'Order ID required']);
            break;
        }
        // Explicit booleans from checkboxes (false must clear existing fee lines)
        $includeFee = array_key_exists('includePlatformFee', $data)
            ? filter_var($data['includePlatformFee'], FILTER_VALIDATE_BOOLEAN)
            : false;
        $includeStamp = array_key_exists('includeStampDuty', $data)
            ? filter_var($data['includeStampDuty'], FILTER_VALIDATE_BOOLEAN)
            : false;
        $opts = [
            'includePlatformFee' => $includeFee,
            'includeStampDuty' => $includeStamp,
            'updateExisting' => true,
        ];
        $invoice = createInvoiceFromOrder($conn, $orderId, $opts);
        if (!$invoice) {
            http_response_code(404);
            sendResponse(['error' => 'Could not generate invoice for this order']);
            break;
        }
        sendResponse(['success' => true, 'invoice' => $invoice]);
        break;

    case 'updateInvoiceCharges':
        requireMasterAdmin();
        validateCsrfToken();
        $data = getPostData();
        $invoiceId = trim($data['invoiceId'] ?? '');
        if ($invoiceId === '') {
            http_response_code(400);
            sendResponse(['error' => 'Invoice ID required']);
            break;
        }
        $includeFee = array_key_exists('includePlatformFee', $data)
            ? filter_var($data['includePlatformFee'], FILTER_VALIDATE_BOOLEAN)
            : false;
        $includeStamp = array_key_exists('includeStampDuty', $data)
            ? filter_var($data['includeStampDuty'], FILTER_VALIDATE_BOOLEAN)
            : false;
        $invoice = updateInvoiceCharges($conn, $invoiceId, [
            'includePlatformFee' => $includeFee,
            'includeStampDuty' => $includeStamp,
        ]);
        if (!$invoice) {
            http_response_code(404);
            sendResponse(['error' => 'Invoice not found']);
            break;
        }
        sendResponse(['success' => true, 'invoice' => $invoice]);
        break;

    case 'adminDeleteInvoice':
        requireAdmin();
        $postData = getPostData();
        $invoiceId = $postData['invoiceId'] ?? '';
        if ($invoiceId === '') {
            http_response_code(400);
            sendResponse(['error' => 'Invoice ID is required']);
            break;
        }
        $stmt = $conn->prepare("DELETE FROM invoices WHERE invoice_id=?");
        $stmt->bind_param("s", $invoiceId);
        $stmt->execute();
        if ($stmt->affected_rows === 0) {
            http_response_code(404);
            sendResponse(['error' => 'Invoice not found or already deleted']);
            break;
        }
        logAudit($conn, 'Delete Invoice', $_SESSION['admin_id'], ['invoiceId' => $invoiceId]);
        sendResponse(['success' => true]);
        break;

    // -----------------------------------------
    // USERS (Admin Only or Self)
    // -----------------------------------------
    case 'getUsers':
        requireAnyPermission(['users', 'signups', 'manual-order']);
        if (isMasterAdminSession() || adminCan('view-all-kyc')) {
            $res = $conn->query("SELECT id, name, phone, email, role, referral_code, kyc_status, kyc_reject_reason, kyc_pan, kyc_demat, kyc_demat_proof, bank_account, bank_name, ifsc, created_at FROM users ORDER BY created_at DESC");
        } else {
            $code = currentEmployeeCode($conn);
            $stmt = $conn->prepare("SELECT id, name, phone, email, role, referral_code, kyc_status, kyc_reject_reason, kyc_pan, kyc_demat, kyc_demat_proof, bank_account, bank_name, ifsc, created_at FROM users WHERE UPPER(referral_code) = ? ORDER BY created_at DESC");
            $stmt->bind_param('s', $code);
            $stmt->execute();
            $res = $stmt->get_result();
        }
        $data = [];
        while ($row = $res->fetch_assoc()) { $data[] = $row; }
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
        if ($exists && isset($_SESSION['admin_id'])) {
            requirePermission('users');
            $chk = $conn->prepare('SELECT referral_code FROM users WHERE id = ? LIMIT 1');
            $chk->bind_param('s', $id);
            $chk->execute();
            $u = $chk->get_result()->fetch_assoc();
            $existingReferral = strtoupper(trim((string) ($u['referral_code'] ?? '')));
            if (!isMasterAdminSession()) {
                // Employees may edit KYC for their clients, but never reassign (transfer) to another employee
                if (!adminCan('view-all-kyc')) {
                    $code = currentEmployeeCode($conn);
                    if ($existingReferral !== $code) {
                        http_response_code(403);
                        sendResponse(['error' => 'You can only edit users signed up with your employee code']);
                        break;
                    }
                }
                $referral_code = $existingReferral;
            }
        }

        // SEC: Role is never escalated via API — investors are always role=user
        $role = 'user';

        $name = htmlspecialchars($data['name']);
        $phone = htmlspecialchars($data['phone']);
        $email = htmlspecialchars($data['email']);
        if (!isset($referral_code)) {
            $referral_code = htmlspecialchars($data['referralCode'] ?? '');
        }
        if (!$exists) {
            $referral_code = sanitizeStoredUserCode($referral_code);
        }
        if (isset($_SESSION['admin_id']) && !isMasterAdminSession() && !adminCan('view-all-kyc') && !$exists) {
            $empCode = currentEmployeeCode($conn);
            if ($empCode !== '' && ($referral_code === '' || strtoupper($referral_code) !== $empCode)) {
                $referral_code = $empCode;
            }
        }
        $kyc_status = htmlspecialchars($data['kycStatus'] ?? 'Not Submitted');
        $kyc_reject_reason = htmlspecialchars($data['kycRejectReason'] ?? $data['kyc_reject_reason'] ?? '');
        if ($kyc_status === 'Verified') {
            $kyc_reject_reason = '';
        }
        $kyc_pan = htmlspecialchars($data['kycPan'] ?? '');
        $kyc_demat = htmlspecialchars($data['kycDemat'] ?? '');
        $bank_account = htmlspecialchars($data['bankAccount'] ?? $data['bank_account'] ?? '');
        $bank_name = htmlspecialchars(trim((string) ($data['bankName'] ?? $data['bank_name'] ?? '')));
        $ifsc = htmlspecialchars(strtoupper($data['ifsc'] ?? $data['ifscCode'] ?? ''));

        // Preserve demat proof / bank name when admin edits without resending them
        $kyc_demat_proof = trim((string) ($data['kycDematProof'] ?? $data['kyc_demat_proof'] ?? ''));
        if ($kyc_demat_proof !== '' && !preg_match('#^uploads/kyc/[a-zA-Z0-9._-]+$#', $kyc_demat_proof)) {
            $kyc_demat_proof = '';
        }
        if ($exists) {
            $prev = $conn->prepare('SELECT kyc_demat_proof, bank_name FROM users WHERE id = ? LIMIT 1');
            $prev->bind_param('s', $id);
            $prev->execute();
            $prevRow = $prev->get_result()->fetch_assoc() ?: [];
            if ($kyc_demat_proof === '' && !empty($prevRow['kyc_demat_proof'])) {
                $kyc_demat_proof = (string) $prevRow['kyc_demat_proof'];
            }
            if ($bank_name === '' && array_key_exists('bankName', $data) === false && array_key_exists('bank_name', $data) === false) {
                $bank_name = htmlspecialchars(trim((string) ($prevRow['bank_name'] ?? '')));
            }
        }

        // Validate Employee Code if it was changed
        $referral_code = strtoupper(trim($referral_code));
        if ($referral_code !== '' && $referral_code !== 'GU00') {
            $empChk = $conn->prepare("SELECT id FROM employees WHERE employee_id = ? LIMIT 1");
            $empChk->bind_param("s", $referral_code);
            $empChk->execute();
            if ($empChk->get_result()->num_rows === 0) {
                http_response_code(400);
                sendResponse(["error" => "Invalid employee code: $referral_code does not exist."]);
                exit;
            }
        }

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
            $emailNorm = strtolower(trim($data['email'] ?? ''));
            $verifiedAt = $_SESSION['otp_verified'][$emailNorm] ?? null;
            if (!$verifiedAt || (time() - $verifiedAt) > 900) {
                http_response_code(403);
                sendResponse(["error" => "Email verification required. Enter the OTP sent to your email."]);
            }
            unset($_SESSION['otp_verified'][$emailNorm]);

            $phoneNorm = normalizeIndianPhone($phone);
            if ($phoneNorm === '' || !isValidIndianMobile($phoneNorm)) {
                http_response_code(400);
                sendResponse(["error" => "Valid 10-digit Indian mobile number is required"]);
            }
            $phone = $phoneNorm;
        }

        if ($exists) {
            if (!empty($data['password'])) {
                $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
                $stmt = $conn->prepare("UPDATE users SET name=?, phone=?, email=?, role=?, referral_code=?, kyc_status=?, kyc_reject_reason=?, kyc_pan=?, kyc_demat=?, kyc_demat_proof=?, bank_account=?, bank_name=?, ifsc=?, password=? WHERE id=?");
                $stmt->bind_param("sssssssssssssss", $name, $phone, $email, $role, $referral_code, $kyc_status, $kyc_reject_reason, $kyc_pan, $kyc_demat, $kyc_demat_proof, $bank_account, $bank_name, $ifsc, $hashed, $id);
            } else {
                $stmt = $conn->prepare("UPDATE users SET name=?, phone=?, email=?, role=?, referral_code=?, kyc_status=?, kyc_reject_reason=?, kyc_pan=?, kyc_demat=?, kyc_demat_proof=?, bank_account=?, bank_name=?, ifsc=? WHERE id=?");
                $stmt->bind_param("ssssssssssssss", $name, $phone, $email, $role, $referral_code, $kyc_status, $kyc_reject_reason, $kyc_pan, $kyc_demat, $kyc_demat_proof, $bank_account, $bank_name, $ifsc, $id);
            }
            $stmt->execute();
        } else {
            $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
            if ($phone !== '') {
                $dup = $conn->prepare('SELECT id FROM users WHERE email = ? OR phone = ?');
                $dup->bind_param('ss', $emailNorm, $phone);
            } else {
                $dup = $conn->prepare('SELECT id FROM users WHERE email = ?');
                $dup->bind_param('s', $emailNorm);
            }
            $dup->execute();
            if ($dup->get_result()->num_rows > 0) {
                http_response_code(409);
                sendResponse(['error' => 'An account with this email or phone already exists. Try logging in instead.']);
                break;
            }
            $stmt = $conn->prepare("INSERT INTO users (id, name, phone, email, password, role, referral_code, kyc_status, kyc_pan, kyc_demat, kyc_demat_proof, bank_account, bank_name, ifsc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssssssssssss", $id, $name, $phone, $email, $hashed, $role, $referral_code, $kyc_status, $kyc_pan, $kyc_demat, $kyc_demat_proof, $bank_account, $bank_name, $ifsc);
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
        requirePermission('users');
        $data = getPostData();
        $email = $data['email'] ?? '';
        if (!isMasterAdminSession()) {
            $code = currentEmployeeCode($conn);
            $chk = $conn->prepare('SELECT referral_code FROM users WHERE email = ? LIMIT 1');
            $chk->bind_param('s', $email);
            $chk->execute();
            $u = $chk->get_result()->fetch_assoc();
            if (!$u || strtoupper(trim((string) ($u['referral_code'] ?? ''))) !== $code) {
                http_response_code(403);
                sendResponse(['error' => 'You can only delete users signed up with your employee code']);
                break;
            }
        }
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
        validateCsrfToken();
        $data = getPostData();
        $user_id = $_SESSION['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(403);
            sendResponse(["error" => "Only logged-in users can update their KYC"]);
            break;
        }

        // Block edits while already verified
        $cur = $conn->prepare('SELECT kyc_status, kyc_demat_proof FROM users WHERE id = ? LIMIT 1');
        $cur->bind_param('s', $user_id);
        $cur->execute();
        $curRow = $cur->get_result()->fetch_assoc();
        if ($curRow && strcasecmp(trim((string) $curRow['kyc_status']), 'Verified') === 0) {
            http_response_code(403);
            sendResponse(['error' => 'KYC is already verified. Contact support to change details.']);
            break;
        }

        $kyc_pan = strtoupper(trim((string) ($data['pan'] ?? '')));
        $kyc_demat = preg_replace('/\D/', '', (string) ($data['demat'] ?? ''));
        $bank_account = preg_replace('/\s+/', '', trim((string) ($data['bankAccount'] ?? $data['bank'] ?? '')));
        $bank_name = trim((string) ($data['bankName'] ?? $data['bank_name'] ?? ''));
        $ifsc = strtoupper(trim((string) ($data['ifsc'] ?? '')));
        $kyc_demat_proof = trim((string) ($data['kycDematProof'] ?? $data['dematProof'] ?? ''));
        if ($kyc_demat_proof === '' && !empty($curRow['kyc_demat_proof'])) {
            $kyc_demat_proof = (string) $curRow['kyc_demat_proof'];
        }

        if (!preg_match('/^[A-Z]{5}[0-9]{4}[A-Z]$/', $kyc_pan)) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid PAN format (e.g. ABCDE1234F)']);
            break;
        }
        if (!preg_match('/^\d{16}$/', $kyc_demat)) {
            http_response_code(400);
            sendResponse(['error' => 'Demat account must be exactly 16 digits']);
            break;
        }
        if (strlen($bank_name) < 2 || strlen($bank_name) > 100) {
            http_response_code(400);
            sendResponse(['error' => 'Bank name is required']);
            break;
        }
        if (!preg_match('/^\d{9,18}$/', $bank_account)) {
            http_response_code(400);
            sendResponse(['error' => 'Enter a valid bank account number (9–18 digits)']);
            break;
        }
        if (!preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', $ifsc)) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid IFSC code']);
            break;
        }
        if ($kyc_demat_proof === '' || !preg_match('#^uploads/kyc/[a-zA-Z0-9._-]+$#', $kyc_demat_proof)) {
            http_response_code(400);
            sendResponse(['error' => 'Upload CMR / demat proof (image or PDF) before submitting']);
            break;
        }
        $proofPath = __DIR__ . '/../' . $kyc_demat_proof;
        if (!is_file($proofPath)) {
            http_response_code(400);
            sendResponse(['error' => 'Demat proof file not found. Please upload again.']);
            break;
        }

        $kyc_pan = htmlspecialchars($kyc_pan);
        $kyc_demat = htmlspecialchars($kyc_demat);
        $bank_account = htmlspecialchars($bank_account);
        $bank_name = htmlspecialchars($bank_name);
        $ifsc = htmlspecialchars($ifsc);
        $kyc_status = 'Under Review';

        $stmt = $conn->prepare("UPDATE users SET kyc_pan=?, kyc_demat=?, kyc_demat_proof=?, bank_account=?, bank_name=?, ifsc=?, kyc_status=?, kyc_reject_reason=NULL WHERE id=?");
        $stmt->bind_param("ssssssss", $kyc_pan, $kyc_demat, $kyc_demat_proof, $bank_account, $bank_name, $ifsc, $kyc_status, $user_id);
        $stmt->execute();

        logAudit($conn, 'User KYC Submit', $user_id, ['pan' => $kyc_pan]);
        sendResponse(["success" => true, "kycStatus" => $kyc_status]);
        break;

    case 'uploadKycDematProof':
        requireAuth();
        validateCsrfToken();
        $user_id = $_SESSION['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(403);
            sendResponse(['error' => 'Login required to upload demat proof']);
            break;
        }
        if (!isset($_FILES['proof'])) {
            http_response_code(400);
            sendResponse(['error' => 'No file received. Try again.']);
            break;
        }
        $fileErr = (int) ($_FILES['proof']['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($fileErr !== UPLOAD_ERR_OK) {
            $uploadErrors = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds server limit',
                UPLOAD_ERR_FORM_SIZE => 'File too large',
                UPLOAD_ERR_PARTIAL => 'Upload incomplete — try again',
                UPLOAD_ERR_NO_FILE => 'No file selected',
            ];
            http_response_code(400);
            sendResponse(['error' => $uploadErrors[$fileErr] ?? "Upload error code $fileErr"]);
            break;
        }
        $tmpName = $_FILES['proof']['tmp_name'];
        $fileSize = (int) $_FILES['proof']['size'];
        if ($fileSize <= 0 || $fileSize > 5 * 1024 * 1024) {
            http_response_code(400);
            sendResponse(['error' => 'File must be under 5MB']);
            break;
        }
        $mime = '';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = (string) finfo_file($finfo, $tmpName);
            finfo_close($finfo);
        }
        $allowedMimes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
        ];
        if ($mime === '' || $mime === 'application/octet-stream') {
            $info = @getimagesize($tmpName);
            if (is_array($info) && !empty($info['mime']) && isset($allowedMimes[$info['mime']])) {
                $mime = $info['mime'];
            }
        }
        if (!isset($allowedMimes[$mime])) {
            http_response_code(400);
            sendResponse(['error' => 'Use JPG, PNG, WEBP, or PDF only']);
            break;
        }
        $uploadDir = __DIR__ . '/../uploads/kyc/';
        if (!is_dir($uploadDir)) {
            if (!@mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                http_response_code(500);
                sendResponse(['error' => 'Could not create upload folder. Create public_html/uploads/kyc on the server.']);
                break;
            }
        }
        if (!is_writable($uploadDir)) {
            http_response_code(500);
            sendResponse(['error' => 'Upload folder is not writable. Set permissions on uploads/kyc.']);
            break;
        }
        $safeUser = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $user_id) ?: 'user';
        $filename = 'kyc_' . $safeUser . '_' . time() . '_' . random_int(1000, 9999) . '.' . $allowedMimes[$mime];
        $target = $uploadDir . $filename;
        if (!move_uploaded_file($tmpName, $target)) {
            http_response_code(500);
            sendResponse(['error' => 'Failed to save file']);
            break;
        }
        @chmod($target, 0644);
        $url = 'uploads/kyc/' . $filename;
        logAudit($conn, 'Upload KYC Demat Proof', $user_id, ['file' => $filename]);
        sendResponse(['success' => true, 'url' => $url]);
        break;

    case 'getAccountContacts':
        requireAuth();
        $userId = $_SESSION['user_id'] ?? '';
        $stmt = $conn->prepare('SELECT referral_code FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('s', $userId);
        $stmt->execute();
        $userRow = $stmt->get_result()->fetch_assoc();
        $referralCode = normalizeUserCode((string) ($userRow['referral_code'] ?? ''));

        $supportPhone = getSettingValue($conn, 'mobile', SITE_CONTACT_DEFAULTS['mobile']);
        $supportEmail = getSettingValue($conn, 'email', SITE_CONTACT_DEFAULTS['email']);
        $supportWhatsapp = getSettingValue($conn, 'whatsapp', SITE_CONTACT_DEFAULTS['whatsapp'] ?: $supportPhone);

        $rm = lookupRmForReferralCode($conn, $referralCode);
        $rmPayload = null;
        if ($rm) {
            $rmPhone = normalizeIndianPhone((string) ($rm['phone'] ?? ''));
            $rmPayload = [
                'name' => $rm['name'],
                'email' => $rm['email'],
                'phone' => $rmPhone,
                'employeeId' => strtoupper(trim((string) ($rm['employee_id'] ?? ''))),
            ];
        }

        sendResponse([
            'success' => true,
            'support' => [
                'phone' => normalizeIndianPhone($supportPhone),
                'email' => $supportEmail,
                'whatsapp' => normalizeIndianPhone($supportWhatsapp ?: $supportPhone),
            ],
            'relationManager' => $rmPayload,
            'referralCode' => $referralCode,
        ]);
        break;

    case 'deleteMyAccount':
        requireAuth();
        $data = getPostData();
        $userId = $_SESSION['user_id'] ?? '';
        $stmt = $conn->prepare('SELECT email FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('s', $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            http_response_code(404);
            sendResponse(['error' => 'Account not found']);
            break;
        }
        $email = strtolower(trim((string) $row['email']));

        $verifiedAt = $_SESSION['otp_verified'][$email] ?? null;
        if (!$verifiedAt || (time() - $verifiedAt) > 900) {
            http_response_code(403);
            sendResponse(['error' => 'Email verification required. Confirm OTP before deleting your account.']);
            break;
        }

        $confirm = strtolower(trim((string) ($data['confirm'] ?? '')));
        if ($confirm !== 'delete') {
            http_response_code(400);
            sendResponse(['error' => 'Type DELETE to confirm account removal']);
            break;
        }

        $del = $conn->prepare('DELETE FROM users WHERE id = ?');
        $del->bind_param('s', $userId);
        $del->execute();
        unset($_SESSION['otp_verified'][$email], $_SESSION['user_id']);
        logAudit($conn, 'User Self Delete', $userId, ['email' => $email]);
        session_destroy();
        sendResponse(['success' => true, 'message' => 'Your account has been deleted']);
        break;

    // -----------------------------------------
    // ORDERS
    // -----------------------------------------
    case 'getOrders':
        requireAuth();
        // If user is not admin, only return their own orders
        if (isset($_SESSION['admin_id'])) {
            requireAnyPermission(['dashboard', 'pending', 'initiated', 'orders', 'manual-order', 'cancel-refund']);
            if (isMasterAdminSession() || adminCan('view-all-orders')) {
                $stmt = $conn->prepare("SELECT * FROM orders ORDER BY created_at DESC");
            } else {
                // Employee: only their referral / tagged orders (including Verify Payments)
                $code = currentEmployeeCode($conn);
                $adminUser = 'admin:' . $_SESSION['admin_id'];
                $stmt = $conn->prepare(
                    "SELECT o.* FROM orders o
                     LEFT JOIN users u ON u.id = o.user_id AND o.user_id NOT LIKE 'admin:%'
                     WHERE UPPER(o.employee_code) = ?
                        OR UPPER(u.referral_code) = ?
                        OR o.user_id = ?
                     ORDER BY o.created_at DESC"
                );
                $stmt->bind_param('sss', $code, $code, $adminUser);
            }
        } else {
            // Buyer: linked user_id OR matching email/phone (manual orders often match by contact)
            $uid = (string) $_SESSION['user_id'];
            $uStmt = $conn->prepare('SELECT email, phone FROM users WHERE id = ? LIMIT 1');
            $uStmt->bind_param('s', $uid);
            $uStmt->execute();
            $uRow = $uStmt->get_result()->fetch_assoc() ?: [];
            $email = strtolower(trim((string) ($uRow['email'] ?? '')));
            $phone10 = preg_replace('/\D/', '', (string) ($uRow['phone'] ?? ''));
            if (strlen($phone10) > 10) {
                $phone10 = substr($phone10, -10);
            }
            $stmt = $conn->prepare(
                "SELECT * FROM orders
                 WHERE deleted_at IS NULL
                   AND (
                     user_id = ?
                     OR (? <> '' AND LOWER(buyer_email) = ?)
                     OR (? <> '' AND RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(buyer_phone,''), ' ', ''), '-', ''), '+', ''), 10) = ?)
                   )
                 ORDER BY created_at DESC"
            );
            $stmt->bind_param('sssss', $uid, $email, $email, $phone10, $phone10);
        }
        if (!$stmt) {
            error_log('getOrders prepare failed: ' . $conn->error);
            http_response_code(500);
            sendResponse(['error' => 'Could not load orders']);
            break;
        }
        if (!$stmt->execute()) {
            error_log('getOrders execute failed: ' . $stmt->error);
            http_response_code(500);
            sendResponse(['error' => 'Could not load orders']);
            break;
        }
        $res = $stmt->get_result();
        
        $data = [];
        while($row = $res->fetch_assoc()) {
            // Buyers never see soft-deleted; admins get deletedAt for Undo UI
            if (!isset($_SESSION['admin_id']) && !empty($row['deleted_at'])) {
                continue;
            }
            // Auto-heal: if buyer order is still tagged admin:/blank, attach to this account
            if (!isset($_SESSION['admin_id']) && isset($uid)) {
                $rowUid = (string) ($row['user_id'] ?? '');
                if ($rowUid === '' || str_starts_with($rowUid, 'admin:')) {
                    $oid = (string) $row['order_id'];
                    $heal = $conn->prepare('UPDATE orders SET user_id = ? WHERE order_id = ? AND (user_id IS NULL OR user_id = \'\' OR user_id LIKE \'admin:%\') AND deleted_at IS NULL');
                    if ($heal) {
                        $heal->bind_param('ss', $uid, $oid);
                        $heal->execute();
                    }
                    $row['user_id'] = $uid;
                }
            }
            $employeeCode = strtoupper(trim((string) ($row['employee_code'] ?? '')));
            $employeeCode = canonicalizeEmployeeUserCode($employeeCode);
            // Blank / GU00 on order → recover from buyer's signup referral (GUE003 etc.)
            if (!isRealEmployeeUserCode($employeeCode)) {
                try {
                    $recovered = resolveBuyerEmployeeCode(
                        $conn,
                        (string) ($row['user_id'] ?? ''),
                        (string) ($row['buyer_phone'] ?? ''),
                        (string) ($row['buyer_email'] ?? '')
                    );
                    if (isRealEmployeeUserCode($recovered)) {
                        $employeeCode = $recovered;
                    }
                } catch (Throwable $e) {
                    // never fail the whole orders list for one row
                }
            }
            $employeeCode = normalizeUserCode($employeeCode);
            // BUG 3 FIX: Return ALL fields the frontend expects (cast nulls — PHP 8.1+ htmlspecialchars)
            $data[] = [
                "orderId" => htmlspecialchars((string) ($row['order_id'] ?? '')),
                "buyerName" => htmlspecialchars((string) ($row['buyer_name'] ?? '')),
                "buyerEmail" => htmlspecialchars((string) ($row['buyer_email'] ?? '')),
                "buyerPhone" => htmlspecialchars((string) ($row['buyer_phone'] ?? '')),
                "shareId" => htmlspecialchars((string) ($row['share_id'] ?? '')),
                "companyName" => htmlspecialchars((string) ($row['share_name'] ?? '')),
                "shareName" => htmlspecialchars((string) ($row['share_name'] ?? '')),
                "shareTicker" => htmlspecialchars((string) ($row['share_ticker'] ?? '')),
                "sector" => htmlspecialchars((string) ($row['share_ticker'] ?? '')),
                "logoInitials" => strtoupper(substr((string) ($row['share_name'] ?? ''), 0, 2)),
                "logoGradient" => "linear-gradient(135deg, #333, #555)",
                "pricePerShare" => (float)$row['price_per_share'],
                "qty" => (int)$row['quantity'],
                "totalPaid" => (float)$row['total_amount'],
                "total" => (float)$row['total_amount'],
                "status" => htmlspecialchars((string) ($row['status'] ?? '')),
                "method" => htmlspecialchars((string) ($row['method'] ?? '')),
                "paymentMethod" => htmlspecialchars((string) ($row['method'] ?? '')),
                "transactionId" => htmlspecialchars((string) ($row['transaction_id'] ?? '')),
                "utr" => htmlspecialchars((string) ($row['transaction_id'] ?? '')),
                "orderSource" => htmlspecialchars((string) ($row['order_source'] ?? 'Online')),
                "employeeCode" => htmlspecialchars((string) $employeeCode),
                "opsNote" => htmlspecialchars((string) ($row['ops_note'] ?? '')),
                "date" => orderRowDate($row),
                "createdAt" => orderRowDate($row),
                "userId" => htmlspecialchars((string) ($row['user_id'] ?? '')),
                "deletedAt" => !empty($row['deleted_at']) ? (string) $row['deleted_at'] : null,
            ];
        }
        sendResponse($data);
        break;

    case 'transferOrder':
        requireMasterAdmin(); // Only Master Admin may reassign orders between employees
        $data = getPostData();
        $order_id = strtoupper(trim($data['orderId'] ?? ''));
        $employee_code = strtoupper(trim($data['employeeCode'] ?? $data['assignEmployeeCode'] ?? ''));
        if ($order_id === '' || !isValidOrderId($order_id)) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid order ID']);
            break;
        }
        if ($employee_code === '') {
            http_response_code(400);
            sendResponse(['error' => 'Employee code is required']);
            break;
        }
        if (!employeeCodeExists($conn, $employee_code)) {
            http_response_code(400);
            sendResponse(['error' => "Employee code $employee_code does not exist"]);
            break;
        }
        $stmtCheck = $conn->prepare('SELECT order_id, employee_code, status FROM orders WHERE order_id = ? LIMIT 1');
        $stmtCheck->bind_param('s', $order_id);
        $stmtCheck->execute();
        $orderRow = $stmtCheck->get_result()->fetch_assoc();
        if (!$orderRow) {
            http_response_code(404);
            sendResponse(['error' => 'Order not found']);
            break;
        }
        $employee_code = sanitizeStoredUserCode($employee_code);
        $upd = $conn->prepare('UPDATE orders SET employee_code = ? WHERE order_id = ?');
        $upd->bind_param('ss', $employee_code, $order_id);
        if (!$upd->execute()) {
            http_response_code(500);
            sendResponse(['error' => 'Could not transfer order']);
            break;
        }
        logAudit($conn, 'Transfer Order', $_SESSION['admin_id'], [
            'orderId' => $order_id,
            'from' => $orderRow['employee_code'] ?? '',
            'to' => $employee_code,
        ]);
        sendResponse([
            'success' => true,
            'orderId' => $order_id,
            'employeeCode' => normalizeUserCode($employee_code),
        ]);
        break;

    case 'adminDeleteOrder':
        // Soft-delete — master admin only (employees never see delete)
        requireMasterAdmin();
        $data = getPostData();
        $order_id = strtoupper(trim((string) ($data['orderId'] ?? $data['order_id'] ?? '')));
        if ($order_id === '' || !isValidOrderId($order_id)) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid order ID']);
            break;
        }
        $stmtCheck = $conn->prepare('SELECT order_id, buyer_name, share_name, total_amount, status, user_id, employee_code, deleted_at FROM orders WHERE order_id = ? LIMIT 1');
        $stmtCheck->bind_param('s', $order_id);
        $stmtCheck->execute();
        $orderRow = $stmtCheck->get_result()->fetch_assoc();
        if (!$orderRow) {
            http_response_code(404);
            sendResponse(['error' => 'Order not found']);
            break;
        }
        if (!orderBelongsToEmployee($conn, $orderRow)) {
            http_response_code(403);
            sendResponse(['error' => 'You can only delete orders assigned to your employee code']);
            break;
        }
        if (!empty($orderRow['deleted_at'])) {
            sendResponse(['success' => true, 'orderId' => $order_id, 'alreadyDeleted' => true]);
            break;
        }
        $upd = $conn->prepare('UPDATE orders SET deleted_at = NOW() WHERE order_id = ? AND deleted_at IS NULL');
        $upd->bind_param('s', $order_id);
        if (!$upd->execute() || $upd->affected_rows < 1) {
            http_response_code(500);
            sendResponse(['error' => 'Could not delete order']);
            break;
        }
        logAudit($conn, 'Soft Delete Order', $_SESSION['admin_id'], [
            'orderId' => $order_id,
            'buyerName' => $orderRow['buyer_name'] ?? '',
            'shareName' => $orderRow['share_name'] ?? '',
            'totalAmount' => $orderRow['total_amount'] ?? '',
            'status' => $orderRow['status'] ?? '',
        ]);
        sendResponse([
            'success' => true,
            'orderId' => $order_id,
            'deleted' => true,
            'soft' => true,
        ]);
        break;

    case 'adminRestoreOrder':
        requireMasterAdmin();
        $data = getPostData();
        $order_id = strtoupper(trim((string) ($data['orderId'] ?? $data['order_id'] ?? '')));
        if ($order_id === '' || !isValidOrderId($order_id)) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid order ID']);
            break;
        }
        $stmtCheck = $conn->prepare('SELECT order_id, buyer_name, share_name, status, user_id, employee_code, deleted_at FROM orders WHERE order_id = ? LIMIT 1');
        $stmtCheck->bind_param('s', $order_id);
        $stmtCheck->execute();
        $orderRow = $stmtCheck->get_result()->fetch_assoc();
        if (!$orderRow) {
            http_response_code(404);
            sendResponse(['error' => 'Order not found']);
            break;
        }
        if (!orderBelongsToEmployee($conn, $orderRow)) {
            http_response_code(403);
            sendResponse(['error' => 'You can only restore orders assigned to your employee code']);
            break;
        }
        if (empty($orderRow['deleted_at'])) {
            sendResponse(['success' => true, 'orderId' => $order_id, 'alreadyActive' => true]);
            break;
        }
        $upd = $conn->prepare('UPDATE orders SET deleted_at = NULL WHERE order_id = ?');
        $upd->bind_param('s', $order_id);
        if (!$upd->execute()) {
            http_response_code(500);
            sendResponse(['error' => 'Could not restore order']);
            break;
        }
        logAudit($conn, 'Restore Order', $_SESSION['admin_id'], [
            'orderId' => $order_id,
            'buyerName' => $orderRow['buyer_name'] ?? '',
            'status' => $orderRow['status'] ?? '',
        ]);
        sendResponse([
            'success' => true,
            'orderId' => $order_id,
            'restored' => true,
        ]);
        break;

    case 'adminAdjustOrderTotal':
        // Master admin: correct recorded paid amount (e.g. buyer paid fee shown at checkout)
        requireMasterAdmin();
        $data = getPostData();
        $order_id = strtoupper(trim((string) ($data['orderId'] ?? $data['order_id'] ?? '')));
        $new_total = round((float) ($data['totalAmount'] ?? $data['totalPaid'] ?? 0), 2);
        $note = trim((string) ($data['opsNote'] ?? $data['note'] ?? ''));
        if ($order_id === '' || !isValidOrderId($order_id)) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid order ID']);
            break;
        }
        if ($new_total < 1 || $new_total > 100000000) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid total amount']);
            break;
        }
        $stmtCheck = $conn->prepare('SELECT order_id, total_amount, quantity, price_per_share, status, ops_note FROM orders WHERE order_id = ? LIMIT 1');
        $stmtCheck->bind_param('s', $order_id);
        $stmtCheck->execute();
        $orderRow = $stmtCheck->get_result()->fetch_assoc();
        if (!$orderRow) {
            http_response_code(404);
            sendResponse(['error' => 'Order not found']);
            break;
        }
        $old_total = (float) $orderRow['total_amount'];
        $share_value = round(((float) $orderRow['price_per_share']) * ((int) $orderRow['quantity']), 2);
        $fee = round($new_total - $share_value, 2);
        $charges_json = null;
        if (abs($fee) >= 0.01) {
            $charges_json = json_encode([[
                'name' => 'Extra / platform fee (paid)',
                'type' => 'flat',
                'value' => $fee,
                'amount' => $fee,
            ]]);
        }
        $ops = trim((string) ($orderRow['ops_note'] ?? ''));
        $autoNote = "Amount corrected {$old_total} → {$new_total}";
        if ($note !== '') {
            $autoNote .= ' — ' . $note;
        }
        $ops = $ops === '' ? $autoNote : ($ops . "\n" . $autoNote);

        $upd = $conn->prepare('UPDATE orders SET total_amount = ?, custom_charges_json = ?, ops_note = ? WHERE order_id = ?');
        $upd->bind_param('dsss', $new_total, $charges_json, $ops, $order_id);
        if (!$upd->execute()) {
            http_response_code(500);
            sendResponse(['error' => 'Failed to update order total']);
            break;
        }
        // Keep invoice in sync if one already exists
        $invUpd = $conn->prepare('UPDATE invoices SET total_amount = ?, platform_fee = ?, custom_charges_json = ? WHERE order_id = ?');
        $platform_fee = max(0.0, $fee);
        $invUpd->bind_param('ddss', $new_total, $platform_fee, $charges_json, $order_id);
        $invUpd->execute();

        logAudit($conn, 'Adjust Order Total', $_SESSION['admin_id'], [
            'orderId' => $order_id,
            'from' => $old_total,
            'to' => $new_total,
        ]);
        sendResponse([
            'success' => true,
            'orderId' => $order_id,
            'totalPaid' => $new_total,
            'previousTotal' => $old_total,
        ]);
        break;

    case 'saveOrder':
        $data = getPostData();
        $order_id = strtoupper(trim($data['orderId'] ?? ''));
        $isAdmin = isset($_SESSION['admin_id']);
        $isUser = isset($_SESSION['user_id']);

        $existingOrder = null;
        if ($order_id !== '') {
            if (!isValidOrderId($order_id)) {
                http_response_code(400);
                sendResponse(["error" => "Invalid Order ID format"]);
                break;
            }
            $stmtCheck = $conn->prepare("SELECT order_id, transaction_id, status, user_id, employee_code, deleted_at FROM orders WHERE order_id=?");
            $stmtCheck->bind_param("s", $order_id);
            $stmtCheck->execute();
            $existingOrder = $stmtCheck->get_result()->fetch_assoc();
        }

        // Full update for manual orders by admin
        $fullUpdate = !empty($data['_fullUpdate']) && $isAdmin;

        if ($existingOrder && $fullUpdate) {
            if (!empty($existingOrder['deleted_at'])) {
                http_response_code(400);
                sendResponse(['error' => 'Restore this order (Undo delete) before editing']);
                break;
            }
            if (!orderBelongsToEmployee($conn, $existingOrder)) {
                http_response_code(403);
                sendResponse(['error' => 'You can only update orders assigned to your employee code']);
                break;
            }
        }

        if ($existingOrder && !$fullUpdate) {
            if (!empty($existingOrder['deleted_at'])) {
                http_response_code(400);
                sendResponse(['error' => 'This order was deleted. Use Undo to restore it first.']);
                break;
            }
            if ($isAdmin && !orderBelongsToEmployee($conn, $existingOrder)) {
                http_response_code(403);
                sendResponse(["error" => "You can only update orders assigned to your employee code"]);
                break;
            }
            $status = trim($data['status'] ?? $existingOrder['status']);
            requireOrderStatusChange($status);
            $ops_note = trim($data['opsNote'] ?? $data['ops_note'] ?? '');
            $transaction_id = trim($data['transactionId'] ?? '');
            // Keep existing UTR unless admin explicitly sends a new one
            if ($transaction_id === '') {
                $transaction_id = $existingOrder['transaction_id'] ?? '';
            }

            if ($ops_note !== '') {
                $stmt = $conn->prepare("UPDATE orders SET status=?, transaction_id=?, ops_note=? WHERE order_id=?");
                $stmt->bind_param("ssss", $status, $transaction_id, $ops_note, $order_id);
            } else {
                $stmt = $conn->prepare("UPDATE orders SET status=?, transaction_id=? WHERE order_id=?");
                $stmt->bind_param("sss", $status, $transaction_id, $order_id);
            }
            if (!$stmt->execute()) {
                http_response_code(500);
                sendResponse(["error" => "Failed to update order"]);
                break;
            }
            logAudit($conn, 'Update Order', $_SESSION['admin_id'], [
                'orderId' => $order_id,
                'status' => $status,
                'utr' => $transaction_id,
            ]);
            if (orderStatusIsPaid($status)) {
                createInvoiceFromOrder($conn, $order_id);

                // Decrement inventory once when payment first becomes accepted
                $wasAlreadyPaid = orderStatusIsPaid((string) ($existingOrder['status'] ?? ''));
                if (!$wasAlreadyPaid) {
                    $ord = $conn->prepare('SELECT share_id, quantity FROM orders WHERE order_id = ? LIMIT 1');
                    $ord->bind_param('s', $order_id);
                    $ord->execute();
                    if ($ordRow = $ord->get_result()->fetch_assoc()) {
                        $dec = $conn->prepare('UPDATE shares SET qty_on_hand = GREATEST(0, qty_on_hand - ?) WHERE share_id = ?');
                        $dec->bind_param('is', $ordRow['quantity'], $ordRow['share_id']);
                        $dec->execute();
                    }
                }
            }
            sendResponse([
                "success" => true,
                "orderId" => $order_id,
                "transactionId" => $transaction_id,
                "status" => $status,
            ]);
            break;
        }

        // New order from checkout (user or guest)
        $buyer_name = trim($data['buyerName'] ?? '');
        $buyer_email = strtolower(trim($data['buyerEmail'] ?? ''));
        $buyer_phone = preg_replace('/\D/', '', $data['buyerPhone'] ?? '');
        if (strlen($buyer_phone) > 10) {
            $buyer_phone = substr($buyer_phone, -10);
        }
        $share_id = trim($data['shareId'] ?? '');
        $share_name = trim($data['companyName'] ?? $data['shareName'] ?? '');
        $share_ticker = trim($data['shareTicker'] ?? '');
        $price_per_share = (float) ($data['pricePerShare'] ?? 0);
        $quantity = (int) ($data['qty'] ?? 0);
        $method = trim($data['method'] ?? $data['paymentMethod'] ?? 'Online');
        $order_source = trim($data['orderSource'] ?? $data['source'] ?? 'Online');
        $transaction_id = strtoupper(preg_replace('/\s+/', '', trim($data['transactionId'] ?? $data['utr'] ?? '')));
        // Offline/manual = phone/WhatsApp deals — need payment verify. Online checkout = self-confirm pay → share transfer queue.
        $isManualAdmin = $isAdmin && !$isUser && (
            strcasecmp($order_source, 'Offline') === 0
            || strcasecmp($order_source, 'Manual') === 0
        );
        if ($isManualAdmin) {
            // Manual / Offline: payment already taken offline — skip Verify queue, go to share transfer
            if (!empty($fullUpdate) && $existingOrder) {
                $status = trim((string) ($existingOrder['status'] ?? 'Transfer Pending'));
            } else {
                $status = 'Transfer Pending';
            }
        } else {
            // Online checkout: pay + UTR → Share Transfer queue (All Orders). Admin saves ref → Complete.
            $status = 'Transfer Pending';
            $paymentConfirmed = $data['paymentConfirmed'] ?? false;
            $confirmedOk = $paymentConfirmed === true
                || $paymentConfirmed === 1
                || $paymentConfirmed === '1'
                || $paymentConfirmed === 'true';
            if (!$confirmedOk) {
                http_response_code(400);
                sendResponse(['error' => 'Please confirm that you have completed the payment']);
                break;
            }
            if ($transaction_id === '' || strlen($transaction_id) < 6 || strlen($transaction_id) > 30) {
                http_response_code(400);
                sendResponse(['error' => 'Enter your UTR / UPI reference from the payment app (6–30 characters)']);
                break;
            }
        }

        if ($buyer_name === '' || strcasecmp($buyer_name, 'Guest') === 0) {
            $buyer_name = $buyer_email !== '' ? explode('@', $buyer_email)[0] : ($buyer_phone !== '' ? 'Buyer ' . substr($buyer_phone, -4) : 'Buyer');
        }
        if ($buyer_email === '' && $buyer_phone === '') {
            http_response_code(400);
            sendResponse(["error" => "Email or phone is required so we can contact you"]);
            break;
        }
        if ($buyer_email !== '' && !isValidEmail($buyer_email)) {
            http_response_code(400);
            sendResponse(["error" => "Invalid email address"]);
            break;
        }
        if ($share_id === '' || $share_name === '' || $quantity < 1) {
            http_response_code(400);
            sendResponse(["error" => "Invalid share or quantity"]);
            break;
        }
        if ($transaction_id !== '' && (strlen($transaction_id) < 6 || strlen($transaction_id) > 30)) {
            http_response_code(400);
            sendResponse(["error" => "Payment reference must be 6–30 characters"]);
            break;
        }

        // Server-side price from catalog when available (online checkout — manual keeps entered price)
        $priceStmt = $conn->prepare("SELECT base_price, name, ticker, min_qty, discount_tiers FROM shares WHERE share_id = ? AND is_active = 1");
        $priceStmt->bind_param("s", $share_id);
        $priceStmt->execute();
        $priceRow = $priceStmt->get_result()->fetch_assoc();
        if ($priceRow) {
            if (!$isManualAdmin) {
                $price_per_share = (float) $priceRow['base_price'];
                $tiersJson = $priceRow['discount_tiers'] ?? '[]';
                if (!empty($tiersJson)) {
                    $tiers = json_decode($tiersJson, true);
                    if (is_array($tiers) && !empty($tiers)) {
                        usort($tiers, function ($a, $b) {
                            return (int)($b['minQty'] ?? 0) - (int)($a['minQty'] ?? 0);
                        });
                        foreach ($tiers as $tier) {
                            if ($quantity >= (int)($tier['minQty'] ?? 0)) {
                                $price_per_share = (float)($tier['price'] ?? $price_per_share);
                                break;
                            }
                        }
                    }
                }
            }
            if ($share_name === '') {
                $share_name = $priceRow['name'];
            }
            if ($share_ticker === '') {
                $share_ticker = $priceRow['ticker'];
            }
            $minQty = (int) ($priceRow['min_qty'] ?? 1);
            if ($quantity < $minQty) {
                http_response_code(400);
                sendResponse(["error" => "Minimum quantity is $minQty shares"]);
                break;
            }
        } elseif ($price_per_share <= 0) {
            http_response_code(400);
            sendResponse(["error" => "Share price unavailable"]);
            break;
        }

        // Block duplicate payment reference (UTR) — ignore soft-deleted orders
        if ($transaction_id !== '') {
            $dupUtr = $conn->prepare("SELECT order_id FROM orders WHERE transaction_id = ? AND deleted_at IS NULL LIMIT 1");
            $dupUtr->bind_param("s", $transaction_id);
            $dupUtr->execute();
            if ($dupUtr->get_result()->num_rows > 0) {
                http_response_code(409);
                sendResponse(["error" => "This payment reference is already registered. Contact support if you need help."]);
                break;
            }
        }

        // Online security: login + KYC already required below; also rate-limit spam "I've paid" claims
        if (!$isManualAdmin && $isUser) {
            $uid = (string) $_SESSION['user_id'];
            $hourStmt = $conn->prepare(
                "SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)"
            );
            $hourStmt->bind_param('s', $uid);
            $hourStmt->execute();
            $hourCount = (int) (($hourStmt->get_result()->fetch_assoc()['c'] ?? 0));
            if ($hourCount >= 5) {
                http_response_code(429);
                sendResponse(['error' => 'Too many orders in a short time. Please wait and try again, or contact support.']);
                break;
            }
            $recentStmt = $conn->prepare(
                "SELECT order_id FROM orders
                 WHERE user_id = ? AND share_id = ?
                   AND deleted_at IS NULL
                   AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                   AND status NOT LIKE '%Cancel%'
                   AND status NOT LIKE '%Reject%'
                   AND status NOT LIKE '%Refund%'
                 LIMIT 1"
            );
            $recentStmt->bind_param('ss', $uid, $share_id);
            $recentStmt->execute();
            if ($recentStmt->get_result()->num_rows > 0) {
                http_response_code(409);
                sendResponse(['error' => 'You already placed an order for this share just now. Check Portfolio, or wait a few minutes.']);
                break;
            }
        }

        $subtotal = $price_per_share * $quantity;
        $chargeTotals = computeOrderChargeTotals($subtotal, $conn);
        $total_amount = $chargeTotals['total'];
        $custom_charges_json = $chargeTotals['custom_charges_json'];
        if ($custom_charges_json === null) {
            $custom_charges_json = '';
        }

        // Online checkout requires a logged-in user and KYC verification
        if ($isUser) {
            $user_id = $_SESSION['user_id'];
            $kycStmt = $conn->prepare("SELECT kyc_status FROM users WHERE id = ? LIMIT 1");
            $kycStmt->bind_param("s", $user_id);
            $kycStmt->execute();
            $kycRow = $kycStmt->get_result()->fetch_assoc();
            if (!$kycRow || strcasecmp(trim((string)$kycRow['kyc_status']), 'Verified') !== 0) {
                http_response_code(403);
                sendResponse(["error" => "KYC Verification is required to place an order"]);
                break;
            }
        } elseif ($isAdmin) {
            requirePermission('manual-order');
            $linkedUserId = trim((string) ($data['userId'] ?? $data['linkedUserId'] ?? ''));
            $user_id = 'admin:' . $_SESSION['admin_id'];
            if ($linkedUserId !== '' && !str_starts_with($linkedUserId, 'admin:')) {
                $uStmt = $conn->prepare('SELECT id, name, phone, email, referral_code FROM users WHERE id = ? LIMIT 1');
                $uStmt->bind_param('s', $linkedUserId);
                $uStmt->execute();
                $linkedUser = $uStmt->get_result()->fetch_assoc();
                if (!$linkedUser) {
                    http_response_code(400);
                    sendResponse(['error' => 'Selected signup user not found']);
                    break;
                }
                if (!isMasterAdminSession() && !adminCan('view-all-kyc')) {
                    $code = currentEmployeeCode($conn);
                    $ref = strtoupper(trim((string) ($linkedUser['referral_code'] ?? '')));
                    if ($code === '' || $ref !== $code) {
                        http_response_code(403);
                        sendResponse(['error' => 'You can only create manual orders for users signed up with your employee code']);
                        break;
                    }
                }
                $user_id = (string) $linkedUser['id'];
                // Prefer profile name/phone/email when admin selected a signup user
                if ($buyer_name === '' || strcasecmp($buyer_name, 'Guest') === 0) {
                    $buyer_name = trim((string) ($linkedUser['name'] ?? $buyer_name));
                }
                if ($buyer_phone === '') {
                    $buyer_phone = preg_replace('/\D/', '', (string) ($linkedUser['phone'] ?? ''));
                    if (strlen($buyer_phone) > 10) {
                        $buyer_phone = substr($buyer_phone, -10);
                    }
                }
                if ($buyer_email === '' && !empty($linkedUser['email'])) {
                    $buyer_email = strtolower(trim((string) $linkedUser['email']));
                }
            }
            // Auto-link signup user by phone/email so manual orders always appear in client portfolio
            if (str_starts_with($user_id, 'admin:') && ($buyer_phone !== '' || $buyer_email !== '')) {
                $phone10 = preg_replace('/\D/', '', $buyer_phone);
                if (strlen($phone10) > 10) {
                    $phone10 = substr($phone10, -10);
                }
                $emailLower = strtolower(trim($buyer_email));
                $autoStmt = $conn->prepare(
                    "SELECT id, name, phone, email, referral_code FROM users
                     WHERE (? <> '' AND RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(phone,''), ' ', ''), '-', ''), '+', ''), 10) = ?)
                        OR (? <> '' AND LOWER(email) = ?)
                     ORDER BY created_at DESC LIMIT 1"
                );
                $autoStmt->bind_param('ssss', $phone10, $phone10, $emailLower, $emailLower);
                $autoStmt->execute();
                $autoUser = $autoStmt->get_result()->fetch_assoc();
                if ($autoUser) {
                    // Always link for portfolio — employee scope enforced on explicit user pick above
                    $user_id = (string) $autoUser['id'];
                    if ($buyer_email === '' && !empty($autoUser['email'])) {
                        $buyer_email = strtolower(trim((string) $autoUser['email']));
                    }
                    if ($buyer_name === '' || strcasecmp($buyer_name, 'Guest') === 0) {
                        $buyer_name = trim((string) ($autoUser['name'] ?? $buyer_name));
                    }
                }
            }
        } else {
            http_response_code(401);
            sendResponse(["error" => "Login or sign up is required to place an order"]);
            break;
        }

        $buyer_name = htmlspecialchars($buyer_name);
        $buyer_email = htmlspecialchars($buyer_email);
        $buyer_phone = htmlspecialchars($buyer_phone);
        $share_id = htmlspecialchars($share_id);
        $share_name = htmlspecialchars($share_name);
        $share_ticker = htmlspecialchars($share_ticker);
        $method = htmlspecialchars($method);
        $transaction_id = htmlspecialchars($transaction_id);
        $order_source = htmlspecialchars($order_source);

        $assignedCode = strtoupper(trim((string) ($data['assignEmployeeCode'] ?? $data['employeeCode'] ?? '')));
        if ($isAdmin && isMasterAdminSession() && $assignedCode !== '' && !employeeCodeExists($conn, $assignedCode)) {
            http_response_code(400);
            sendResponse(['error' => "Invalid employee code: $assignedCode"]);
            break;
        }

        $employee_code = resolveOrderEmployeeCode(
            $conn,
            $data,
            $existingOrder,
            $isAdmin,
            $isUser,
            $user_id ?? '',
            $buyer_phone,
            $buyer_email
        );
        // Final safety: if still blank/GU00, pull from linked buyer (post auto-link)
        if (!isRealEmployeeUserCode($employee_code)) {
            $fallback = resolveBuyerEmployeeCode($conn, $user_id ?? '', $buyer_phone, $buyer_email);
            if (isRealEmployeeUserCode($fallback)) {
                $employee_code = $fallback;
            }
        }
        // Staff creating order: never allow blank — force their code again
        if ($isAdmin && !isMasterAdminSession() && !isRealEmployeeUserCode($employee_code)) {
            $employee_code = sanitizeStoredUserCode(currentEmployeeCode($conn));
        }

        if ($order_id === '') {
            $order_id = allocateNextOrderId($conn);
        }

        // Lock purchase time in IST at buy moment (not MySQL server TZ quirks)
        $purchasedAt = date('Y-m-d H:i:s');
        // Manual / admin: allow backdated order date from form (YYYY-MM-DD)
        if ($isAdmin) {
            $orderDateRaw = trim((string) ($data['orderDate'] ?? $data['purchasedAt'] ?? $data['date'] ?? ''));
            if ($orderDateRaw !== '' && preg_match('/^(\d{4}-\d{2}-\d{2})/', $orderDateRaw, $dm)) {
                $purchasedAt = $dm[1] . ' ' . date('H:i:s');
            }
        }

        if (isset($fullUpdate) && $fullUpdate && $existingOrder) {
            $stmt = $conn->prepare(
                "UPDATE orders SET buyer_name=?, buyer_email=?, buyer_phone=?, share_id=?, share_name=?, share_ticker=?, price_per_share=?, quantity=?, total_amount=?, method=?, transaction_id=?, status=?, order_source=?, employee_code=?, custom_charges_json=?, created_at=? WHERE order_id=?"
            );
            if (!$stmt) {
                error_log('saveOrder UPDATE prepare failed: ' . $conn->error);
                http_response_code(500);
                sendResponse(['error' => 'Could not update order. Please try again.']);
                break;
            }
            $stmt->bind_param(
                "ssssssdidssssssss",
                $buyer_name,
                $buyer_email,
                $buyer_phone,
                $share_id,
                $share_name,
                $share_ticker,
                $price_per_share,
                $quantity,
                $total_amount,
                $method,
                $transaction_id,
                $status,
                $order_source,
                $employee_code,
                $custom_charges_json,
                $purchasedAt,
                $order_id
            );
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO orders (order_id, user_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker, price_per_share, quantity, total_amount, method, transaction_id, status, order_source, employee_code, created_at, custom_charges_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            if (!$stmt) {
                error_log('saveOrder INSERT prepare failed: ' . $conn->error);
                http_response_code(500);
                sendResponse(['error' => 'Could not place order. Please try again.']);
                break;
            }
            $stmt->bind_param(
                "ssssssssdidsssssss",
                $order_id,
                $user_id,
                $buyer_name,
                $buyer_email,
                $buyer_phone,
                $share_id,
                $share_name,
                $share_ticker,
                $price_per_share,
                $quantity,
                $total_amount,
                $method,
                $transaction_id,
                $status,
                $order_source,
                $employee_code,
                $purchasedAt,
                $custom_charges_json
            );
        }
        if (!$stmt->execute()) {
            error_log('saveOrder INSERT failed: ' . $stmt->error);
            http_response_code(500);
            sendResponse(["error" => "Could not place order. Please try again."]);
            break;
        }

        if (orderStatusIsPaid($status)) {
            try {
                createInvoiceFromOrder($conn, $order_id);
            } catch (Throwable $e) {
                error_log('saveOrder invoice failed for ' . $order_id . ': ' . $e->getMessage());
            }
            $dec = $conn->prepare('UPDATE shares SET qty_on_hand = GREATEST(0, qty_on_hand - ?) WHERE share_id = ?');
            if ($dec) {
                $dec->bind_param('is', $quantity, $share_id);
                $dec->execute();
            }
        }

        sendResponse([
            "success" => true,
            "orderId" => $order_id,
            "transactionId" => $transaction_id,
            "status" => $status,
            "totalPaid" => $total_amount,
        ]);
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
        $employee_code = '';
        if (!empty($_SESSION['user_id'])) {
            $employee_code = lookupEmployeeCodeForUser($conn, (string) $_SESSION['user_id']);
        } elseif (!empty($_SESSION['admin_id']) && !isMasterAdminSession()) {
            $employee_code = currentEmployeeCode($conn);
        } else {
            $ref = strtoupper(trim((string) ($data['referralCode'] ?? $data['employeeCode'] ?? '')));
            if ($ref !== '') {
                $employee_code = $ref;
            }
        }
        $employee_code = sanitizeStoredUserCode($employee_code);
        $stmt = $conn->prepare("INSERT INTO initiated_checkouts (session_id, share_id, share_name, share_ticker, buyer_name, buyer_email, buyer_phone, qty, price_per_share, total_amount, payment_mode, status, employee_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Initiated', ?) ON DUPLICATE KEY UPDATE share_id=VALUES(share_id), share_name=VALUES(share_name), qty=VALUES(qty), price_per_share=VALUES(price_per_share), total_amount=VALUES(total_amount), payment_mode=VALUES(payment_mode), employee_code=IF(employee_code IS NULL OR employee_code = '', VALUES(employee_code), employee_code)");
        $stmt->bind_param("sssssssiddss", $session_id, $share_id, $share_name, $share_ticker, $buyer_name, $buyer_email, $buyer_phone, $qty, $price, $total, $mode, $employee_code);
        $stmt->execute();
        sendResponse(["success" => true]);
        break;

    case 'getInitiatedCheckouts':
        requirePermission('initiated');
        if (isMasterAdminSession() || adminCan('view-all-orders')) {
            $res = $conn->query(
                "SELECT session_id, share_id, share_name, share_ticker, buyer_name, buyer_email, buyer_phone,
                        qty, price_per_share, total_amount, payment_mode, status, employee_code, created_at
                 FROM initiated_checkouts WHERE status = 'Initiated' ORDER BY created_at DESC"
            );
        } else {
            $code = currentEmployeeCode($conn);
            $stmt = $conn->prepare(
                "SELECT session_id, share_id, share_name, share_ticker, buyer_name, buyer_email, buyer_phone,
                        qty, price_per_share, total_amount, payment_mode, status, employee_code, created_at
                 FROM initiated_checkouts WHERE status = 'Initiated' AND UPPER(employee_code) = ? ORDER BY created_at DESC"
            );
            $stmt->bind_param('s', $code);
            $stmt->execute();
            $res = $stmt->get_result();
        }
        $rows = [];
        while ($row = $res->fetch_assoc()) {
            $rows[] = mapInitiatedCheckoutRow($row);
        }
        sendResponse($rows);
        break;

    case 'deleteInitiatedCheckout':
        requirePermission('initiated');
        $data = getPostData();
        $session_id = htmlspecialchars($data['sessionId'] ?? '');
        $chk = $conn->prepare('SELECT * FROM initiated_checkouts WHERE session_id = ? LIMIT 1');
        $chk->bind_param('s', $session_id);
        $chk->execute();
        $initRow = $chk->get_result()->fetch_assoc();
        if (!$initRow) {
            http_response_code(404);
            sendResponse(['error' => 'Initiate checkout not found']);
            break;
        }
        if (!initiatedBelongsToEmployee($conn, $initRow)) {
            http_response_code(403);
            sendResponse(['error' => 'You can only manage initiate checkouts for your employee code']);
            break;
        }
        $stmt = $conn->prepare("DELETE FROM initiated_checkouts WHERE session_id = ?");
        $stmt->bind_param("s", $session_id);
        $stmt->execute();
        sendResponse(["success" => true]);
        break;

    case 'approveInitiatedCheckout':
        requireAnyPermission(['initiated', 'pending', 'manual-order']);
        $data = getPostData();
        $session_id = htmlspecialchars($data['sessionId'] ?? '');
        $stmt = $conn->prepare("SELECT * FROM initiated_checkouts WHERE session_id = ?");
        $stmt->bind_param("s", $session_id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            http_response_code(404);
            sendResponse(["error" => "Initiated checkout not found"]);
            break;
        }
        if (!initiatedBelongsToEmployee($conn, $row)) {
            http_response_code(403);
            sendResponse(['error' => 'You can only approve initiate checkouts for your employee code']);
            break;
        }
        $order_id = strtoupper(trim($data['orderId'] ?? ''));
        if ($order_id === '' || !isValidOrderId($order_id)) {
            $order_id = allocateNextOrderId($conn);
        }
        $user_id = 'admin:' . $_SESSION['admin_id'];
        $method = $row['payment_mode'] ?: 'Offline';
        $status = 'Pending Verification';
        $employee_code = strtoupper(trim((string) ($row['employee_code'] ?? '')));
        if ($employee_code === '' && !isMasterAdminSession()) {
            $employee_code = currentEmployeeCode($conn);
        }

        // Recalculate charges from server-side settings to keep totals + invoice snapshot consistent
        $subtotal = (float) ($row['price_per_share'] ?? 0) * (int) ($row['qty'] ?? 0);
        $chargeTotals = computeOrderChargeTotals($subtotal, $conn);
        $total_amount = $chargeTotals['total'];
        $custom_charges_json = $chargeTotals['custom_charges_json'];
        if ($custom_charges_json === null) {
            $custom_charges_json = '';
        }

        $purchasedAt = date('Y-m-d H:i:s');
        $ins = $conn->prepare("INSERT INTO orders (order_id, user_id, buyer_name, buyer_email, buyer_phone, share_id, share_name, share_ticker, price_per_share, quantity, total_amount, method, status, order_source, employee_code, created_at, custom_charges_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Offline', ?, ?, ?)");
        if (!$ins) {
            error_log('approveInitiatedCheckout prepare failed: ' . $conn->error);
            http_response_code(500);
            sendResponse(['error' => 'Could not create order from initiate']);
            break;
        }
        $ins->bind_param("ssssssssdidsssss", $order_id, $user_id, $row['buyer_name'], $row['buyer_email'], $row['buyer_phone'], $row['share_id'], $row['share_name'], $row['share_ticker'], $row['price_per_share'], $row['qty'], $total_amount, $method, $status, $employee_code, $purchasedAt, $custom_charges_json);
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
        $includeInternal = false;
        if (isset($_SESSION['admin_id']) && refreshAdminSession($conn)) {
            $includeInternal = adminCan('prices') || adminCan('inventory');
        }
        $res = $conn->query("SELECT * FROM shares WHERE is_active = 1 ORDER BY is_featured DESC, is_builtin DESC, name ASC");
        $shares = [];
        while ($row = $res->fetch_assoc()) {
            $shares[] = mapShareRow($row, $includeInternal);
        }
        sendResponse($shares);
        break;

    case 'saveShare':
        requirePermission('prices');
        $data = getPostData();
        $share_id = preg_replace('/[^a-z0-9-]/', '', strtolower($data['id'] ?? $data['shareId'] ?? ''));
        $name = trim($data['name'] ?? '');
        $ticker = strtoupper(trim($data['ticker'] ?? ''));
        $sector = trim($data['sector'] ?? '');
        $base_price = (float) ($data['basePrice'] ?? $data['price'] ?? 0);
        $min_qty = max(1, (int) ($data['minQty'] ?? 1));
        $description = trim($data['description'] ?? '');
        // Use 0 instead of null — mysqli bind_param cannot bind NULL for i/d reliably
        $founded = isset($data['founded']) && $data['founded'] !== '' && $data['founded'] !== null
            ? (int) $data['founded'] : 0;
        $revenue = trim($data['revenue'] ?? '');
        $valuation = trim($data['valuation'] ?? '');
        $growth = trim($data['growth'] ?? '');
        $change_positive = !empty($data['changePositive']) ? 1 : 0;
        $logo_initials = substr(preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($data['logoInitials'] ?? ''))) ?: '', 0, 5);
        $logo_gradient = trim($data['logoGradient'] ?? 'linear-gradient(135deg, #003478, #0050a8)');
        $logo_url = trim($data['logoUrl'] ?? '');
        // Normalize "/uploads/shares/x.png" or "uploads/shares/x.png"
        $logo_url = ltrim($logo_url, '/');
        if ($logo_url !== '' && !preg_match('#^uploads/shares/[a-zA-Z0-9._-]+$#', $logo_url)) {
            $logo_url = '';
        }
        $sector_color = trim($data['sectorColor'] ?? '#7ac142');
        $listing_type = trim($data['listingType'] ?? 'Pre-IPO');
        $ipo_timeline = '';
        $has_buy_price = array_key_exists('buyPrice', $data);
        $buy_price = $has_buy_price && $data['buyPrice'] !== '' && $data['buyPrice'] !== null
            ? (float) $data['buyPrice'] : 0.0;
        $has_listing_price = array_key_exists('listingPrice', $data);
        $listing_price = null;
        if ($has_listing_price && $data['listingPrice'] !== '' && $data['listingPrice'] !== null) {
            $listing_price = (float) $data['listingPrice'];
            if ($listing_price <= 0) {
                $listing_price = null;
            }
        }
        $inventory_status = trim($data['inventoryStatus'] ?? 'In Stock');
        $isin = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim($data['isin'] ?? '')));
        if (strlen($isin) > 20) {
            $isin = substr($isin, 0, 20);
        }
        $risk_notes = '';
        $lock_in_months = 0;
        $is_featured = !empty($data['isFeatured']) ? 1 : 0;
        $is_top10 = !empty($data['isTop10']) ? 1 : 0;
        $discount_tiers = isset($data['discountTiers']) && is_array($data['discountTiers']) 
            ? json_encode($data['discountTiers']) 
            : '[]';
        $highlights = $data['keyHighlights'] ?? [];
        if (is_string($highlights)) {
            $highlights = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $highlights))));
        }
        $key_highlights = json_encode(is_array($highlights) ? $highlights : []);

        // Optional key-data metrics (all optional — empty = N/A on public site)
        $fundamentals = json_encode([
            'week52High' => trim($data['week52High'] ?? ''),
            'week52Low' => trim($data['week52Low'] ?? ''),
            'marketCap' => trim($data['marketCap'] ?? ''),
            'peRatio' => trim($data['peRatio'] ?? ''),
            'pbRatio' => trim($data['pbRatio'] ?? ''),
            'debtEquity' => trim($data['debtEquity'] ?? ''),
            'roe' => trim($data['roe'] ?? ''),
            'bookValue' => trim($data['bookValue'] ?? ''),
            'faceValue' => trim($data['faceValue'] ?? ''),
        ]);

        if (!$share_id && $name) {
            $share_id = 'custom-' . preg_replace('/[^a-z0-9]+/', '-', strtolower($name)) . '-' . substr(uniqid(), -5);
        }

        // Auto initials: "Boat" → "BO", "Tata Capital" → "TC"
        if ($logo_initials === '' && $name !== '') {
            $parts = preg_split('/\s+/', trim($name)) ?: [];
            $parts = array_values(array_filter($parts, function ($p) {
                return $p !== '';
            }));
            if (count($parts) >= 2) {
                $logo_initials = strtoupper(substr($parts[0], 0, 1) . substr($parts[1], 0, 1));
            } else {
                $clean = preg_replace('/[^a-zA-Z0-9]/', '', $name) ?: 'GU';
                $logo_initials = strtoupper(substr($clean, 0, 2));
            }
        }

        if (!$share_id || strlen($name) < 2 || strlen($ticker) < 2 || !$sector || $base_price <= 0) {
            sendResponse(["error" => "Missing or invalid share fields"], 400);
            break;
        }

        // Always rebuild indicative chart from sell price + trend + growth
        $growthFrac = parseGrowthFraction($growth);
        $price_history = json_encode(defaultPriceHistory($base_price, (bool) $change_positive, $growthFrac));
        $chart_labels = json_encode($data['chartLabels'] ?? defaultChartLabels());

        $check = $conn->prepare("SELECT share_id, is_builtin FROM shares WHERE share_id = ?");
        $check->bind_param('s', $share_id);
        $check->execute();
        $existing = $check->get_result()->fetch_assoc();

        // Core row without nullable decimals (buy_price / listing_price set below)
        if ($existing) {
            $stmt = $conn->prepare(
                "UPDATE shares SET name=?, ticker=?, sector=?, sector_color=?, base_price=?, min_qty=?, description=?, founded=?, revenue=?, valuation=?, growth=?, change_positive=?, logo_initials=?, logo_gradient=?, logo_url=?, price_history=?, chart_labels=?, listing_type=?, ipo_timeline=?, inventory_status=?, isin=?, key_highlights=?, risk_notes=?, lock_in_months=?, is_featured=?, is_top10=?, discount_tiers=?, is_active=1 WHERE share_id=?"
            );
            if (!$stmt) {
                sendResponse(['error' => 'Failed to prepare share update'], 500);
                break;
            }
            // ssss d i s i sss i sss ss ss ssss i i i s s => 28 params
            $stmt->bind_param(
                'ssssdisisssisssssssssssiiiss',
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
                $logo_url,
                $price_history,
                $chart_labels,
                $listing_type,
                $ipo_timeline,
                $inventory_status,
                $isin,
                $key_highlights,
                $risk_notes,
                $lock_in_months,
                $is_featured,
                $is_top10,
                $discount_tiers,
                $share_id
            );
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO shares (share_id, name, ticker, sector, sector_color, base_price, min_qty, description, founded, revenue, valuation, growth, change_positive, logo_initials, logo_gradient, logo_url, price_history, chart_labels, listing_type, ipo_timeline, inventory_status, isin, key_highlights, risk_notes, lock_in_months, is_featured, is_top10, discount_tiers, is_builtin, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)"
            );
            if (!$stmt) {
                sendResponse(['error' => 'Failed to prepare share insert'], 500);
                break;
            }
            // sssss d i s i sss i sss ss ss ssss i i i s => 28 params
            $stmt->bind_param(
                'sssssdisisssisssssssssssiiis',
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
                $logo_url,
                $price_history,
                $chart_labels,
                $listing_type,
                $ipo_timeline,
                $inventory_status,
                $isin,
                $key_highlights,
                $risk_notes,
                $lock_in_months,
                $is_featured,
                $is_top10,
                $discount_tiers
            );
        }

        if (!$stmt->execute()) {
            sendResponse(['error' => 'Failed to save share: ' . $stmt->error], 500);
            break;
        }

        // Force logo fields (initials / gradient / photo) — separate update so they always stick
        $logoStmt = $conn->prepare('UPDATE shares SET logo_initials = ?, logo_gradient = ?, logo_url = ? WHERE share_id = ?');
        if ($logoStmt) {
            $logoStmt->bind_param('ssss', $logo_initials, $logo_gradient, $logo_url, $share_id);
            if (!$logoStmt->execute()) {
                sendResponse(['error' => 'Stock saved but logo failed: ' . $logoStmt->error], 500);
                break;
            }
        }

        // Optional columns — ignore if migration not applied yet
        $fundStmt = $conn->prepare('UPDATE shares SET fundamentals=? WHERE share_id=?');
        if ($fundStmt) {
            $fundStmt->bind_param('ss', $fundamentals, $share_id);
            $fundStmt->execute();
        }

        if ($has_buy_price) {
            if ($data['buyPrice'] === '' || $data['buyPrice'] === null) {
                $bpStmt = $conn->prepare('UPDATE shares SET buy_price = NULL WHERE share_id = ?');
                if ($bpStmt) {
                    $bpStmt->bind_param('s', $share_id);
                    $bpStmt->execute();
                }
            } else {
                $bpStmt = $conn->prepare('UPDATE shares SET buy_price = ? WHERE share_id = ?');
                if ($bpStmt) {
                    $bpStmt->bind_param('ds', $buy_price, $share_id);
                    $bpStmt->execute();
                }
            }
        }

        if ($has_listing_price) {
            if ($listing_price === null) {
                $lpStmt = $conn->prepare('UPDATE shares SET listing_price = NULL WHERE share_id = ?');
                if ($lpStmt) {
                    $lpStmt->bind_param('s', $share_id);
                    $lpStmt->execute();
                }
            } else {
                $lpStmt = $conn->prepare('UPDATE shares SET listing_price = ? WHERE share_id = ?');
                if ($lpStmt) {
                    $lpStmt->bind_param('ds', $listing_price, $share_id);
                    $lpStmt->execute();
                }
            }
        }

        syncShareConfigPrice($conn, $share_id, $base_price);
        logAudit($conn, $existing ? 'Update Share' : 'Add Share', $_SESSION['admin_id'], ['shareId' => $share_id, 'name' => $name]);

        // Return saved row so admin UI can refresh immediately
        $saved = null;
        $getSaved = $conn->prepare('SELECT * FROM shares WHERE share_id = ? LIMIT 1');
        if ($getSaved) {
            $getSaved->bind_param('s', $share_id);
            $getSaved->execute();
            $savedRow = $getSaved->get_result()->fetch_assoc();
            if ($savedRow) {
                $saved = mapShareRow($savedRow, true);
            }
        }
        sendResponse(['success' => true, 'shareId' => $share_id, 'share' => $saved, 'logoInitials' => $logo_initials]);
        break;

    case 'deleteShare':
        requirePermission('prices');
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
        requirePermission('prices');
        $data = getPostData();
        $share_id = preg_replace('/[^a-z0-9-]/', '', strtolower($data['shareId'] ?? ''));
        if (!$share_id) {
            http_response_code(400);
            sendResponse(['error' => 'Invalid share ID']);
            break;
        }
        $base_price = (float) $data['basePrice'];

        $stmt = $conn->prepare("UPDATE shares SET base_price = ? WHERE share_id = ?");
        $stmt->bind_param('ds', $base_price, $share_id);
        $stmt->execute();

        syncShareConfigPrice($conn, $share_id, $base_price);

        if (array_key_exists('listingPrice', $data)) {
            $listing_price = null;
            if ($data['listingPrice'] !== '' && $data['listingPrice'] !== null) {
                $listing_price = (float) $data['listingPrice'];
                if ($listing_price <= 0) {
                    $listing_price = null;
                }
            }
            if ($listing_price === null) {
                $lpStmt = $conn->prepare('UPDATE shares SET listing_price = NULL WHERE share_id = ?');
                if ($lpStmt) {
                    $lpStmt->bind_param('s', $share_id);
                    $lpStmt->execute();
                }
            } else {
                $lpStmt = $conn->prepare('UPDATE shares SET listing_price = ? WHERE share_id = ?');
                if ($lpStmt) {
                    $lpStmt->bind_param('ds', $listing_price, $share_id);
                    $lpStmt->execute();
                }
            }
        }

        sendResponse(["success" => true]);
        break;

    case 'getSettings':
        $canAllSettings = isset($_SESSION['admin_id']) && refreshAdminSession($conn) && adminCan('settings');
        $stmt = $conn->prepare("SELECT setting_key, setting_value FROM settings");
        $stmt->execute();
        $res = $stmt->get_result();
        $settings = [];
        while ($row = $res->fetch_assoc()) {
            if ($canAllSettings || in_array($row['setting_key'], PUBLIC_SETTINGS_KEYS, true)) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }
        // Always expose charge flags to checkout (default OFF) so client never invents a 1% fee
        if (!$canAllSettings) {
            if (!array_key_exists('enable_invoice_charges', $settings)) {
                $settings['enable_invoice_charges'] = '0';
            }
            if (!array_key_exists('invoice_custom_charges', $settings)) {
                $settings['invoice_custom_charges'] = '[]';
            }
        }
        sendResponse($settings);
        break;

    case 'getMailStatus':
        requireMasterAdmin();
        sendResponse(guMailStatus());
        break;

    case 'testSmtp':
        requireMasterAdmin();
        validateCsrfToken();
        $data = getPostData();
        $to = strtolower(trim($data['email'] ?? ''));
        if ($to === '' || !isValidEmail($to)) {
            http_response_code(400);
            sendResponse(['error' => 'Valid test email address is required']);
            break;
        }
        if (!guSmtpConfigured()) {
            http_response_code(503);
            sendResponse([
                'success' => false,
                'error' => 'SMTP is not configured. Set GU_SMTP_* in .env.local or copy api/mail_config.example.php to api/mail_config.php on the server.',
            ]);
            break;
        }
        $ok = guSendEmail(
            $to,
            'Go-Unlisted SMTP test',
            "This is a test email from Go-Unlisted.\n\nIf you received this, OTP emails will work for registration and MPIN reset.\n\n— Go-Unlisted"
        );
        if (!$ok) {
            http_response_code(503);
            sendResponse(['success' => false, 'error' => 'SMTP test failed. Check api/php_errors.log on the server.']);
            break;
        }
        sendResponse(['success' => true, 'message' => "Test email sent to {$to}"]);
        break;

    // SEC 2 FIX: Use prepared statements instead of string interpolation
    case 'saveSettings':
        requirePermission('settings');
        $data = getPostData();
        // Whitelist allowed setting keys to prevent arbitrary key injection
        $allowedKeys = [
            'email', 'mobile', 'whatsapp', 'address',
            'bank_name', 'bank_ac_name', 'bank_ac_no', 'bank_ifsc', 'bank_upi', 'bank_branch', 'bank_address',
            'disclaimer',
            'enable_invoice_charges', 'invoice_custom_charges',
        ];
        $stmt = $conn->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        foreach ($data as $key => $val) {
            if (!in_array($key, $allowedKeys, true)) continue;
            $k = (string) $key;
            $v = (string) $val;
            $stmt->bind_param("ss", $k, $v);
            $stmt->execute();
        }
        sendResponse(["success" => true]);
        break;

    case 'uploadShareLogo':
        requirePermission('prices');
        if (!isset($_FILES['logo'])) {
            http_response_code(400);
            sendResponse(["error" => "No logo file received. Try again."]);
            break;
        }
        $fileErr = (int) ($_FILES['logo']['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($fileErr !== UPLOAD_ERR_OK) {
            $uploadErrors = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds server limit',
                UPLOAD_ERR_FORM_SIZE => 'File too large',
                UPLOAD_ERR_PARTIAL => 'Upload incomplete — try again',
                UPLOAD_ERR_NO_FILE => 'No file selected',
                UPLOAD_ERR_NO_TMP_DIR => 'Server temp folder missing',
                UPLOAD_ERR_CANT_WRITE => 'Server cannot write file',
            ];
            http_response_code(400);
            sendResponse(["error" => $uploadErrors[$fileErr] ?? "Upload error code $fileErr"]);
            break;
        }
        $tmpName = $_FILES['logo']['tmp_name'];
        $fileSize = (int) $_FILES['logo']['size'];
        if ($fileSize <= 0 || $fileSize > 2 * 1024 * 1024) {
            http_response_code(400);
            sendResponse(["error" => "Logo must be under 2MB"]);
            break;
        }
        $mime = '';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = (string) finfo_file($finfo, $tmpName);
            finfo_close($finfo);
        }
        if ($mime === '' || $mime === 'application/octet-stream') {
            $info = @getimagesize($tmpName);
            $mime = is_array($info) ? ($info['mime'] ?? '') : '';
        }
        $allowedMimes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowedMimes[$mime])) {
            http_response_code(400);
            sendResponse(["error" => "Invalid file type ($mime). Use JPG, PNG or WEBP."]);
            break;
        }
        $uploadDir = __DIR__ . '/../uploads/shares/';
        if (!is_dir($uploadDir)) {
            if (!@mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                http_response_code(500);
                sendResponse(["error" => "Could not create upload folder. Create public_html/uploads/shares on the server."]);
                break;
            }
        }
        if (!is_writable($uploadDir)) {
            http_response_code(500);
            sendResponse(["error" => "Upload folder is not writable. Set permissions on uploads/shares."]);
            break;
        }
        $filename = 'share_' . time() . '_' . random_int(1000, 9999) . '.' . $allowedMimes[$mime];
        $target = $uploadDir . $filename;
        if (!move_uploaded_file($tmpName, $target)) {
            http_response_code(500);
            sendResponse(["error" => "Failed to save logo file"]);
            break;
        }
        @chmod($target, 0644);
        $url = 'uploads/shares/' . $filename;
        logAudit($conn, 'Upload Share Logo', $_SESSION['admin_id'], ['file' => $filename]);
        sendResponse(["success" => true, "url" => $url]);
        break;

    case 'uploadQr':
        requirePermission('settings');
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
        $res = $conn->query("SELECT id, title, slug, image_url, category, tags, author, created_at FROM articles WHERE status = 'published' ORDER BY created_at DESC");
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
        requirePermission('articles');
        $res = $conn->query("SELECT id, title, slug, image_url, category, tags, author, status, created_at FROM articles ORDER BY created_at DESC");
        $articles = [];
        while($row = $res->fetch_assoc()) { 
            $articles[] = $row; 
        }
        sendResponse($articles);
        break;

    case 'adminGetArticle':
        requirePermission('articles');
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
        requirePermission('articles');
        $data = getPostData();
        $id = $data['id'] ?? null;
        $title = htmlspecialchars($data['title'] ?? '', ENT_QUOTES, 'UTF-8');
        $slug = preg_replace('/[^a-z0-9-]/', '', strtolower($data['slug'] ?? ''));
        $content = sanitizeArticleHtml($data['content'] ?? '');
        $rawImage = trim((string) ($data['image_url'] ?? ''));
        $image_url = '';
        if ($rawImage !== '') {
            if (filter_var($rawImage, FILTER_VALIDATE_URL)) {
                $image_url = $rawImage;
            } elseif (preg_match('#^uploads/(articles/)?[a-zA-Z0-9._-]+$#', ltrim($rawImage, '/'))) {
                $image_url = ltrim($rawImage, '/');
            }
        }
        $category = trim(htmlspecialchars((string) ($data['category'] ?? ''), ENT_QUOTES, 'UTF-8'));
        $category = mb_substr($category, 0, 100);
        $tags = normalizeArticleTags($data['tags'] ?? '');
        $status = $data['status'] ?? 'published';
        $author = 'GoUnlisted Team';
        
        if (empty($title) || empty($slug) || trim(strip_tags($content)) === '') {
            http_response_code(400);
            sendResponse(["error" => "Title, slug and content are required"]);
            break;
        }

        if ($id) {
            $stmt = $conn->prepare("UPDATE articles SET title=?, slug=?, content=?, image_url=?, category=?, tags=?, status=? WHERE id=?");
            $stmt->bind_param("sssssssi", $title, $slug, $content, $image_url, $category, $tags, $status, $id);
            $stmt->execute();
            logAudit($conn, 'Update Article', $_SESSION['admin_id'], ['id' => $id, 'title' => $title]);
            sendResponse(["success" => true, "id" => $id]);
        } else {
            $stmt = $conn->prepare("INSERT INTO articles (title, slug, content, image_url, category, tags, author, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssssss", $title, $slug, $content, $image_url, $category, $tags, $author, $status);
            $stmt->execute();
            $newId = $conn->insert_id;
            logAudit($conn, 'Create Article', $_SESSION['admin_id'], ['id' => $newId, 'title' => $title]);
            sendResponse(["success" => true, "id" => $newId]);
        }
        break;

    case 'adminDeleteArticle':
        requirePermission('articles');
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
        requirePermission('articles');
        validateCsrfToken();
        if (!isset($_FILES['image']) || (int) ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            http_response_code(400);
            sendResponse(["error" => "No file uploaded or upload error"]);
            break;
        }
        $tmpName = $_FILES['image']['tmp_name'];
        $fileSize = (int) $_FILES['image']['size'];

        if ($fileSize <= 0 || $fileSize > 5 * 1024 * 1024) {
            http_response_code(400);
            sendResponse(["error" => "File too large (max 5MB)"]);
            break;
        }

        $mime = '';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = (string) finfo_file($finfo, $tmpName);
            finfo_close($finfo);
        }
        if ($mime === '' || $mime === 'application/octet-stream') {
            $info = @getimagesize($tmpName);
            $mime = is_array($info) ? ($info['mime'] ?? '') : '';
        }

        $allowedMimes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowedMimes[$mime])) {
            http_response_code(400);
            sendResponse(["error" => "Invalid file type. Only JPG, PNG and WEBP allowed."]);
            break;
        }

        $uploadDir = __DIR__ . '/../uploads/articles/';
        if (!is_dir($uploadDir)) {
            if (!@mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                http_response_code(500);
                sendResponse(["error" => "Could not create upload folder. Create public_html/uploads/articles on the server."]);
                break;
            }
        }
        if (!is_writable($uploadDir)) {
            http_response_code(500);
            sendResponse(["error" => "Upload folder is not writable. Set permissions on uploads/articles."]);
            break;
        }

        $filename = 'article_' . time() . '_' . random_int(1000, 9999) . '.' . $allowedMimes[$mime];
        $target = $uploadDir . $filename;
        if (!move_uploaded_file($tmpName, $target)) {
            http_response_code(500);
            sendResponse(["error" => "Failed to save file"]);
            break;
        }
        @chmod($target, 0644);
        $url = 'uploads/articles/' . $filename;
        logAudit($conn, 'Upload Article Image', $_SESSION['admin_id'], ['file' => $filename]);
        sendResponse(["success" => true, "url" => $url]);
        break;

    default:
        http_response_code(400);
        sendResponse(["error" => "Invalid action"]);
        break;
}

$conn->close();
?>
