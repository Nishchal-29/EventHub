<?php
// public/api/my_registrations.php — List user registrations split into upcoming and past
require __DIR__ . '/../../includes/common.php';

$user = require_login();

$stmt = $pdo->prepare("SELECT r.event_id, e.title, e.venue, e.event_date, r.registered_at
                       FROM registrations r
                       JOIN events e ON e.id = r.event_id
                       WHERE r.user_id = ?
                       ORDER BY e.event_date ASC");
$stmt->execute([$user['id']]);

$upcoming = [];
$past = [];
$now = new DateTimeImmutable();

foreach ($stmt->fetchAll() as $row) {
    $dt = new DateTimeImmutable($row['event_date']);
    $item = [
        'event_id'      => (int)$row['event_id'],
        'title'         => $row['title'],
        'venue'         => $row['venue'],
        'event_date'    => $dt->format(DateTimeInterface::ATOM),
        'registered_at' => (new DateTimeImmutable($row['registered_at']))->format(DateTimeInterface::ATOM),
    ];
    if ($dt > $now) {
        $upcoming[] = $item;
    } else {
        $past[] = $item;
    }
}

ok(['upcoming' => $upcoming, 'past' => $past]);
