<?php
/**
 * Email delivery for OTP and notifications.
 * Configure via api/mail_config.php on Hostinger, or GU_SMTP_* in .env.local.
 * OTP emails require working SMTP — PHP mail() is not used for OTP (avoids false success).
 */

function guMailConfig(): array {
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }

    $cfg = [
        'smtp_host' => '',
        'smtp_port' => 465,
        'smtp_secure' => 'ssl',
        'smtp_user' => '',
        'smtp_pass' => '',
        'mail_from' => '',
    ];

    $localFile = __DIR__ . '/mail_config.php';
    if (is_readable($localFile)) {
        $fileCfg = require $localFile;
        if (is_array($fileCfg)) {
            foreach ($fileCfg as $key => $value) {
                if ($value !== '' && $value !== null) {
                    $cfg[$key] = $value;
                }
            }
        }
    }

    // Env vars override file only when explicitly set (local dev).
    $envMap = [
        'smtp_host' => 'GU_SMTP_HOST',
        'smtp_port' => 'GU_SMTP_PORT',
        'smtp_secure' => 'GU_SMTP_SECURE',
        'smtp_user' => 'GU_SMTP_USER',
        'smtp_pass' => 'GU_SMTP_PASS',
        'mail_from' => 'GU_MAIL_FROM',
    ];
    foreach ($envMap as $cfgKey => $envKey) {
        $val = getenv($envKey);
        if ($val !== false && $val !== '') {
            $cfg[$cfgKey] = $cfgKey === 'smtp_port' ? (int) $val : $val;
        }
    }
    $fromEnv = getenv('GU_SMTP_FROM');
    if ($fromEnv !== false && $fromEnv !== '') {
        $cfg['mail_from'] = $fromEnv;
    }

    $cfg['smtp_port'] = (int) ($cfg['smtp_port'] ?: 465);
    $cfg['smtp_secure'] = strtolower((string) ($cfg['smtp_secure'] ?: 'ssl'));
    if ($cfg['mail_from'] === '') {
        $cfg['mail_from'] = $cfg['smtp_user'] !== '' ? $cfg['smtp_user'] : 'info@go-unlisted.com';
    }
    // Hostinger requires From to match the authenticated mailbox.
    if ($cfg['smtp_user'] !== '') {
        $cfg['mail_from'] = $cfg['smtp_user'];
    }

    return $cfg;
}

function guMailFrom(): string {
    return guMailConfig()['mail_from'];
}

function guSmtpConfigured(): bool {
    $cfg = guMailConfig();
    return $cfg['smtp_host'] !== ''
        && $cfg['smtp_user'] !== ''
        && $cfg['smtp_pass'] !== ''
        && !str_contains((string) $cfg['smtp_pass'], 'YOUR_')
        && !str_contains((string) $cfg['smtp_pass'], 'REPLACE_');
}

function guSmtpEhloHost(array $cfg): string {
    $from = (string) ($cfg['mail_from'] ?? '');
    if (str_contains($from, '@')) {
        return substr($from, strpos($from, '@') + 1);
    }
    return $_SERVER['SERVER_NAME'] ?? 'localhost';
}

function guSmtpRead($socket): string {
    $data = '';
    while ($line = fgets($socket, 515)) {
        $data .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    return $data;
}

function guSmtpCmd($socket, string $cmd, array $expectCodes, string $step = ''): bool {
    if ($cmd !== '') {
        fwrite($socket, $cmd . "\r\n");
    }
    $resp = guSmtpRead($socket);
    $code = (int) substr($resp, 0, 3);
    if (!in_array($code, $expectCodes, true)) {
        if ($step !== '') {
            error_log("SMTP {$step} failed ({$code}): " . trim($resp));
        }
        return false;
    }
    return true;
}

function guSmtpConnect(string $host, int $port, string $secure) {
    $secure = strtolower($secure);
    $transport = $secure === 'ssl' ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
    $ctx = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
        ],
    ]);
    $socket = @stream_socket_client($transport, $errno, $errstr, 25, STREAM_CLIENT_CONNECT, $ctx);
    if (!$socket && $secure === 'ssl') {
        // Some shared hosts have incomplete CA bundles — retry once without peer verify.
        $ctx = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
        $socket = @stream_socket_client($transport, $errno, $errstr, 25, STREAM_CLIENT_CONNECT, $ctx);
    }
    if (!$socket) {
        error_log("SMTP connect failed ({$host}:{$port}/{$secure}): {$errstr} ({$errno})");
        return null;
    }
    stream_set_timeout($socket, 25);
    return $socket;
}

