<?php
// public/api/events.php — Public event catalog: single event or full list with seat math
require __DIR__ . '/../../includes/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    fail('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
}

if (isset($_GET['id'])) {
    $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
    if (!$id || $id < 1) fail('BAD_REQUEST', 'Valid event ID is required.', 400);

    $events = fetch_events($id);
    if (empty($events)) fail('NOT_FOUND', 'Event not found.', 404);
    ok($events[0]);
}

ok(['events' => fetch_events()]);
