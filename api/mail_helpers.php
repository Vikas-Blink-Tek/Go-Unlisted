<?php
/**
 * Email delivery for OTP and notifications.
 * Configure via GU_SMTP_* in .env.local, or api/mail_config.php on Hostinger.
 * Local dev: OTP is also returned in API as dev_otp when GU_DEV_MODE=1 or localhost.
 */

function guMailConfig(): array {
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $cfg = [
        'smtp_host' => getenv('GU_SMTP_HOST') ?: '',
        'smtp_port' => (int) (getenv('GU_SMTP_PORT') ?: 465),
        'smtp_secure' => strtolower(getenv('GU_SMTP_SECURE') ?: 'ssl'),
        'smtp_user' => getenv('GU_SMTP_USER') ?: '',
        'smtp_pass' => getenv('GU_SMTP_PASS') ?: '',
        'mail_from' => getenv('GU_MAIL_FROM') ?: getenv('GU_SMTP_FROM') ?: '',
    ];
    $localFile = __DIR__ . '/mail_config.php';
    if (is_readable($localFile)) {
        $fileCfg = require $localFile;
        if (is_array($fileCfg)) {
            foreach ($fileCfg as $key => $value) {
                if ($value !== '' && $value !== null && ($cfg[$key] ?? '') === '') {
                    $cfg[$key] = $value;
                }
            }
        }
    }
    if ($cfg['mail_from'] === '') {
        $cfg['mail_from'] = $cfg['smtp_user'] !== '' ? $cfg['smtp_user'] : 'info@go-unlisted.com';
    }
    return $cfg;
}

function guMailFrom(): string {
    return guMailConfig()['mail_from'];
}

function guSmtpConfigured(): bool {
    $cfg = guMailConfig();
    return $cfg['smtp_host'] !== '' && $cfg['smtp_user'] !== '' && $cfg['smtp_pass'] !== '';
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

function guSendEmailSmtp(string $to, string $subject, string $body, string $from): bool {
    $cfg = guMailConfig();
    $host = $cfg['smtp_host'];
    $user = $cfg['smtp_user'];
    $pass = $cfg['smtp_pass'];
    $port = (int) $cfg['smtp_port'];
    $secure = strtolower($cfg['smtp_secure'] ?: 'ssl');

    $transport = $secure === 'ssl' ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
    $socket = @stream_socket_client($transport, $errno, $errstr, 20);
    if (!$socket) {
        error_log("SMTP connect failed ({$host}:{$port}): {$errstr} ({$errno})");
        return false;
    }
    stream_set_timeout($socket, 20);

    if (!guSmtpCmd($socket, '', [220], 'greeting')) {
        fclose($socket);
        return false;
    }
    $ehloHost = $_SERVER['SERVER_NAME'] ?? 'localhost';
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

    $message = implode("\r\n", [
        "From: Go-Unlisted <{$from}>",
        "To: <{$to}>",
        "Subject: {$subject}",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
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

function guSendEmail(string $to, string $subject, string $body): bool {
    $from = guMailFrom();
    if (guSmtpConfigured()) {
        $ok = guSendEmailSmtp($to, $subject, $body, $from);
        if ($ok) {
            return true;
        }
        error_log("SMTP send failed for {$to}, falling back to mail()");
    }
    return guSendEmailPhpMail($to, $subject, $body, $from);
}

function guSendOtpEmail(string $to, string $otp): bool {
    $subject = 'Your Go-Unlisted Verification Code';
    $body = "Welcome to Go-Unlisted!\n\nYour OTP code is: {$otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.\n\n— Go-Unlisted";
    return guSendEmail($to, $subject, $body);
}

function guMailStatus(): array {
    $cfg = guMailConfig();
    return [
        'smtp_configured' => guSmtpConfigured(),
        'smtp_host' => $cfg['smtp_host'] !== '' ? $cfg['smtp_host'] : null,
        'mail_from' => guMailFrom(),
    ];
}
