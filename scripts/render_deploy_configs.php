<?php
/**
 * Write production db_config.php + mail_config.php from api/deploy.config.php
 */
$root = dirname(__DIR__);
$src = $root . '/api/deploy.config.php';
$outDir = $argc > 1 ? $argv[1] : $root . '/deploy/package/api';

if (!is_readable($src)) {
    fwrite(STDERR, "Missing api/deploy.config.php — copy deploy.config.example.php\n");
    exit(1);
}

/** @var array<string,mixed> $cfg */
$cfg = require $src;
$db = $cfg['db'] ?? [];
$smtp = $cfg['smtp'] ?? [];

foreach (['user', 'name'] as $k) {
    if (empty($db[$k]) || str_contains((string) $db[$k], 'REPLACE_HPANEL')) {
        fwrite(STDERR, "Edit api/deploy.config.php: set db.{$k} from Hostinger hPanel → Databases\n");
        exit(1);
    }
}

if (!is_dir($outDir)) {
    mkdir($outDir, 0755, true);
}

$dbPhp = '<?php' . "\n"
    . "/** Production DB — generated from deploy.config.php */\n"
    . '$host = ' . var_export((string) ($db['host'] ?? 'localhost'), true) . ";\n"
    . '$db_user = ' . var_export((string) $db['user'], true) . ";\n"
    . '$db_pass = ' . var_export((string) ($db['pass'] ?? ''), true) . ";\n"
    . '$db_name = ' . var_export((string) $db['name'], true) . ";\n";

$mailPhp = '<?php' . "\n"
    . "/** Production SMTP — generated from deploy.config.php */\n"
    . "return [\n"
    . "    'smtp_host' => " . var_export((string) ($smtp['host'] ?? 'smtp.hostinger.com'), true) . ",\n"
    . "    'smtp_port' => " . (int) ($smtp['port'] ?? 465) . ",\n"
    . "    'smtp_secure' => " . var_export((string) ($smtp['secure'] ?? 'ssl'), true) . ",\n"
    . "    'smtp_user' => " . var_export((string) ($smtp['user'] ?? ''), true) . ",\n"
    . "    'smtp_pass' => " . var_export((string) ($smtp['pass'] ?? ''), true) . ",\n"
    . "    'mail_from' => " . var_export((string) ($smtp['from'] ?? $smtp['user'] ?? ''), true) . ",\n"
    . "];\n";

file_put_contents($outDir . '/db_config.php', $dbPhp);
file_put_contents($outDir . '/mail_config.php', $mailPhp);

$admin = $cfg['admin'] ?? [];
$login = "GO UNLISTED — Login credentials\n"
    . "================================\n\n"
    . 'Site: ' . ($cfg['site_url'] ?? '') . "\n\n"
    . "ADMIN PANEL\n"
    . "  URL:      /admin/login\n"
    . '  Email:    ' . ($admin['email'] ?? '') . "\n"
    . '  Password: ' . ($admin['password'] ?? '') . "\n\n"
    . "OTP EMAIL\n"
    . '  From:     ' . ($smtp['from'] ?? '') . "\n"
    . '  Mailbox:  ' . ($smtp['user'] ?? '') . "\n\n"
    . "DATABASE\n"
    . '  Host:     ' . ($db['host'] ?? 'localhost') . "\n"
    . '  Name:     ' . ($db['name'] ?? '') . "\n"
    . '  User:     ' . ($db['user'] ?? '') . "\n\n"
    . "After upload:\n"
    . "  1. Import schema.sql in phpMyAdmin (first time only)\n"
    . "  2. Visit /setup.php → Activate → delete setup.php\n"
    . "  3. Admin → Site Settings → Test SMTP\n";

file_put_contents(dirname($outDir) . '/LOGIN_CREDENTIALS.txt', $login);

echo "Wrote db_config.php, mail_config.php, LOGIN_CREDENTIALS.txt\n";
