# EventHub — Event Registration Portal

EventHub is an event registration portal designed with reliable concurrency control, dynamic real-time seat availability updates, and administrative management.

Built with **Apache (XAMPP on Windows)**, **PHP 8 (PDO)**, **PostgreSQL**, **HTML5**, **CSS3**, and **vanilla JavaScript (ES6)**.

---

## Setup Guide (Windows + XAMPP + PostgreSQL)

Follow these 6 steps to run the application locally:

### Step 1: Install & Configure PostgreSQL
Ensure PostgreSQL is running locally on port 5432 with a database user `eventportal` (password: `password`) and database `eventportal`:
```powershell
$env:PGPASSWORD = "postgres"
psql -h localhost -p 5432 -U postgres -c "CREATE ROLE eventportal WITH LOGIN PASSWORD 'password';"
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE eventportal OWNER eventportal;"
```

### Step 2: Initialize Database Schema and Seed Data
Run the single rerunnable SQL script:
```powershell
$env:PGPASSWORD = "password"
psql -h localhost -p 5432 -U eventportal -d eventportal -f sql\database.sql
```

### Step 3: Verify PHP PostgreSQL Extension
Ensure `pdo_pgsql` is enabled in `C:\xampp\php\php.ini`:
```ini
extension=pdo_pgsql
extension=pgsql
```

### Step 4: Configure Apache VirtualHost
In `C:\xampp\apache\conf\extra\httpd-vhosts.conf`, add the following VirtualHost snippet:
```apache
<VirtualHost *:8080>
    ServerName localhost
    DocumentRoot "C:/Users/ASUS/Documents/Sem 5/Web Dev Lab/Event Registration System/public"
    <Directory "C:/Users/ASUS/Documents/Sem 5/Web Dev Lab/Event Registration System/public">
        AllowOverride None
        Require all granted
    </Directory>
</VirtualHost>
```

### Step 5: Start Apache
Start Apache from XAMPP Control Panel or command line.

### Step 6: Open the Application
Navigate to `http://localhost:8080` in your web browser.

---

## Demo Accounts

| Name | Email | Password | Role |
|---|---|---|---|
| Alice Johnson | `alice@example.com` | `Password1` | User |
| Bob Williams | `bob@example.com` | `Password2` | User |
| Carol Davis | `carol@example.com` | `Password3` | User |
| Admin User | `admin@example.com` | `AdminPass1` | Admin |

---

## Running the Concurrency Test Suite

An automated parallel test suite verifies concurrency safety using `curl_multi`:
```powershell
php scripts\concurrency_test.php http://localhost:8080
```

The test validates:
1. **Capacity-1 Race (10 users):** Exactly 1 succeeds (HTTP 201), 9 receive HTTP 409 `FULL`, database count is 1.
2. **Capacity-5 Race (15 users):** Exactly 5 succeed (HTTP 201), 10 receive HTTP 409 `FULL`, database count is 5.
3. **Duplicate Prevention Race (10 sessions):** Same user fires 10 simultaneous requests from 10 distinct sessions; exactly 1 succeeds, 9 receive HTTP 409 `DUPLICATE`, database count is 1.

---

## How Duplicates and Over-Capacity Are Prevented

1. **Row-Level Locking (`SELECT ... FOR UPDATE`):**
   In `public/api/register.php`, registrations execute inside a transaction. The event row is selected with `FOR UPDATE`. When multiple users register simultaneously for the same event, PostgreSQL serializes their transactions. Each request waits for the preceding transaction to commit or roll back before reading capacity and registration counts.

2. **Database-Level Partial Unique Constraint:**
   The `registrations` table enforces a `UNIQUE (event_id, user_id)` constraint. Even under massive parallel load across multiple processes, the database engine guarantees that no user can ever register twice. Any concurrent insert attempt triggers PostgreSQL error `23505`, which is caught and returned as HTTP 409 `DUPLICATE`.

3. **Remaining Seats Computed with COUNT (No Drift):**
   Remaining seats are never stored as a mutable counter column. Instead, availability is computed dynamically as `capacity - COUNT(registrations)` directly in the central SQL query, preventing counter drift and desynchronization.

4. **SameSite Cookies + JSON-Only POST Safeguards:**
   Instead of synchronizer tokens, the application enforces two clean browser-level protections:
   - Session cookies are configured with `SameSite=Lax` and `HttpOnly`.
   - Every POST endpoint enforces `Content-Type: application/json` (returning HTTP 415 `UNSUPPORTED_MEDIA_TYPE` otherwise). Cross-site HTML forms cannot send JSON bodies without browser preflight checks.

---

## Project Structure

```
public/
  index.html, event.html, login.html, signup.html, my-registrations.html, admin.html
  assets/css/style.css
  assets/vendor/jquery-3.7.1.min.js
  assets/js/
    common.js           # App namespace, modals, toasts, poll, api wrapper
    events.js           # Discovery feed, live capacity bars, registration actions
    event-detail.js     # Single event view and seat polling
    auth.js             # Client validation, signup and login handlers
    my-registrations.js # Upcoming/Past tabs with cancellation
    admin.js            # Admin dashboard, event creation, deletion, attendees
  api/
    auth.php            # Session check (GET), signup, login, logout (POST)
    events.php          # Public catalog (GET all or GET ?id=)
    register.php        # Transactional registration with row locking (POST)
    cancel.php          # Registration cancellation (POST)
    my_registrations.php# User registrations split by date (GET)
    admin.php           # Admin attendees query (GET), create & delete (POST)
includes/
  common.php            # Database connection, auth checks, response helpers, event queries
sql/
  database.sql          # Idempotent schema definition and seed data
scripts/
  concurrency_test.php  # Automated race condition and duplicate prevention suite
README.md
```
