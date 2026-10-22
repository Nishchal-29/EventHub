<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// ── Error handling ──────────────────────────────────────────────────────
if (!IS_DEV) {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

set_exception_handler(function (Throwable $e): void {
    error_log('Uncaught exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode([
        'success' => false,
        'error' => ['code' => 'SERVER_ERROR', 'message' => 'An internal server error occurred.'],
    ]);
    exit;
});

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// ── Session configuration ───────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isSecure,
        'httponly'  => true,
        'samesite'  => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '1800'); // 30 minutes
    session_start();

    // Idle timeout: destroy session after 30 minutes of inactivity
    if (isset($_SESSION['_last_activity']) && (time() - $_SESSION['_last_activity']) > 1800) {
        session_unset();
        session_destroy();
        session_start();
    }
    $_SESSION['_last_activity'] = time();
}

// ── Response helpers ────────────────────────────────────────────────────
function json_success(mixed $data = null, string $message = '', int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $response = ['success' => true];
    if ($data !== null) {
        $response['data'] = $data;
    }
    if ($message !== '') {
        $response['message'] = $message;
    }
    echo json_encode($response);
    exit;
}

function json_error(string $code, string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'success' => false,
        'error'   => ['code' => $code, 'message' => $message],
    ]);
    exit;
}

function json_validation_error(array $errors): never
{
    http_response_code(422);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'success' => false,
        'error'   => ['code' => 'VALIDATION', 'message' => 'Validation failed.', 'fields' => $errors],
    ]);
    exit;
}

// ── Request helpers ─────────────────────────────────────────────────────
function require_method(string ...$methods): void
{
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        json_error('METHOD_NOT_ALLOWED', "Method $method not allowed.", 405);
    }
}

function get_json_body(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            json_error('BAD_REQUEST', 'Invalid JSON body.', 400);
        }
        return $data;
    }
    // Also accept form-encoded
    if (stripos($contentType, 'application/x-www-form-urlencoded') !== false || stripos($contentType, 'multipart/form-data') !== false) {
        return $_POST;
    }
    // For requests with no body, return empty array
    return [];
}

function get_client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
