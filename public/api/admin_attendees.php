<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/services/RegistrationService.php';
require_once dirname(__DIR__, 2) . '/includes/services/EventService.php';

require_method('GET');
require_admin();

$eventId = filter_input(INPUT_GET, 'event_id', FILTER_VALIDATE_INT);
if (!$eventId || $eventId < 1) {
    json_error('BAD_REQUEST', 'Valid event_id is required.', 400);
}

// Verify event exists
$db = get_db();
$eventService = new EventService($db);
$event = $eventService->getById($eventId);
if ($event === null) {
    json_error('NOT_FOUND', 'Event not found.', 404);
}

$service = new RegistrationService($db);
$attendees = $service->getAttendees($eventId);

$format = $_GET['format'] ?? 'json';

if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="attendees_event_' . $eventId . '.csv"');
    header('Cache-Control: no-store');

    $out = fopen('php://output', 'w');

    // BOM for Excel UTF-8 compatibility
    fwrite($out, "\xEF\xBB\xBF");

    fputcsv($out, ['Name', 'Email', 'Registered At']);

    foreach ($attendees as $a) {
        // CSV-injection protection: prefix cells that start with =, +, -, @ with a single quote
        $name = $a['name'];
        $email = $a['email'];
        foreach ([&$name, &$email] as &$cell) {
            if (preg_match('/^[=+\-@\t\r]/', $cell)) {
                $cell = "'" . $cell;
            }
        }
        unset($cell);
        fputcsv($out, [$name, $email, $a['registered_at']]);
    }

    fclose($out);
    exit;
}

json_success([
    'event'     => $event,
    'attendees' => $attendees,
]);
