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
echo "Demo users removed: {$results['users_deleted']}\n";
echo "Employees kept (not deleted).\n";
echo "Master admin ({$results['admin']}): " . MASTER_ADMIN_EMAIL . "\n";
echo "Admin panel: /admin/login\n";

$conn->close();
