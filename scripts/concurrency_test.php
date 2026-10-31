<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    die("This script must be run from the command line.\n");
}

require __DIR__ . '/../includes/common.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost:8080', '/');

echo "========================================\n";
echo " Concurrency Test Suite\n";
echo " Base URL: $baseUrl\n";
echo "========================================\n\n";

$allPassed = true;

function extractCookies(string $headers): string {
    preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $headers, $matches);
    $cookies = [];
    foreach ($matches[1] ?? [] as $part) {
        $eq = strpos($part, '=');
        if ($eq !== false) {
            $name = trim(substr($part, 0, $eq));
            $cookies[$name] = trim(substr($part, $eq + 1));
        }
    }
    $parts = [];
    foreach ($cookies as $k => $v) $parts[] = "$k=$v";
    return implode('; ', $parts);
}

function createTestUser(string $baseUrl, string $name, string $email, string $password): ?array {
    $ch = curl_init("$baseUrl/api/auth.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['action' => 'signup', 'name' => $name, 'email' => $email, 'password' => $password]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $res = curl_exec($ch);
    $size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($res, 0, $size);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code >= 200 && $code < 300) {
        return ['cookies' => extractCookies($headers)];
    }
    return loginUser($baseUrl, $email, $password);
}

function loginUser(string $baseUrl, string $email, string $password): ?array {
    $ch = curl_init("$baseUrl/api/auth.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['action' => 'login', 'email' => $email, 'password' => $password]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $res = curl_exec($ch);
    $size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($res, 0, $size);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200) {
        return ['cookies' => extractCookies($headers)];
    }
    return null;
}

function createTestEvent(string $title, int $capacity): int {
    global $pdo;
    $stmt = $pdo->prepare("INSERT INTO events (title, description, venue, event_date, capacity)
                           VALUES (?, 'Test event', 'Test Venue', NOW() + INTERVAL '30 days', ?) RETURNING id");
    $stmt->execute([$title, $capacity]);
    return (int)$stmt->fetchColumn();
}

function deleteTestEvent(int $eventId): void {
    global $pdo;
    $pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$eventId]);
}

function getDbRegCount(int $eventId): int {
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM registrations WHERE event_id = ?");
    $stmt->execute([$eventId]);
    return (int)$stmt->fetchColumn();
}

