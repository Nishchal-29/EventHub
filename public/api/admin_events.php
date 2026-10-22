<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/csrf.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/validator.php';
require_once dirname(__DIR__, 2) . '/includes/services/EventService.php';

require_method('POST');
csrf_verify();
$user = require_admin();

$data = get_json_body();
$action = $data['action'] ?? '';

$db = get_db();
$eventService = new EventService($db);

switch ($action) {
    case 'create':
        $errors = validate_event_fields($data);
        if (!empty($errors)) {
            json_validation_error($errors);
        }
        $event = $eventService->create($data, $user['id']);
        json_success($event, 'Event created successfully.', 201);
        break;

    case 'update':
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            json_error('BAD_REQUEST', 'Valid event ID is required.', 400);
        }
        $errors = validate_event_fields($data);
        if (!empty($errors)) {
            json_validation_error($errors);
        }
        $event = $eventService->update($id, $data);
        json_success($event, 'Event updated successfully.');
        break;

    case 'delete':
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            json_error('BAD_REQUEST', 'Valid event ID is required.', 400);
        }
        $eventService->delete($id);
        json_success(null, 'Event deleted successfully.');
        break;

    default:
        json_error('BAD_REQUEST', 'Invalid action. Must be create, update, or delete.', 400);
}
