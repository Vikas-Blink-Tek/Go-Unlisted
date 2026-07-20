<?php
require 'api/db_config.php';
$conn = new mysqli($host, $db_user, $db_pass, $db_name);
$conn->query("ALTER TABLE shares ADD COLUMN discount_tiers TEXT");