function guSendEmailSmtpWithConfig(string $to, string $subject, string $body, array $cfg): bool {
    $host = (string) $cfg['smtp_host'];
    $user = (string) $cfg['smtp_user'];
    $pass = (string) $cfg['smtp_pass'];
    $from = (string) ($cfg['mail_from'] ?: $user);
    $port = (int) ($cfg['smtp_port'] ?? 465);
    $secure = strtolower((string) ($cfg['smtp_secure'] ?? 'ssl'));
    $ehloHost = guSmtpEhloHost($cfg);

    $socket = guSmtpConnect($host, $port, $secure);
    if (!$socket) {
        return false;
    }

    if (!guSmtpCmd($socket, '', [220], 'greeting')) {
        fclose($socket);
        return false;
    }
    if (!guSmtpCmd($socket, "EHLO {$ehloHost}", [250], 'EHLO')) {
        fclose($socket);
        return false;
    }
    if ($secure === 'tls') {
        if (!guSmtpCmd($socket, 'STARTTLS', [220], 'STARTTLS')) {
            fclose($socket);
            return false;
        }
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            error_log('SMTP TLS handshake failed');
            fclose($socket);
            return false;
        }
        if (!guSmtpCmd($socket, "EHLO {$ehloHost}", [250], 'EHLO after TLS')) {
            fclose($socket);
            return false;
        }
    }
    if (!guSmtpCmd($socket, 'AUTH LOGIN', [334], 'AUTH')) {
        fclose($socket);
        return false;
    }
    if (!guSmtpCmd($socket, base64_encode($user), [334], 'AUTH user')) {
        fclose($socket);
        return false;
    }
    if (!guSmtpCmd($socket, base64_encode($pass), [235], 'AUTH pass')) {
        fclose($socket);
        return false;
    }
    if (!guSmtpCmd($socket, "MAIL FROM:<{$from}>", [250], 'MAIL FROM')) {
        fclose($socket);
        return false;
    }
    if (!guSmtpCmd($socket, "RCPT TO:<{$to}>", [250, 251], 'RCPT TO')) {
        fclose($socket);
        return false;
    }
    if (!guSmtpCmd($socket, 'DATA', [354], 'DATA')) {
        fclose($socket);
        return false;
    }

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $message = implode("\r\n", [
        "From: Go-Unlisted <{$from}>",
        "To: <{$to}>",
        "Subject: {$encodedSubject}",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: Go-Unlisted',
        '',
        $body,
        '',
    ]);
    fwrite($socket, $message . "\r\n.\r\n");
    if (!guSmtpCmd($socket, '', [250], 'message body')) {
        fclose($socket);
        return false;
    }
    guSmtpCmd($socket, 'QUIT', [221]);
    fclose($socket);
    return true;
}

function guSmtpAttempts(): array {
    $cfg = guMailConfig();
    $attempts = [$cfg];
    $host = strtolower((string) ($cfg['smtp_host'] ?? ''));
    if (str_contains($host, 'hostinger')) {
        $alt = $cfg;
        if ((int) ($cfg['smtp_port'] ?? 0) === 465 || ($cfg['smtp_secure'] ?? '') === 'ssl') {
            $alt['smtp_port'] = 587;
            $alt['smtp_secure'] = 'tls';
            $attempts[] = $alt;
        } elseif ((int) ($cfg['smtp_port'] ?? 0) === 587) {
            $alt['smtp_port'] = 465;
            $alt['smtp_secure'] = 'ssl';
            $attempts[] = $alt;
        }
    }
    return $attempts;
}

function guSendEmailSmtp(string $to, string $subject, string $body, string $from): bool {
    $cfg = guMailConfig();
    $cfg['mail_from'] = $from;
    foreach (guSmtpAttempts() as $attempt) {
        if (guSendEmailSmtpWithConfig($to, $subject, $body, $attempt)) {
            return true;
        }
    }
    return false;
}

function guSendEmailPhpMail(string $to, string $subject, string $body, string $from): bool {
    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        "From: Go-Unlisted <{$from}>",
        "Reply-To: {$from}",
        'X-Mailer: Go-Unlisted',
    ]);
    $ok = @mail($to, $subject, $body, $headers);
    if (!$ok) {
        error_log("PHP mail() failed for {$to}");
    }
    return $ok;
}

/** OTP and auth emails — SMTP only (never mail() fallback). */
function guSendEmailForOtp(string $to, string $subject, string $body): bool {
    if (!guSmtpConfigured()) {
        error_log("OTP email blocked for {$to} — SMTP not configured (api/mail_config.php)");
        return false;
    }
    return guSendEmailSmtp($to, $subject, $body, guMailFrom());
}

function guSendEmail(string $to, string $subject, string $body): bool {
    if (guSmtpConfigured()) {
        $ok = guSendEmailSmtp($to, $subject, $body, guMailFrom());
        if ($ok) {
            return true;
        }
        error_log("SMTP send failed for {$to} (host " . guMailConfig()['smtp_host'] . "), falling back to mail()");
    } elseif (!is_readable(__DIR__ . '/mail_config.php')) {
        error_log("SMTP not configured for {$to} — create api/mail_config.php from mail_config.example.php");
    }
    return guSendEmailPhpMail($to, $subject, $body, guMailFrom());
}

function guSendOtpEmail(string $to, string $otp): bool {
    $subject = 'Your Go-Unlisted Verification Code';
    $body = "Welcome to Go-Unlisted!\n\nYour OTP code is: {$otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.\n\nIf you did not request this, ignore this email.\n\n— Go-Unlisted";
    return guSendEmailForOtp($to, $subject, $body);
}

function guMailStatus(): array {
    $cfg = guMailConfig();
    return [
        'smtp_configured' => guSmtpConfigured(),
        'smtp_host' => $cfg['smtp_host'] !== '' ? $cfg['smtp_host'] : null,
        'smtp_port' => $cfg['smtp_port'] ?? null,
        'mail_from' => guMailFrom(),
        'config_file' => is_readable(__DIR__ . '/mail_config.php'),
    ];
}
