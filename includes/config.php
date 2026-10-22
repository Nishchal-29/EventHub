<?php
declare(strict_types=1);

/**
 * Configuration: reads from .env file (parsed manually) with fallback to
 * real environment variables. No Composer needed.
 */

(function (): void {
    // Look for .env in the project root (one level above public/)
    $envFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
    if (!isset($_ENV['_ENV_LOADED']) && file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines !== false) {
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                $eqPos = strpos($line, '=');
                if ($eqPos === false) {
                    continue;
                }
                $key = trim(substr($line, 0, $eqPos));
                $value = trim(substr($line, $eqPos + 1));
                // Strip surrounding quotes
                if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
                    $value = substr($value, 1, -1);
                }
                $_ENV[$key] = $value;
                putenv("$key=$value");
            }
        }
        $_ENV['_ENV_LOADED'] = '1';
    }
})();

function env(string $key, string $default = ''): string
{
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

define('DB_HOST', env('DB_HOST', 'localhost'));
define('DB_PORT', env('DB_PORT', '5432'));
define('DB_NAME', env('DB_NAME', 'eventportal'));
define('DB_USER', env('DB_USER', 'eventportal'));
define('DB_PASS', env('DB_PASS', 'password'));
define('APP_ENV', env('APP_ENV', 'production'));
define('IS_DEV', APP_ENV === 'development');
