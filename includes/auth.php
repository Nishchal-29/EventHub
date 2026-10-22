<?php
declare(strict_types=1);

/**
 * Authentication helpers. All rely on session data set during login.
 */

function current_user(): ?array
{
    if (isset($_SESSION['user_id'])) {
        return [
            'id'    => (int) $_SESSION['user_id'],
            'name'  => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role'  => $_SESSION['user_role'],
        ];
    }
    return null;
}

function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        json_error('UNAUTHORIZED', 'Authentication required.', 401);
    }
    return $user;
}

function require_admin(): array
{
    $user = require_login();
    if ($user['role'] !== 'admin') {
        json_error('FORBIDDEN', 'Admin access required.', 403);
    }
    return $user;
}

function set_session_user(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['user_id']    = $user['id'];
    $_SESSION['user_name']  = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role']  = $user['role'];
}

function destroy_session(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
    session_destroy();
}
