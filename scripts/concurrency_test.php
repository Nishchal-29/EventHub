<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    die("This script must be run from the command line.\n");
}

$baseUrl = $argv[1] ?? 'http://localhost:8080';
$baseUrl = rtrim($baseUrl, '/');

echo "========================================\n";
echo " Concurrency Test Suite\n";
echo " Base URL: $baseUrl\n";
echo "========================================\n\n";

$allPassed = true;

function createTestUser(string $baseUrl, string $email, string $name, string $password): ?array
{
    $ch = curl_init("$baseUrl/api/csrf.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    curl_close($ch);

    preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $headers, $matches);
    $cookies = implode('; ', $matches[1] ?? []);

    $data = json_decode($body, true);
    $csrfToken = $data['data']['token'] ?? '';

    if (!$csrfToken) {
        echo "  [ERROR] Failed to get CSRF token for $email\n";
        return null;
    }

    $ch = curl_init("$baseUrl/api/signup.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['name' => $name, 'email' => $email, 'password' => $password]),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-CSRF-Token: ' . $csrfToken,
            'Cookie: ' . $cookies,
        ],
        CURLOPT_HEADER => true,
    ]);
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $headers, $matches);
    if (!empty($matches[1])) {
        $cookies = implode('; ', $matches[1]);
    }

    $result = json_decode($body, true);
    if ($httpCode === 201 || ($httpCode === 409 && ($result['error']['code'] ?? '') === 'DUPLICATE')) {
        if ($httpCode === 409) {
            $ch = curl_init("$baseUrl/api/csrf.php");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HEADER => true,
                CURLOPT_HTTPHEADER => ['Cookie: ' . $cookies],
            ]);
            $response = curl_exec($ch);
            $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $headers = substr($response, 0, $headerSize);
            $body = substr($response, $headerSize);
            curl_close($ch);

            preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $headers, $matches);
            if (!empty($matches[1])) $cookies = implode('; ', $matches[1]);
            $data = json_decode($body, true);
            $csrfToken = $data['data']['token'] ?? '';

            $ch = curl_init("$baseUrl/api/login.php");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode(['email' => $email, 'password' => $password]),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'X-CSRF-Token: ' . $csrfToken,
                    'Cookie: ' . $cookies,
                ],
                CURLOPT_HEADER => true,
            ]);
            $response = curl_exec($ch);
            $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $headers = substr($response, 0, $headerSize);
            curl_close($ch);

            preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $headers, $matches);
            if (!empty($matches[1])) $cookies = implode('; ', $matches[1]);
        }

        return ['cookies' => $cookies, 'csrf' => $csrfToken];
    }

    echo "  [ERROR] Failed to create user $email (HTTP $httpCode): $body\n";
    return null;
}

function loginUser(string $baseUrl, string $email, string $password): ?array
{
    $ch = curl_init("$baseUrl/api/csrf.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
    ]);
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    curl_close($ch);

    preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $headers, $matches);
    $cookies = implode('; ', $matches[1] ?? []);
    $data = json_decode($body, true);
    $csrfToken = $data['data']['token'] ?? '';

    $ch = curl_init("$baseUrl/api/login.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['email' => $email, 'password' => $password]),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-CSRF-Token: ' . $csrfToken,
            'Cookie: ' . $cookies,
        ],
        CURLOPT_HEADER => true,
    ]);
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $headers, $matches);
    if (!empty($matches[1])) $cookies = implode('; ', $matches[1]);

    if ($httpCode === 200) {
        return ['cookies' => $cookies, 'csrf' => $csrfToken];
    }

    echo "  [ERROR] Login failed for $email (HTTP $httpCode): $body\n";
    return null;
}

function fireConcurrentRegistrations(string $baseUrl, array $sessions, int $eventId): array
{
    $mh = curl_multi_init();
    $handles = [];

    foreach ($sessions as $i => $session) {
        $ch = curl_init("$baseUrl/api/register.php");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['event_id' => $eventId]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-CSRF-Token: ' . $session['csrf'],
                'Cookie: ' . $session['cookies'],
            ],
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$i] = $ch;
    }

    $running = null;
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh);
    } while ($running > 0);

    $results = [];
    foreach ($handles as $i => $ch) {
        $body = curl_multi_getcontent($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $results[] = [
            'http_code' => $httpCode,
            'body' => json_decode($body, true) ?? [],
        ];
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }

    curl_multi_close($mh);
    return $results;
}

