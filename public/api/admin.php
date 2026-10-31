<?php
// public/api/admin.php — Admin operations: attendees query (GET), create & delete events (POST)
require __DIR__ . '/../../includes/common.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $eventId = filter_var($_GET['attendees'] ?? null, FILTER_VALIDATE_INT);
    if (!$eventId || $eventId < 1) fail('BAD_REQUEST', 'Valid event ID is required.', 400);

    $stmt = $pdo->prepare("SELECT u.name, u.email, r.registered_at
                           FROM registrations r JOIN users u ON u.id = r.user_id
                           WHERE r.event_id = ? ORDER BY r.registered_at ASC");
    $stmt->execute([$eventId]);
    $attendees = array_map(function ($r) {
        $r['registered_at'] = (new DateTimeImmutable($r['registered_at']))->format(DateTimeInterface::ATOM);
        return $r;
    }, $stmt->fetchAll());

    ok(['attendees' => $attendees]);
}

$data = body();
$action = $data['action'] ?? '';

if ($action === 'create') {
    $title = trim($data['title'] ?? '');
    $date = trim($data['event_date'] ?? '');
    $cap = filter_var($data['capacity'] ?? null, FILTER_VALIDATE_INT);
    $fields = [];

    if ($title === '') $fields['title'] = 'Title is required.';
    if ($date === '') $fields['event_date'] = 'Event date is required.';
    if ($cap === false || $cap < 1 || $cap > 100000) $fields['capacity'] = 'Capacity must be 1 to 100,000.';
    if (!empty($fields)) fail('VALIDATION', 'Validation failed.', 422, $fields);

    $stmt = $pdo->prepare("INSERT INTO events (title, description, venue, event_date, capacity)
                           VALUES (?, ?, ?, ?, ?) RETURNING id");
    $stmt->execute([$title, trim($data['description'] ?? ''), trim($data['venue'] ?? ''), $date, $cap]);
    $newId = (int)$stmt->fetchColumn();

    ok(fetch_events($newId)[0], 'Event created successfully.', 201);
}

if ($action === 'delete') {
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id || $id < 1) fail('BAD_REQUEST', 'Valid event ID is required.', 400);

    $pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$id]);
    ok(null, 'Event deleted successfully.');
}

fail('BAD_REQUEST', 'Invalid action.', 400);