function fireConcurrentRegistrations(string $baseUrl, array $sessions, int $eventId): array {
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
                'Accept: application/json',
                'Cookie: ' . $session['cookies'],
            ],
            CURLOPT_TIMEOUT => 15,
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
    foreach ($handles as $ch) {
        $body = curl_multi_getcontent($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $results[] = [
            'http_code' => $code,
            'body'      => json_decode($body ?: '', true) ?? [],
        ];
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    return $results;
}

try {
    // ── TEST 1: N users racing for capacity-1 event ─────────────────────────
    echo "TEST 1: N users racing for a capacity-1 event\n";
    echo str_repeat('-', 50) . "\n";
    $event1 = createTestEvent('Concurrency Test Cap-1 ' . time(), 1);

    $sessions1 = [];
    for ($i = 1; $i <= 10; $i++) {
        $email = "conctest1_u{$i}_" . time() . "@test.com";
        $s = createTestUser($baseUrl, "Test User $i", $email, "TestPass1");
        if ($s) $sessions1[] = $s;
    }

    echo "  Created " . count($sessions1) . " test users.\n";
    echo "  Firing 10 simultaneous registrations for event $event1 (capacity=1)...\n";
    $results1 = fireConcurrentRegistrations($baseUrl, $sessions1, $event1);

    $success1 = 0;
    $full1 = 0;
    foreach ($results1 as $r) {
        if ($r['http_code'] >= 200 && $r['http_code'] < 300) $success1++;
        elseif ($r['http_code'] === 409 && ($r['body']['error']['code'] ?? '') === 'FULL') $full1++;
    }
    $dbCount1 = getDbRegCount($event1);
    echo "  Results: $success1 succeeded, $full1 got FULL, DB count=$dbCount1\n";

    if ($success1 === 1 && $full1 === 9 && $dbCount1 === 1) {
        echo "  ✅ PASS\n\n";
    } else {
        echo "  ❌ FAIL (expected 1 success, 9 FULL, DB count 1)\n\n";
        $allPassed = false;
    }
    deleteTestEvent($event1);

    // ── TEST 2: N users racing for capacity-5 event ─────────────────────────
    echo "TEST 2: N users racing for a capacity-5 event\n";
    echo str_repeat('-', 50) . "\n";
    $event2 = createTestEvent('Concurrency Test Cap-5 ' . time(), 5);

    $sessions2 = [];
    for ($i = 1; $i <= 15; $i++) {
        $email = "conctest2_u{$i}_" . time() . "@test.com";
        $s = createTestUser($baseUrl, "Test User $i", $email, "TestPass1");
        if ($s) $sessions2[] = $s;
    }

    echo "  Created " . count($sessions2) . " test users.\n";
    echo "  Firing 15 simultaneous registrations for event $event2 (capacity=5)...\n";
    $results2 = fireConcurrentRegistrations($baseUrl, $sessions2, $event2);

    $success2 = 0;
    $full2 = 0;
    foreach ($results2 as $r) {
        if ($r['http_code'] >= 200 && $r['http_code'] < 300) $success2++;
        elseif ($r['http_code'] === 409 && ($r['body']['error']['code'] ?? '') === 'FULL') $full2++;
    }
    $dbCount2 = getDbRegCount($event2);
    echo "  Results: $success2 succeeded, $full2 got FULL, DB count=$dbCount2\n";

    if ($success2 === 5 && $full2 === 10 && $dbCount2 === 5) {
        echo "  ✅ PASS\n\n";
    } else {
        echo "  ❌ FAIL (expected 5 successes, 10 FULL, DB count 5)\n\n";
        $allPassed = false;
    }
    deleteTestEvent($event2);

    // ── TEST 3: Same user fires 10 simultaneous registrations ────────────────
    echo "TEST 3: Same user fires 10 simultaneous registrations (duplicate prevention)\n";
    echo str_repeat('-', 50) . "\n";
    $event3 = createTestEvent('Concurrency Test Dup ' . time(), 50);

    $dupEmail = "conctest3_dup_" . time() . "@test.com";
    createTestUser($baseUrl, "Dup User", $dupEmail, "TestPass1");

    $dupSessions = [];
    for ($i = 0; $i < 10; $i++) {
        $s = loginUser($baseUrl, $dupEmail, "TestPass1");
        if ($s) $dupSessions[] = $s;
    }

    $n = count($dupSessions);
    echo "  Firing $n simultaneous registrations from the same user (separate sessions)...\n";
    $results3 = fireConcurrentRegistrations($baseUrl, $dupSessions, $event3);

    $success3 = 0;
    $dup3 = 0;
    foreach ($results3 as $r) {
        if ($r['http_code'] >= 200 && $r['http_code'] < 300) $success3++;
        elseif ($r['http_code'] === 409 && ($r['body']['error']['code'] ?? '') === 'DUPLICATE') $dup3++;
    }
    $dbCount3 = getDbRegCount($event3);
    echo "  Results: $success3 succeeded, $dup3 got DUPLICATE, DB count=$dbCount3\n";

    if ($success3 === 1 && $dup3 === ($n - 1) && $dbCount3 === 1) {
        echo "  ✅ PASS\n\n";
    } else {
        echo "  ❌ FAIL (expected 1 success, " . ($n - 1) . " DUPLICATE, DB count 1)\n\n";
        $allPassed = false;
    }
    deleteTestEvent($event3);
} finally {
    // ── Clean up all test data even after failures ──────────────────────────
    try {
        $pdo->exec("DELETE FROM registrations WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'conctest%')");
        $pdo->exec("DELETE FROM registrations WHERE event_id IN (SELECT id FROM events WHERE title LIKE 'Concurrency Test%')");
        $pdo->exec("DELETE FROM users WHERE email LIKE 'conctest%'");
        $pdo->exec("DELETE FROM events WHERE title LIKE 'Concurrency Test%'");
    } catch (\Throwable $e) {}
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