function cleanupRegistrations(string $baseUrl, array $sessions, int $eventId): void
{
    foreach ($sessions as $session) {
        $ch = curl_init("$baseUrl/api/cancel.php");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['event_id' => $eventId]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-CSRF-Token: ' . $session['csrf'],
                'Cookie: ' . $session['cookies'],
            ],
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
}

function getDbRegCount(int $eventId): int
{
    require_once __DIR__ . '/../includes/config.php';
    require_once __DIR__ . '/../includes/db.php';
    $db = get_db();
    $stmt = $db->prepare("SELECT COUNT(*) FROM registrations WHERE event_id = :eid AND status = 'active'");
    $stmt->execute(['eid' => $eventId]);
    return (int) $stmt->fetchColumn();
}

function createTestEvent(string $baseUrl, string $title, int $capacity): ?int
{
    $adminSession = loginUser($baseUrl, 'admin@example.com', 'AdminPass1');
    if (!$adminSession) {
        echo "  [ERROR] Cannot log in as admin to create test event.\n";
        return null;
    }

    $ch = curl_init("$baseUrl/api/admin_events.php");
    $futureDate = (new DateTimeImmutable('+30 days'))->format('Y-m-d\TH:i');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'action' => 'create',
            'title' => $title,
            'description' => 'Test event for concurrency testing',
            'venue' => 'Test Venue',
            'category' => 'Test',
            'event_date' => $futureDate,
            'capacity' => $capacity,
        ]),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-CSRF-Token: ' . $adminSession['csrf'],
            'Cookie: ' . $adminSession['cookies'],
        ],
    ]);
    $body = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($body, true);
    if ($httpCode === 201 && !empty($result['data']['id'])) {
        return (int) $result['data']['id'];
    }

    echo "  [ERROR] Failed to create test event (HTTP $httpCode): $body\n";
    return null;
}

