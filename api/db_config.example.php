<?php
/**
 * Hostinger database config — EDIT the 4 values below before going live.
 * Copy this file to db_config.php if needed.
 */

$host = getenv('GU_DB_HOST') ?: 'localhost';
$db_user = getenv('GU_DB_USER') ?: 'YOUR_HOSTINGER_DB_USER';
$db_pass = getenv('GU_DB_PASS') ?: 'YOUR_HOSTINGER_DB_PASSWORD';
$db_name = getenv('GU_DB_NAME') ?: 'YOUR_HOSTINGER_DB_NAME';

// MSG91 OTP SMS (optional — leave blank to disable SMS until configured)
$msg91_auth_key = getenv('MSG91_AUTH_KEY') ?: '';
$msg91_template_id = getenv('MSG91_TEMPLATE_ID') ?: '';
$msg91_sender_id = getenv('MSG91_SENDER_ID') ?: 'GOUNLS';

if (is_file(__DIR__ . '/db_config.local.php')) {
    require __DIR__ . '/db_config.local.php';
}
