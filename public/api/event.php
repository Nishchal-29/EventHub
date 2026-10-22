<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/services/EventService.php';

require_method('GET');

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$id || $id < 1) {
    json_error('BAD_REQUEST', 'Valid event ID is required.', 400);
}

$db = get_db();
$eventService = new EventService($db);
$user = current_user();
$userId = $user ? $user['id'] : null;

$event = $eventService->getById($id, $userId);
if ($event === null) {
    json_error('NOT_FOUND', 'Event not found.', 404);
}

json_success($event);
