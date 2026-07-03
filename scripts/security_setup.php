#!/usr/bin/env php
<?php
/**
 * CLI production reset (run on server after upload):
 *   php scripts/security_setup.php
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require_once __DIR__ . '/../api/db_config.php';
require_once __DIR__ . '/production_reset.php';

$conn = new mysqli($host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
    fwrite(STDERR, "DB connection failed: {$conn->connect_error}\n");
    fwrite(STDERR, "Edit api/db_config.php with your Hostinger MySQL credentials.\n");
    exit(1);
}

$results = runProductionReset($conn);
file_put_contents(__DIR__ . '/../api/.installed', date('c'));

echo "Production reset complete.\n";
echo "Test users removed: {$results['users_deleted']}\n";
echo "Extra employees removed: {$results['employees_deleted']}\n";
echo "Master admin ({$results['admin']}): " . MASTER_ADMIN_EMAIL . "\n";
echo "Admin panel: /admin/login\n";

if (empty(getenv('MSG91_AUTH_KEY')) && empty($msg91_auth_key ?? '')) {
    echo "\nOptional: set MSG91_AUTH_KEY in api/db_config.php for OTP SMS.\n";
}

$conn->close();
