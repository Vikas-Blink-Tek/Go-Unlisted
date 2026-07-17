<?php
/**
 * Hostinger production database — go-unlisted.com
 */
$host = getenv('GU_DB_HOST') ?: 'localhost';
$db_user = getenv('GU_DB_USER') ?: 'u192120061_admin';
$db_pass = getenv('GU_DB_PASS') ?: 'Gounlisted@123';
$db_name = getenv('GU_DB_NAME') ?: 'u192120061_unlisted';

if (is_file(__DIR__ . '/db_config.local.php')) {
    require __DIR__ . '/db_config.local.php';
}
