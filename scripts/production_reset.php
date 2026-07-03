<?php
/**
 * Production reset — single master admin, no test users.
 * Used by security_setup.php (CLI) and setup.php (browser).
 */

const MASTER_ADMIN_ID = 'master-admin';
const MASTER_ADMIN_NAME = 'Super Admin';
const MASTER_ADMIN_EMAIL = 'jgond1992@gmail.com';
/** Master admin password hash — set in schema.sql / change after first login */
const MASTER_ADMIN_PASSWORD_HASH = '$2y$12$/sFlYCJz86cpx9zzXQlXAe5g5nU37xOlz4WBDLaJ/.jfRi40rMYxq';

function runProductionReset(mysqli $conn): array
{
    $results = [];

    $conn->query('DELETE FROM users');
    $results['users_deleted'] = $conn->affected_rows;

    $conn->query('DELETE FROM employees WHERE is_master = 0');
    $results['employees_deleted'] = $conn->affected_rows;

    $hash = MASTER_ADMIN_PASSWORD_HASH;
    $email = MASTER_ADMIN_EMAIL;
    $name = MASTER_ADMIN_NAME;
    $id = MASTER_ADMIN_ID;

    $check = $conn->query('SELECT id FROM employees WHERE is_master = 1 LIMIT 1');
    if ($check && ($row = $check->fetch_assoc())) {
        $stmt = $conn->prepare('UPDATE employees SET id=?, name=?, email=?, password=?, is_master=1 WHERE id=?');
        $stmt->bind_param('sssss', $id, $name, $email, $hash, $row['id']);
        $stmt->execute();
        $results['admin'] = 'updated';
    } else {
        $conn->query('DELETE FROM employees');
        $stmt = $conn->prepare('INSERT INTO employees (id, name, email, password, is_master) VALUES (?, ?, ?, ?, 1)');
        $stmt->bind_param('ssss', $id, $name, $email, $hash);
        $stmt->execute();
        $results['admin'] = 'created';
    }

    foreach (['otps', 'otp_attempts', 'login_attempts', 'otp_ip_attempts'] as $table) {
        $conn->query("DELETE FROM {$table}");
    }

    return $results;
}
