<?php
/**
 * Master Franchise multi-tenant helpers.
 * Platform master (Jyoti) sees all; franchise masters see only their franchise_id scope.
 */

function franchiseTableExists(mysqli $conn): bool {
    $res = $conn->query("SHOW TABLES LIKE 'franchises'");
    return $res && $res->num_rows > 0;
}

function employeeFranchiseColumnsReady(mysqli $conn): bool {
    $res = $conn->query("SHOW COLUMNS FROM employees LIKE 'franchise_id'");
    return $res && $res->num_rows > 0;
}

function employeeFranchiseMasterColumnReady(mysqli $conn): bool {
    $res = $conn->query("SHOW COLUMNS FROM employees LIKE 'is_franchise_master'");
    return $res && $res->num_rows > 0;
}

/**
 * Resolve data scope for the logged-in admin from DB (not session alone).
 * null  = platform super admin (all data)
 * ''    = single-employee scope (referral code)
 * other = franchise id string
 */
function resolveAdminFranchiseScopeId(mysqli $conn): ?string {
    if (empty($_SESSION['admin_id'])) {
        return '';
    }
    $adminId = (string) $_SESSION['admin_id'];
    if ($adminId === 'master-admin') {
        return null;
    }
    if (!employeeFranchiseColumnsReady($conn)) {
        return '';
    }
    $hasFmCol = employeeFranchiseMasterColumnReady($conn);
    $sql = $hasFmCol
        ? 'SELECT franchise_id, is_franchise_master, is_master FROM employees WHERE id = ? LIMIT 1'
        : 'SELECT franchise_id, is_master FROM employees WHERE id = ? LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return '';
    }
    $stmt->bind_param('s', $adminId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return '';
    }
    $fid = trim((string) ($row['franchise_id'] ?? ''));
    $isFm = $hasFmCol && (int) ($row['is_franchise_master'] ?? 0) === 1;
    if ($fid === '' && $isFm && franchiseTableExists($conn)) {
        $emailStmt = $conn->prepare('SELECT email FROM employees WHERE id = ? LIMIT 1');
        $emailStmt->bind_param('s', $adminId);
        $emailStmt->execute();
        $emailRow = $emailStmt->get_result()->fetch_assoc();
        $email = strtolower(trim((string) ($emailRow['email'] ?? '')));
        if ($email !== '') {
            $frStmt = $conn->prepare('SELECT id FROM franchises WHERE LOWER(TRIM(contact_email)) = ? LIMIT 1');
            $frStmt->bind_param('s', $email);
            $frStmt->execute();
            $frRow = $frStmt->get_result()->fetch_assoc();
            if ($frRow) {
                $fid = trim((string) ($frRow['id'] ?? ''));
                if ($fid !== '') {
                    $fix = $conn->prepare('UPDATE employees SET franchise_id = ? WHERE id = ?');
                    $fix->bind_param('ss', $fid, $adminId);
                    $fix->execute();
                }
            }
        }
    }
    if ($fid !== '') {
        $_SESSION['franchise_id'] = $fid;
        if ($isFm) {
            $_SESSION['is_franchise_master'] = 1;
            $_SESSION['is_master'] = 0;
        }
        return $fid;
    }
    if ($isFm) {
        $_SESSION['is_franchise_master'] = 1;
        $_SESSION['is_master'] = 0;
    }
    return '';
}

