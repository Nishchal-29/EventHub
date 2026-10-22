<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/auth.php';

require_method('POST');

destroy_session();

json_success(null, 'Logged out successfully.');