function deleteTestEvent(string $baseUrl, int $eventId): void
{
    $adminSession = loginUser($baseUrl, 'admin@example.com', 'AdminPass1');
    if (!$adminSession) return;

    $ch = curl_init("$baseUrl/api/admin_events.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['action' => 'delete', 'id' => $eventId]),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-CSRF-Token: ' . $adminSession['csrf'],
            'Cookie: ' . $adminSession['cookies'],
        ],
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// TEST 1: N users racing for capacity-1 event → exactly 1 succeeds
echo "TEST 1: N users racing for a capacity-1 event\n";
echo str_repeat('-', 50) . "\n";

$numUsers = 10;
$testEventId1 = createTestEvent($baseUrl, 'Concurrency Test Cap-1 ' . time(), 1);

if ($testEventId1 === null) {
    echo "  SKIP: Could not create test event.\n\n";
    $allPassed = false;
} else {
    $sessions1 = [];
    for ($i = 1; $i <= $numUsers; $i++) {
        $email = "conctest1_user{$i}_" . time() . "@test.com";
        $session = createTestUser($baseUrl, $email, "Test User $i", "TestPass1");
        if ($session) {
            $sessions1[] = $session;
        }
    }

    echo "  Created " . count($sessions1) . " test users.\n";
    echo "  Firing $numUsers simultaneous registrations for event $testEventId1 (capacity=1)...\n";

    $results1 = fireConcurrentRegistrations($baseUrl, $sessions1, $testEventId1);

    $successes1 = 0;
    $fullErrors1 = 0;
    foreach ($results1 as $r) {
        if ($r['http_code'] === 201) {
            $successes1++;
        } elseif ($r['http_code'] === 409 && ($r['body']['error']['code'] ?? '') === 'FULL') {
            $fullErrors1++;
        }
    }

    $dbCount1 = getDbRegCount($testEventId1);

    echo "  Results: $successes1 succeeded, $fullErrors1 got FULL, DB count=$dbCount1\n";

    if ($successes1 === 1 && $fullErrors1 === ($numUsers - 1) && $dbCount1 === 1) {
        echo "  ✅ PASS\n\n";
    } else {
        echo "  ❌ FAIL (expected 1 success, " . ($numUsers - 1) . " FULL, DB count 1)\n\n";
        $allPassed = false;
    }

    deleteTestEvent($baseUrl, $testEventId1);
}

// TEST 2: N users racing for capacity-5 event → exactly 5 succeed
echo "TEST 2: N users racing for a capacity-5 event\n";
echo str_repeat('-', 50) . "\n";

$numUsers2 = 15;
$testEventId2 = createTestEvent($baseUrl, 'Concurrency Test Cap-5 ' . time(), 5);

if ($testEventId2 === null) {
    echo "  SKIP: Could not create test event.\n\n";
    $allPassed = false;
} else {
    $sessions2 = [];
    for ($i = 1; $i <= $numUsers2; $i++) {
        $email = "conctest2_user{$i}_" . time() . "@test.com";
        $session = createTestUser($baseUrl, $email, "Test User $i", "TestPass1");
        if ($session) {
            $sessions2[] = $session;
        }
    }

    echo "  Created " . count($sessions2) . " test users.\n";
    echo "  Firing $numUsers2 simultaneous registrations for event $testEventId2 (capacity=5)...\n";

    $results2 = fireConcurrentRegistrations($baseUrl, $sessions2, $testEventId2);

    $successes2 = 0;
    $fullErrors2 = 0;
    foreach ($results2 as $r) {
        if ($r['http_code'] === 201) {
            $successes2++;
        } elseif ($r['http_code'] === 409 && ($r['body']['error']['code'] ?? '') === 'FULL') {
            $fullErrors2++;
        }
    }

    $dbCount2 = getDbRegCount($testEventId2);

    echo "  Results: $successes2 succeeded, $fullErrors2 got FULL, DB count=$dbCount2\n";

    if ($successes2 === 5 && $fullErrors2 === ($numUsers2 - 5) && $dbCount2 === 5) {
        echo "  ✅ PASS\n\n";
    } else {
        echo "  ❌ FAIL (expected 5 successes, " . ($numUsers2 - 5) . " FULL, DB count 5)\n\n";
        $allPassed = false;
    }

    deleteTestEvent($baseUrl, $testEventId2);
}

// TEST 3: Same user fires 10 simultaneous registrations → exactly 1 succeeds
echo "TEST 3: Same user fires 10 simultaneous registrations (duplicate prevention)\n";
echo str_repeat('-', 50) . "\n";

$testEventId3 = createTestEvent($baseUrl, 'Concurrency Test Dup ' . time(), 50);

if ($testEventId3 === null) {
    echo "  SKIP: Could not create test event.\n\n";
    $allPassed = false;
} else {
    $dupEmail = "conctest3_dup_" . time() . "@test.com";

    $firstSession = createTestUser($baseUrl, $dupEmail, "Dup Test User", "TestPass1");

    $dupSessions = [];
    if ($firstSession) {
        for ($i = 0; $i < 10; $i++) {
            $s = loginUser($baseUrl, $dupEmail, 'TestPass1');
            if ($s) $dupSessions[] = $s;
        }
    }

    if (count($dupSessions) < 2) {
        echo "  SKIP: Could not create enough sessions for the test user.\n\n";
        $allPassed = false;
    } else {
        $n = count($dupSessions);
        echo "  Firing $n simultaneous registrations from the same user (separate sessions)...\n";

        $results3 = fireConcurrentRegistrations($baseUrl, $dupSessions, $testEventId3);

        $successes3 = 0;
        $duplicates3 = 0;
        foreach ($results3 as $r) {
            if ($r['http_code'] >= 200 && $r['http_code'] < 300) {
                $successes3++;
            } elseif ($r['http_code'] === 409 && ($r['body']['error']['code'] ?? '') === 'DUPLICATE') {
                $duplicates3++;
            }
        }

        $dbCount3 = getDbRegCount($testEventId3);
        echo "  Results: $successes3 succeeded, $duplicates3 got DUPLICATE, DB count=$dbCount3\n";

        if ($successes3 === 1 && $duplicates3 === $n - 1 && $dbCount3 === 1) {
            echo "  ✅ PASS\n\n";
        } else {
            echo "  ❌ FAIL (expected 1 success, " . ($n - 1) . " DUPLICATE, DB count 1)\n\n";
            $allPassed = false;
        }
    }

    deleteTestEvent($baseUrl, $testEventId3);   
}

echo "========================================\n";
if ($allPassed) {
    echo "  ALL TESTS PASSED ✅\n";
    echo "========================================\n";
    exit(0);
} else {
    echo "  SOME TESTS FAILED ❌\n";
    echo "========================================\n";
    exit(1);
}