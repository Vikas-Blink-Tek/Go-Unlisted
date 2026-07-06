<?php
/**
 * Load GU_* variables from repo-root .env.local (local dev + optional production file).
 * Hostinger: copy api/mail_config.example.php → mail_config.php instead if .env is unavailable.
 */
function guLoadDotEnvFile(string $path): void {
    if (!is_readable($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if ($key === '' || getenv($key) !== false) {
            continue;
        }
        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"'))
            || (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
    }
}

$root = dirname(__DIR__);
guLoadDotEnvFile($root . '/.env.local');
guLoadDotEnvFile(__DIR__ . '/.env.local');
