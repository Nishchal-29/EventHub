<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/services/RegistrationService.php';

require_method('POST');
$user = require_login();

$data = get_json_body();
$eventId = filter_var($data['event_id'] ?? null, FILTER_VALIDATE_INT);

if (!$eventId || $eventId < 1) {
    json_error('BAD_REQUEST', 'Valid event ID is required.', 400);
}

$db = get_db();
$service = new RegistrationService($db);
$result = $service->register($user['id'], $eventId);

json_success($result, 'Successfully registered for the event.', 201);
