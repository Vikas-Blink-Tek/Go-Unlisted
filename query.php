<?php
require 'api/db_config.local.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
$stmt = $conn->query("SELECT ticker, discount_tiers FROM shares WHERE ticker='OYOROOMS'");
while ($row = $stmt->fetch_assoc()) {
    print_r($row);
}
