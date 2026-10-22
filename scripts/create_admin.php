<?php
declare(strict_types=1);

/**
 * CLI script to create an admin user.
 * Usage: php scripts\create_admin.php admin@example.com "Admin Name"
 * Will prompt for password interactively.
 */

if (php_sapi_name() !== 'cli') {
    die("This script must be run from the command line.\n");
}

// Bootstrap for DB access
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';

if ($argc < 3) {
    echo "Usage: php create_admin.php <email> <name>\n";
    echo "Example: php create_admin.php admin@example.com \"Admin User\"\n";
    exit(1);
}

$email = mb_strtolower(trim($argv[1]));
$name = trim($argv[2]);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo "Error: Invalid email address.\n";
    exit(1);
}

if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
    echo "Error: Name must be between 2 and 100 characters.\n";
    exit(1);
}

// Prompt for password
echo "Enter password (min 8 chars, at least one letter and one number): ";

// Try to hide input on Windows
if (PHP_OS_FAMILY === 'Windows') {
    // Read from stdin
    $password = trim((string) fgets(STDIN));
} else {
    system('stty -echo');
    $password = trim((string) fgets(STDIN));
    system('stty echo');
    echo "\n";
}

if (strlen($password) < 8) {
    echo "Error: Password must be at least 8 characters.\n";
    exit(1);
}
if (!preg_match('/[A-Za-z]/', $password)) {
    echo "Error: Password must contain at least one letter.\n";
    exit(1);
}
if (!preg_match('/[0-9]/', $password)) {
    echo "Error: Password must contain at least one number.\n";
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$db = get_db();

try {
    $stmt = $db->prepare(
        "INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :hash, 'admin')
         ON CONFLICT (LOWER(email)) DO UPDATE SET role = 'admin', name = :name2, password_hash = :hash2"
    );
    $stmt->execute([
        'name'  => $name,
        'email' => $email,
        'hash'  => $hash,
        'name2' => $name,
        'hash2' => $hash,
    ]);

    echo "Admin user created/updated: $email ($name)\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
