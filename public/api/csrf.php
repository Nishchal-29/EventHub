<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/csrf.php';

require_method('GET');

json_success(['token' => csrf_generate()]);
