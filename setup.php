<?php
/**
 * One-time Hostinger setup — visit once after upload, then delete this file.
 * https://yourdomain.com/setup.php
 */
header('Content-Type: text/html; charset=utf-8');

$lockFile = __DIR__ . '/api/.installed';

if (file_exists($lockFile)) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem"><h1>Already set up</h1><p>Delete <code>setup.php</code> from your server if it is still there.</p></body></html>';
    exit;
}

require_once __DIR__ . '/api/db_config.php';

$error = null;
$done = false;
$results = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/scripts/production_reset.php';

    $conn = new mysqli($host, $db_user, $db_pass, $db_name);
    if ($conn->connect_error) {
        $error = 'Database connection failed. Edit api/db_config.php with your Hostinger MySQL details, then try again.';
    } else {
        $results = runProductionReset($conn);
        file_put_contents($lockFile, date('c'));
        $conn->close();
        $done = true;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Go-Unlisted Setup</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #334155; margin: 0; padding: 2rem; }
    .card { max-width: 520px; margin: 2rem auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 8px 32px rgba(0,0,0,.08); }
    h1 { font-size: 1.4rem; margin: 0 0 .5rem; color: #0f172a; }
    p { line-height: 1.6; font-size: .92rem; }
    ol { font-size: .9rem; line-height: 1.8; padding-left: 1.2rem; }
    .btn { display: inline-block; margin-top: 1rem; background: linear-gradient(135deg,#7ac142,#0072bc); color: #020b18; border: none; padding: 12px 24px; border-radius: 50px; font-weight: 700; cursor: pointer; font-size: .9rem; }
    .err { background: #fef2f2; color: #b91c1c; padding: .75rem 1rem; border-radius: 8px; margin: 1rem 0; font-size: .85rem; }
    .ok { background: #f0fdf4; color: #166534; padding: .75rem 1rem; border-radius: 8px; margin: 1rem 0; font-size: .85rem; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: .85em; }
  </style>
</head>
<body>
  <div class="card">
    <?php if ($done): ?>
      <h1>Setup complete</h1>
      <div class="ok">
        Test users removed (<?= (int)($results['users_deleted'] ?? 0) ?>).<br>
        Master admin ready: <strong><?= htmlspecialchars(MASTER_ADMIN_EMAIL) ?></strong>
      </div>
      <p><strong>Next steps:</strong></p>
      <ol>
        <li>Delete <code>setup.php</code> from your server now.</li>
        <li>Open <a href="/admin/login">/admin/login</a> and sign in.</li>
        <li>Visit your homepage — the React site should be live.</li>
      </ol>
    <?php else: ?>
      <h1>Go-Unlisted — Hostinger Setup</h1>
      <p>Run this once after uploading files and importing <code>schema.sql</code>.</p>
      <ol>
        <li>Edit <code>api/db_config.php</code> with your MySQL credentials.</li>
        <li>Import <code>schema.sql</code> in phpMyAdmin.</li>
        <li>Click the button below to remove test data and activate the admin account.</li>
      </ol>
      <?php if ($error): ?><div class="err"><?= htmlspecialchars($error) ?></div><?php endif; ?>
      <form method="post">
        <button class="btn" type="submit">Activate production site</button>
      </form>
    <?php endif; ?>
  </div>
</body>
</html>
