<?php
declare(strict_types=1);

/**
 * CSRF protection: per-session token verified with hash_equals.
 */

function csrf_generate(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_verify(bool $strict = true): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($token === '') {
        $token = $_SERVER['HTTP_X_XSRF_TOKEN'] ?? '';
    }
    if ($token === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $val) {
            if (strcasecmp($key, 'X-CSRF-Token') === 0 || strcasecmp($key, 'X-XSRF-Token') === 0) {
                $token = $val;
                break;
            }
        }
    }
    if ($token === '' && isset($_POST['csrf_token'])) {
        $token = (string) $_POST['csrf_token'];
    }

    // In non-strict mode (signup/login guest flow), allow if no session exists yet and no token provided
    if (!$strict && empty($_SESSION['csrf_token']) && $token === '') {
        return;
    }

    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        json_error('CSRF_FAILURE', 'Invalid or missing CSRF token.', 403);
    }
}
