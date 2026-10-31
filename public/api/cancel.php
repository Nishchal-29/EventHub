<?php
// public/api/cancel.php — Event registration cancellation
require __DIR__ . '/../../includes/common.php';

$user = require_login();
$data = body();
$eventId = filter_var($data['event_id'] ?? null, FILTER_VALIDATE_INT);
if (!$eventId || $eventId < 1) fail('BAD_REQUEST', 'Valid event ID is required.', 400);

$stmt = $pdo->prepare("SELECT event_date FROM events WHERE id = ?");
$stmt->execute([$eventId]);
$event = $stmt->fetch();
if (!$event) fail('NOT_FOUND', 'Event not found.', 404);

if (new DateTimeImmutable($event['event_date']) <= new DateTimeImmutable()) {
    fail('EVENT_PASSED', 'Cannot cancel registration for a past event.', 409);
}

// No transaction or lock is needed because one DELETE is atomic and a cancel only frees seats
$stmt = $pdo->prepare("DELETE FROM registrations WHERE event_id = ? AND user_id = ?");
$stmt->execute([$eventId, $user['id']]);

if ($stmt->rowCount() === 0) {
    fail('NOT_REGISTERED', 'You are not registered for this event.', 409);
}

ok(fetch_events($eventId)[0], 'Registration cancelled.');
