<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/services/EventService.php';

require_method('GET');

$db = get_db();
$eventService = new EventService($db);
$user = current_user();
$userId = $user ? $user['id'] : null;

$filters = [
    'q'        => $_GET['q'] ?? '',
    'category' => $_GET['category'] ?? '',
    'from'     => $_GET['from'] ?? '',
    'to'       => $_GET['to'] ?? '',
    'upcoming' => $_GET['upcoming'] ?? '',
    'sort'     => $_GET['sort'] ?? 'date',
    'page'     => $_GET['page'] ?? '1',
    'per_page' => $_GET['per_page'] ?? '12',
];

$result = $eventService->list($filters, $userId);

// ETag based on seat data for conditional polling
$seatHash = md5(json_encode(array_map(function ($e) {
    return $e['id'] . ':' . $e['registered_count'] . ':' . $e['remaining_seats'];
}, $result['events'])));

$etag = '"' . $seatHash . '"';
header('ETag: ' . $etag);

$ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
if ($ifNoneMatch === $etag) {
    http_response_code(304);
    exit;
}

json_success([
    'events'     => $result['events'],
    'pagination' => $result['pagination'],
    'categories' => $eventService->getCategories(),
]);
