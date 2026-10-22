<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';

require_method('GET');

$user = current_user();
if ($user === null) {
    json_error('UNAUTHORIZED', 'Not authenticated.', 401);
}

json_success($user);
