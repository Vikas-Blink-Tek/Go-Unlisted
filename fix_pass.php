<?php
require_once 'api/load_env.php';
require_once 'api/db_config.php';
$conn = new mysqli($host, $db_user, $db_pass, $db_name);
$hash = password_hash('Jiya@123', PASSWORD_DEFAULT);
$conn->query("UPDATE employees SET password = '$hash' WHERE employee_id = 'GUE001'");
echo "Password manually reset to Jiya@123\n";
