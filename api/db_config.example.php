<?php
/**
 * Hostinger database config — EDIT the 4 values below before going live.
 * Copy this file to db_config.php if needed.
 */

$host = getenv('GU_DB_HOST') ?: 'localhost';
$db_user = getenv('GU_DB_USER') ?: 'YOUR_HOSTINGER_DB_USER';
$db_pass = getenv('GU_DB_PASS') ?: 'YOUR_HOSTINGER_DB_PASSWORD';
$db_name = getenv('GU_DB_NAME') ?: 'YOUR_HOSTINGER_DB_NAME';

if (is_file(__DIR__ . '/db_config.local.php')) {
    require __DIR__ . '/db_config.local.php';
}
