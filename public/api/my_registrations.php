<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/services/RegistrationService.php';

require_method('GET');
$user = require_login();

$db = get_db();
$service = new RegistrationService($db);
$result = $service->getUserRegistrations($user['id']);

json_success($result);
