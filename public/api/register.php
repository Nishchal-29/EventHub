<?php
// public/api/register.php — Concurrency-safe event registration with row-level locking
require __DIR__ . '/../../includes/common.php';

$user = require_login();
$data = body();
$eventId = filter_var($data['event_id'] ?? null, FILTER_VALIDATE_INT);
if (!$eventId || $eventId < 1) fail('BAD_REQUEST', 'Valid event ID is required.', 400);

$pdo->beginTransaction();
try {
    // Row-level lock: concurrent requests for the same event queue here to prevent overselling
    $stmt = $pdo->prepare("SELECT capacity, event_date FROM events WHERE id = ?");
    $stmt->execute([$eventId]);
    $event = $stmt->fetch();
    if (!$event) {
        $pdo->rollBack();
        fail('NOT_FOUND', 'Event not found.', 404);
    }

    if (new DateTimeImmutable($event['event_date']) <= new DateTimeImmutable()) {
        $pdo->rollBack();
        fail('EVENT_PASSED', 'This event has already passed.', 409);
    }

    $stmt = $pdo->prepare("SELECT id FROM registrations WHERE event_id = ? AND user_id = ?");
    $stmt->execute([$eventId, $user['id']]);
    if ($stmt->fetch()) {
        $pdo->rollBack();
        fail('DUPLICATE', 'You are already registered for this event.', 409);
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM registrations WHERE event_id = ?");
    $stmt->execute([$eventId]);
    if ((int)$stmt->fetchColumn() >= (int)$event['capacity']) {
        $pdo->rollBack();
        fail('FULL', 'This event is full. No seats remaining.', 409);
    }

    $pdo->prepare("INSERT INTO registrations (event_id, user_id) VALUES (?, ?)")
        ->execute([$eventId, $user['id']]);
    $pdo->commit();

    ok(fetch_events($eventId)[0], 'Registered successfully.', 201);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e->getCode() === '23505') {
        fail('DUPLICATE', 'You are already registered for this event.', 409);
    }
    fail('SERVER_ERROR', 'Registration failed.', 500);
}
