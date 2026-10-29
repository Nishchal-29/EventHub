<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/validator.php';

require_method('POST');

$data = get_json_body();

$name     = trim($data['name'] ?? '');
$email    = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

// Validate
$errors = array_merge(
    validate_name($name),
    validate_email_field($email),
    validate_password($password)
);

if (!empty($errors)) {
    json_validation_error($errors);
}

$emailNormalized = mb_strtolower($email);
$hash = password_hash($password, PASSWORD_DEFAULT);

$db = get_db();

try {
    $stmt = $db->prepare(
        "INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :hash, 'user') RETURNING id, name, email, role"
    );
    $stmt->execute([
        'name'  => $name,
        'email' => $emailNormalized,
        'hash'  => $hash,
    ]);
    $user = $stmt->fetch();
    $user['id'] = (int) $user['id'];

    // Log the user in immediately
    set_session_user($user);

    json_success([
        'id'    => $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],
    ], 'Account created successfully.', 201);
} catch (PDOException $e) {
    // Duplicate email (unique index violation)
    if ($e->getCode() === '23505') {
        json_error('DUPLICATE', 'An account with this email already exists.', 409);
    }
    throw $e;
}