function migrateFranchiseSchema(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS franchises (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        contact_email VARCHAR(255) DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    foreach ([
        'employees' => 'franchise_id VARCHAR(50) DEFAULT NULL AFTER permissions',
        'employees_fm' => 'is_franchise_master TINYINT(1) NOT NULL DEFAULT 0 AFTER franchise_id',
        'users' => 'franchise_id VARCHAR(50) DEFAULT NULL AFTER referral_code',
        'orders' => 'franchise_id VARCHAR(50) DEFAULT NULL AFTER employee_code',
        'initiated_checkouts' => 'franchise_id VARCHAR(50) DEFAULT NULL AFTER employee_code',
    ] as $table => $ddl) {
        if ($table === 'employees_fm') {
            $res = $conn->query("SHOW COLUMNS FROM employees LIKE 'is_franchise_master'");
            if ($res && $res->num_rows === 0) {
                $conn->query("ALTER TABLE employees ADD COLUMN is_franchise_master TINYINT(1) NOT NULL DEFAULT 0 AFTER franchise_id");
            }
            continue;
        }
        $col = explode(' ', $ddl, 2)[0];
        $res = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE '{$col}'");
        if ($res && $res->num_rows === 0) {
            $conn->query("ALTER TABLE `{$table}` ADD COLUMN {$ddl}");
        }
    }

    // Backfill franchise master links (older rows may have is_franchise_master without franchise_id)
    if (employeeFranchiseMasterColumnReady($conn) && franchiseTableExists($conn)) {
        $conn->query(
            "UPDATE employees e
             INNER JOIN franchises f ON LOWER(TRIM(f.contact_email)) = LOWER(TRIM(e.email))
             SET e.franchise_id = f.id, e.is_franchise_master = 1
             WHERE COALESCE(e.is_franchise_master, 0) = 1
               AND (e.franchise_id IS NULL OR e.franchise_id = '')"
        );
    }
}

function isPlatformMasterSession(): bool {
    return !empty($_SESSION['is_master']);
}

function isFranchiseMasterSession(): bool {
    return !empty($_SESSION['is_franchise_master']) && empty($_SESSION['is_master']);
}

function currentFranchiseId(): string {
    return trim((string) ($_SESSION['franchise_id'] ?? ''));
}

function defaultFranchiseMasterPermissions(): array {
    return [
        'dashboard', 'pending', 'initiated', 'orders', 'manual-order', 'cancel-refund',
        'users', 'signups', 'employees', 'reports', 'invoices',
        'view-all-orders', 'view-all-kyc',
    ];
}

function franchiseMasterBlockedPermissions(): array {
    return ['settings', 'franchises', 'inventory', 'prices', 'articles'];
}

function franchiseEmployeeBlockedPermissions(): array {
    return array_merge(franchiseMasterBlockedPermissions(), ['reports']);
}

function sanitizeFranchiseEmployeePermissions(array $permissions): array {
    return array_values(array_filter(
        $permissions,
        static fn ($p) => !in_array((string) $p, franchiseEmployeeBlockedPermissions(), true)
    ));
}

/** Platform-wide user/KYC list — super admin only. */
function adminCanViewPlatformWideUsers(mysqli $conn): bool {
    return resolveAdminFranchiseScopeId($conn) === null;
}

/** Franchise-scoped user list. */
function adminCanViewFranchiseUsers(mysqli $conn): bool {
    $scope = resolveAdminFranchiseScopeId($conn);
    return is_string($scope) && $scope !== '';
}

function userBelongsToFranchise(mysqli $conn, array $userRow, string $franchiseId): bool {
    $franchiseId = trim($franchiseId);
    if ($franchiseId === '') {
        return false;
    }
    if (trim((string) ($userRow['franchise_id'] ?? '')) === $franchiseId) {
        return true;
    }
    $ref = canonicalizeEmployeeUserCode((string) ($userRow['referral_code'] ?? ''));
    if ($ref === '' || $ref === 'GU00') {
        return false;
    }
    return lookupFranchiseIdForEmployeeCode($conn, $ref) === $franchiseId;
}

function adminUserInScope(mysqli $conn, string $userId): bool {
    $scope = resolveAdminFranchiseScopeId($conn);
    if ($scope === null) {
        return true;
    }
    $stmt = $conn->prepare('SELECT franchise_id, referral_code FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('s', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return false;
    }
    if ($scope !== '') {
        // Franchise staff stay franchise-scoped (even if they have view-all-kyc on the role).
        return userBelongsToFranchise($conn, $row, $scope);
    }
    // Platform employee with "View All KYC" — same expansion as getUsers.
    if (adminCan('view-all-kyc') && !isFranchiseMasterSession()) {
        return true;
    }
    $code = currentEmployeeCode($conn);
    return $code !== '' && strtoupper(trim((string) ($row['referral_code'] ?? ''))) === $code;
}

function fetchUsersForFranchise(mysqli $conn, string $franchiseId): mysqli_result|false {
    $franchiseId = trim($franchiseId);
    if ($franchiseId === '') {
        return false;
    }
    $sql = "SELECT u.id, u.name, u.phone, u.email, u.role, u.referral_code, u.franchise_id,
                   u.kyc_status, u.kyc_reject_reason, u.kyc_pan, u.kyc_demat, u.kyc_demat_proof,
                   u.bank_account, u.bank_name, u.ifsc, u.created_at
            FROM users u
            WHERE u.franchise_id = ?
               OR EXISTS (
                    SELECT 1 FROM employees e
                    WHERE e.franchise_id = ?
                      AND COALESCE(e.is_master, 0) = 0
                      AND UPPER(TRIM(e.employee_id)) = UPPER(TRIM(u.referral_code))
                      AND UPPER(TRIM(e.employee_id)) NOT IN ('GU00', '')
               )
            ORDER BY u.created_at DESC";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('ss', $franchiseId, $franchiseId);
    $stmt->execute();
    return $stmt->get_result();
}

function adminHasFranchiseMasterAccess(string $permission): bool {
    if (in_array($permission, franchiseMasterBlockedPermissions(), true)) {
        return false;
    }
    return true;
}

function lookupFranchiseById(mysqli $conn, ?string $id): ?array {
    $id = trim((string) $id);
    if ($id === '' || !franchiseTableExists($conn)) {
        return null;
    }
    $stmt = $conn->prepare('SELECT id, name, code, contact_email, is_active, created_at FROM franchises WHERE id = ? LIMIT 1');
    $stmt->bind_param('s', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ?: null;
}

function lookupFranchiseName(mysqli $conn, ?string $id): string {
    $row = lookupFranchiseById($conn, $id);
    return $row ? trim((string) $row['name']) : '';
}

function lookupFranchiseIdForEmployeeCode(mysqli $conn, string $code): string {
    $code = canonicalizeEmployeeUserCode($code);
    if ($code === '' || $code === 'GU00') {
        return '';
    }
    $stmt = $conn->prepare('SELECT franchise_id FROM employees WHERE UPPER(TRIM(employee_id)) = ? LIMIT 1');
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return trim((string) ($row['franchise_id'] ?? ''));
}

function resolveFranchiseIdForOrder(mysqli $conn, string $employeeCode, string $userId = ''): string {
    if (isRealEmployeeUserCode($employeeCode)) {
        $fid = lookupFranchiseIdForEmployeeCode($conn, $employeeCode);
        if ($fid !== '') {
            return $fid;
        }
    }
    if ($userId !== '' && !str_starts_with($userId, 'admin:')) {
        $stmt = $conn->prepare('SELECT franchise_id FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('s', $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $fid = trim((string) ($row['franchise_id'] ?? ''));
        if ($fid !== '') {
            return $fid;
        }
        $ref = lookupEmployeeCodeForUser($conn, $userId);
        if (isRealEmployeeUserCode($ref)) {
            return lookupFranchiseIdForEmployeeCode($conn, $ref);
        }
    }
    if (!empty($_SESSION['admin_id']) && isFranchiseMasterSession()) {
        return currentFranchiseId();
    }
    if (!empty($_SESSION['admin_id']) && !isPlatformMasterSession()) {
        $adminId = (string) $_SESSION['admin_id'];
        $stmt = $conn->prepare('SELECT franchise_id FROM employees WHERE id = ? LIMIT 1');
        $stmt->bind_param('s', $adminId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return trim((string) ($row['franchise_id'] ?? ''));
    }
    return '';
}

function syncUserFranchiseFromReferral(mysqli $conn, string $userId, string $referralCode): void {
    $fid = lookupFranchiseIdForEmployeeCode($conn, $referralCode);
    if ($fid === '') {
        $stmt = $conn->prepare('UPDATE users SET franchise_id = NULL WHERE id = ?');
        $stmt->bind_param('s', $userId);
    } else {
        $stmt = $conn->prepare('UPDATE users SET franchise_id = ? WHERE id = ?');
        $stmt->bind_param('ss', $fid, $userId);
    }
    $stmt->execute();
}

function mapFranchiseRow(array $row): array {
    return [
        'id' => (string) ($row['id'] ?? ''),
        'name' => (string) ($row['name'] ?? ''),
        'code' => strtoupper(trim((string) ($row['code'] ?? ''))),
        'contactEmail' => (string) ($row['contact_email'] ?? ''),
        'isActive' => (int) ($row['is_active'] ?? 1) === 1,
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'masterName' => (string) ($row['master_name'] ?? ''),
        'masterEmail' => (string) ($row['master_email'] ?? ''),
        'masterEmployeeId' => (string) ($row['master_employee_id'] ?? ''),
    ];
}

function enrichOrderFranchiseFields(mysqli $conn, array $row): array {
    $fid = trim((string) ($row['franchise_id'] ?? ''));
    $name = $fid !== '' ? lookupFranchiseName($conn, $fid) : '';
    $row['franchiseId'] = $fid;
    $row['franchiseName'] = $name !== '' ? $name : ($fid === '' ? 'Direct / Platform' : '');
    $row['franchiseLabel'] = $row['franchiseName'];
    return $row;
}

function employeeOwnsOrderRow(mysqli $conn, array $orderRow): bool {
    $code = canonicalizeEmployeeUserCode(currentEmployeeCode($conn));
    if ($code === '' || $code === 'GU00') {
        return false;
    }
    $orderCode = canonicalizeEmployeeUserCode((string) ($orderRow['employee_code'] ?? ''));
    if ($orderCode !== '' && $orderCode !== 'GU00' && $orderCode === $code) {
        return true;
    }
    $userId = (string) ($orderRow['user_id'] ?? '');
    if ($userId !== '' && !str_starts_with($userId, 'admin:')) {
        $fromUser = canonicalizeEmployeeUserCode(lookupEmployeeCodeForUser($conn, $userId));
        if ($fromUser !== '' && $fromUser !== 'GU00' && $fromUser === $code) {
            return true;
        }
    }
    // Blank / GU00 on order — recover from buyer contact (same as portfolio heal)
    if ($orderCode === '' || $orderCode === 'GU00') {
        if (function_exists('resolveBuyerEmployeeCode')) {
            $recovered = canonicalizeEmployeeUserCode(resolveBuyerEmployeeCode(
                $conn,
                $userId,
                (string) ($orderRow['buyer_phone'] ?? ''),
                (string) ($orderRow['buyer_email'] ?? '')
            ));
            if ($recovered !== '' && $recovered !== 'GU00' && $recovered === $code) {
                return true;
            }
        }
    }
    if ($userId !== '' && $userId === 'admin:' . ($_SESSION['admin_id'] ?? '')) {
        return true;
    }
    return false;
}

function orderBelongsToAdminScope(mysqli $conn, array $orderRow): bool {
    if (isPlatformMasterSession()) {
        return true;
    }
    // Own referral code always allowed (even if franchise_id missing on the loaded row)
    if (employeeOwnsOrderRow($conn, $orderRow)) {
        return true;
    }
    $orderFid = trim((string) ($orderRow['franchise_id'] ?? ''));
    if (isFranchiseMasterSession()) {
        $fid = currentFranchiseId();
        if ($fid === '') {
            return false;
        }
        return $orderFid === $fid;
    }
    $fid = currentFranchiseId();
    // Different franchise → deny
    if ($fid !== '' && $orderFid !== '' && $orderFid !== $fid) {
        return false;
    }
    if (adminCan('view-all-orders')) {
        return true;
    }
    return false;
}

function initiatedBelongsToAdminScope(mysqli $conn, array $row): bool {
    if (isPlatformMasterSession()) {
        return true;
    }
    if (isFranchiseMasterSession()) {
        $fid = currentFranchiseId();
        return $fid !== '' && trim((string) ($row['franchise_id'] ?? '')) === $fid;
    }
    $scope = resolveAdminFranchiseScopeId($conn);
    if ($scope !== '') {
        if (trim((string) ($row['franchise_id'] ?? '')) !== $scope) {
            return false;
        }
        if (adminCan('view-all-initiated')) {
            return true;
        }
    } elseif (adminCan('view-all-initiated')) {
        return true;
    }
    $code = currentEmployeeCode($conn);
    if ($code === '') {
        return false;
    }
    return strtoupper(trim((string) ($row['employee_code'] ?? ''))) === $code;
}

function nextFranchiseCode(mysqli $conn): string {
    $res = $conn->query("SELECT code FROM franchises WHERE code REGEXP '^FR[0-9]{3}$' ORDER BY code DESC LIMIT 1");
    $n = 1;
    if ($res && ($row = $res->fetch_assoc())) {
        $n = (int) substr((string) $row['code'], 2) + 1;
    }
    return 'FR' . str_pad((string) $n, 3, '0', STR_PAD_LEFT);
}
