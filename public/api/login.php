<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/csrf.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';

require_method('POST');
csrf_verify(false);

$data = get_json_body();

$email    = mb_strtolower(trim($data['email'] ?? ''));
$password = $data['password'] ?? '';

if ($email === '' || $password === '') {
    json_error('BAD_REQUEST', 'Email and password are required.', 400);
}

$db = get_db();
$ip = get_client_ip();

// Brute-force protection: 5 failures per IP+email in 10 minutes
$stmt = $db->prepare(
    "SELECT COUNT(*) FROM login_attempts
     WHERE ip_address = :ip AND LOWER(email) = :email AND attempted_at > NOW() - INTERVAL '10 minutes'"
);
$stmt->execute(['ip' => $ip, 'email' => $email]);
$attempts = (int) $stmt->fetchColumn();

if ($attempts >= 5) {
    json_error('RATE_LIMITED', 'Too many login attempts. Please try again in a few minutes.', 429);
}

// Look up user
$stmt = $db->prepare("SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = :email");
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    // Record failed attempt
    $stmt = $db->prepare("INSERT INTO login_attempts (ip_address, email) VALUES (:ip, :email)");
    $stmt->execute(['ip' => $ip, 'email' => $email]);

    json_error('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
}

// Rehash if needed (transparent upgrade of hash algorithm)
if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
    $newHash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare("UPDATE users SET password_hash = :hash WHERE id = :id");
    $stmt->execute(['hash' => $newHash, 'id' => $user['id']]);
}

// Clear failed attempts on successful login
$stmt = $db->prepare("DELETE FROM login_attempts WHERE ip_address = :ip AND LOWER(email) = :email");
$stmt->execute(['ip' => $ip, 'email' => $email]);

$user['id'] = (int) $user['id'];
set_session_user($user);

json_success([
    'id'    => $user['id'],
    'name'  => $user['name'],
    'email' => $user['email'],
    'role'  => $user['role'],
], 'Login successful.');
