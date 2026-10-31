<?php
// public/api/auth.php — Authentication endpoint: session check (GET), signup, login, logout (POST)
require __DIR__ . '/../../includes/common.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (empty($_SESSION['user'])) fail('UNAUTHORIZED', 'Not authenticated.', 401);
    ok($_SESSION['user']);
}

$data = body();
$action = $data['action'] ?? '';

if ($action === 'signup') {
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $fields = [];

    if (mb_strlen($name) < 2 || mb_strlen($name) > 100) $fields['name'] = 'Name must be 2-100 characters.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $fields['email'] = 'Valid email is required.';
    if (strlen($password) < 8 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        $fields['password'] = 'Password must be >= 8 characters with letters and numbers.';
    }
    if (!empty($fields)) fail('VALIDATION', 'Validation failed.', 422, $fields);

    try {
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, role");
        $stmt->execute([$name, strtolower($email), password_hash($password, PASSWORD_DEFAULT)]);
        $res = $stmt->fetch();
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => (int)$res['id'], 'name' => $name, 'email' => strtolower($email), 'role' => $res['role']];
        ok($_SESSION['user'], 'Account created successfully.', 201);
    } catch (PDOException $e) {
        if ($e->getCode() === '23505') fail('DUPLICATE', 'An account with this email already exists.', 409);
        throw $e;
    }
}

if ($action === 'login') {
    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';
    $stmt = $pdo->prepare("SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        fail('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }
    session_regenerate_id(true);
    $_SESSION['user'] = ['id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']];
    ok($_SESSION['user'], 'Login successful.');
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    ok(null, 'Logged out successfully.');
}

fail('BAD_REQUEST', 'Invalid action.', 400);
