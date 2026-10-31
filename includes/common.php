<?php
// includes/common.php — Shared DB, auth, helpers, and event queries (local demo only)
ini_set('display_errors', '0');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
if (PHP_SAPI !== 'cli') {
    session_start();
    header('Content-Type: application/json; charset=utf-8');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        $ct = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
        if (stripos(trim($ct), 'application/json') !== 0) {
            fail('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.', 415);
        }
    }
}

// Local demo credentials
$pdo = new PDO('pgsql:host=localhost;port=5432;dbname=eventportal', 'eventportal', 'password', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);

function ok(mixed $data = null, string $message = '', int $status = 200): void {
    http_response_code($status);
    $res = ['success' => true];
    if ($data !== null) $res['data'] = $data;
    if ($message !== '') $res['message'] = $message;
    echo json_encode($res);
    exit;
}

function fail(string $code, string $message, int $status = 400, ?array $fields = null): void {
    http_response_code($status);
    $err = ['code' => $code, 'message' => $message];
    if ($fields !== null) $err['fields'] = $fields;
    echo json_encode(['success' => false, 'error' => $err]);
    exit;
}

function body(): array {
    return json_decode(file_get_contents('php://input') ?: '', true) ?? [];
}

function require_login(): array {
    $u = $_SESSION['user'] ?? null;
    if (!$u) fail('UNAUTHORIZED', 'Authentication required.', 401);
    return $u;
}

function require_admin(): array {
    $u = require_login();
    if ($u['role'] !== 'admin') fail('FORBIDDEN', 'Admin access required.', 403);
    return $u;
}

// Single source of truth for event data and seat availability
function fetch_events(?int $eventId = null): array {
    global $pdo;
    $uid = (int)($_SESSION['user']['id'] ?? 0);
    $where = $eventId ? "WHERE e.id = :id " : "";
    $stmt = $pdo->prepare("SELECT e.id, e.title, e.description, e.venue, e.event_date, e.capacity,
                                  COUNT(r.id) AS registered_count,
                                  e.capacity - COUNT(r.id) AS remaining_seats,
                                  COALESCE(BOOL_OR(r.user_id = :uid), false) AS user_registered
                           FROM events e LEFT JOIN registrations r ON r.event_id = e.id
                           $where GROUP BY e.id ORDER BY e.event_date");
    $params = ['uid' => $uid];
    if ($eventId) $params['id'] = $eventId;
    $stmt->execute($params);

    $rows = [];
    $now = new DateTimeImmutable();
    foreach ($stmt->fetchAll() as $row) {
        $dt = new DateTimeImmutable($row['event_date']);
        $rem = (int)$row['remaining_seats'];
        $row['id'] = (int)$row['id'];
        $row['capacity'] = (int)$row['capacity'];
        $row['registered_count'] = (int)$row['registered_count'];
        $row['remaining_seats'] = $rem;
        $row['user_registered'] = (bool)$row['user_registered'];
        $row['event_date'] = $dt->format(DateTimeInterface::ATOM);
        $row['status'] = ($dt <= $now) ? 'past' : ($rem <= 0 ? 'full' : 'open');
        $rows[] = $row;
    }
    return $rows;
}
