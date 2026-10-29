# EventHub — Event Registration Portal

A full-featured event registration web application with real-time seat availability updates, concurrency-safe transactions, digital admission tickets with barcodes, and a comprehensive administrative dashboard.

Built using **Apache (XAMPP)**, **PHP 8 (PDO)**, **PostgreSQL**, **HTML5**, **CSS3**, and modern **vanilla JavaScript (ES6)**.

---

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites & System Requirements](#prerequisites--system-requirements)
- [Setup Guide (Windows + XAMPP)](#setup-guide-windows--xampp)
- [Demo Credentials](#demo-credentials)
- [Project Architecture & Directory Structure](#project-architecture--directory-structure)
- [API Reference](#api-reference)
- [Concurrency & Locking Architecture](#concurrency--locking-architecture)
- [Security & Input Sanitation](#security--input-sanitation)
- [Running the Concurrency Test Suite](#running-the-concurrency-test-suite)
- [Seed Data Events](#seed-data-events)

---

## Key Features

### 1. Interactive Event Discovery (`/index.html`)
- **Event Cards:** Live-rendered cards showing event title, date/time, venue, category chip, description, remaining seats text, capacity count (`registered/capacity`), dynamic colored capacity progress bar, and status badge (`Registered`, `Past`, `Full`, `Few Seats Left`, `Open`).
- **Debounced Search:** Instant client-side search with 300 ms debouncing matching titles, descriptions, and venues.
- **Dynamic Category Filter:** Dropdown populated directly from database categories.
- **Multi-Criteria Sorting:** Sort by Event Date, Title, or Seat Availability.
- **Upcoming Events Toggle:** Custom accessible toggle switch (`role="switch"`, `aria-checked`, keyboard accessible via Space/Enter).
- **Pagination:** Clean page navigation with sliding 5-page window, Next/Prev controls, "Page X of Y" info, and smooth scroll-to-top.
- **Card States & Skeletons:** Animated skeleton cards during loading, with empty and error state screens.

### 2. Single Event View (`/event.html?id=...`)
- Detailed event page displaying venue, category, full description, availability, and capacity bar.
- Direct registration and cancellation controls with inline spinners.
- Dynamic browser document title (`Event Title — EventHub`).

### 3. Smart Background Polling
- Visibility-aware polling (`App.poll`) running every 5 seconds to keep seat counts synchronized in real time.
- Automatically pauses polling when the browser tab is hidden and triggers an immediate refresh upon returning.
- Concurrency-safe: prevents overlapping polling requests and skips cards currently undergoing user mutations (`data-busy`).
- Visual seat-change pulse (`.seat-updated`) highlighting cards when availability changes.

### 4. User Registration Dashboard (`/my-registrations.html`)
- Partitioned tab views: **Upcoming** vs. **Past** registrations with live count indicators and keyboard tab navigation (`aria-selected`).
- **One-Click Cancellation with Enter-Key Confirmation:**
  - Confirmation modal (`App.confirm`) prompts before cancelling.
  - Automatically focuses the "Yes, Cancel" button on modal open.
  - Supports confirming via keyboard `Enter` key or mouse click.
  - Smooth card removal with fade-out animation and automatic empty-state presentation when the list is cleared.
- **Centered Digital Admission Pass Modal (`App.modal`):**
  - Fully centered in the browser viewport across all display sizes with seamless background backdrop dismiss and Escape key listener.
  - Distinctive ticket header band with pass ID badge (e.g. `EH-000042`) and admission status (`Confirmed Admission` vs. `Past Event`).
  - Comprehensive attendee and event metadata (Date & Time, Venue, Attendee Name, Attendee Email, Registered On timestamp, Total & Remaining Capacity, and Event Description).
  - Perforation divider line with circular ticket notches.
  - Mathematically generated algorithmic SVG barcode based on character ASCII values.
  - Native print stylesheet optimization hiding navigation/buttons for clean ticket printing (`window.print()`).

### 5. Authentication & Account Management (`/login.html`, `/signup.html`)
- Declarative client-side validation rules table (name length, email pattern, password complexity with letter + number).
- Inline field error mapping for both client checks and server validation responses (`App.showFieldErrors`).
- Password visibility toggle (Show/Hide).
- Rate limiting protection: restricts failed login attempts to 5 per IP/email pair every 10 minutes (HTTP 429).
- Transparent password hashing upgrades on successful login via `password_needs_rehash`.
- Open-redirect prevention: strict URI validation via `App.safeRedirect` ensuring users only redirect to valid local paths.

### 6. Administrative Dashboard (`/admin.html`)
- Role-based authorization: restricted to users with `admin` role.
- **Overview Stat Cards:** Real-time counters for Total Events, Upcoming Events, Total Registrations, and Full Events.
- **Events Data Table:** Overview of all events with accurate column sizing and status badges.
- **Event Creation & Editing:** Unified modal dialog (`App.modal`) with full field validation.
- **Attendees Roster Modal:** Live list of registered attendees with registered dates and attendee count.
- **Secure CSV Export:** Direct download of attendee lists with formula injection defense (`=`, `+`, `-`, `@`) and Excel UTF-8 BOM.
- **Event Deletion:** Confirmation modal with cascading registration removal.

### 7. Unified Frontend Architecture (`common.js`)
- Zero dependencies: pure vanilla JavaScript (ES6), no jQuery, no libraries, no build tools.
- Centralized `App.api` wrapper handling GET query strings, non-GET JSON serialization, 401 redirect interception, and global error toasts.
- Single floating toast notification system (`App.toast`) replacing legacy in-page alerts.
- Accessible modal system (`App.modal`, `App.confirm`): viewport-centered presentation, backdrop click dismiss, Escape key dismiss, Enter key confirmation on focused confirm actions, and focus management.
- Dynamic navbar builder (`App.init`) with active link highlights and mobile menu toggle.

---

## Tech Stack

- **Backend:** PHP 8.1+ (strict types, PDO, custom JSON REST API)
- **Database:** PostgreSQL 14+ (row-level locking `FOR UPDATE`, transactional integrity, partial unique indexes)
- **Frontend:** HTML5, CSS3 (custom CSS variables & responsive design system), JavaScript (ES6 Plain Vanilla)
- **Web Server:** Apache 2.4 (XAMPP on Windows, mod_rewrite, mod_headers)

---

## Prerequisites & System Requirements

### Required Software
- **XAMPP** with Apache + PHP 8.1+
- **PostgreSQL** 14+ with `psql` CLI on PATH
- **PHP Extensions:** `pdo_pgsql`, `pgsql`, `mbstring`, `curl`

### Verify PHP Extensions
```powershell
C:\xampp\php\php.exe -m | Select-String "pdo_pgsql|pgsql|mbstring|curl"
```

If `pdo_pgsql` is missing, edit `C:\xampp\php\php.ini` and uncomment:
```ini
extension=pdo_pgsql
extension=pgsql
extension=mbstring
extension=curl
```

---

## Setup Guide (Windows + XAMPP)

### 1. Database Setup
Ensure PostgreSQL is running on `localhost:5432`. Then run:

```powershell
# From the project root directory
cd "C:\Users\ASUS\Documents\Sem 5\Web Dev Lab\Event Registration System"
.\scripts\setup_db.ps1
```

Or execute manually:
```powershell
$env:PGPASSWORD = "postgres"
psql -h localhost -p 5432 -U postgres -c "CREATE ROLE eventportal WITH LOGIN PASSWORD 'password';"
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE eventportal OWNER eventportal;"
$env:PGPASSWORD = "password"
psql -h localhost -p 5432 -U eventportal -d eventportal -f sql\schema.sql
psql -h localhost -p 5432 -U eventportal -d eventportal -f sql\seed.sql
```

### 2. Environment Configuration
Copy `.env.example` to `.env` (or verify existing `.env`):
```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eventportal
DB_USER=eventportal
DB_PASS=password
APP_ENV=development
```

### 3. Apache Configuration
Edit `C:\xampp\apache\conf\httpd.conf`:
1. Ensure these modules are enabled (remove leading `#`):
   ```apache
   LoadModule rewrite_module modules/mod_rewrite.so
   LoadModule headers_module modules/mod_headers.so
   ```
2. Ensure `Include conf/extra/httpd-vhosts.conf` is enabled.
3. Edit `C:\xampp\apache\conf\extra\httpd-vhosts.conf` and configure the virtual host:
   ```apache
   <VirtualHost *:8080>
       ServerName localhost
       DocumentRoot "C:/Users/ASUS/Documents/Sem 5/Web Dev Lab\Event Registration System/public"

       <Directory "C:/Users/ASUS/Documents/Sem 5/Web Dev Lab\Event Registration System/public">
           AllowOverride All
           Require all granted
           Options -Indexes +FollowSymLinks
       </Directory>

       ErrorLog "logs/eventportal-error.log"
       CustomLog "logs/eventportal-access.log" combined
   </VirtualHost>
   ```
4. Restart Apache from the XAMPP Control Panel.

### 4. Verification
Open `http://localhost:8080` in your web browser. You should see the EventHub discovery portal.

---

## Demo Credentials

| Email | Password | Role |
|---|---|---|
| alice@example.com | Password1 | User |
| bob@example.com | Password2 | User |
| carol@example.com | Password3 | User |
| admin@example.com | AdminPass1 | Admin |

To create additional administrators from the terminal:
```powershell
C:\xampp\php\php.exe scripts\create_admin.php newadmin@example.com "New Admin"
```

---

## Project Architecture & Directory Structure

```
├── public/                          # Apache DocumentRoot (web-exposed)
│   ├── index.html                   # Event discovery & listing page
│   ├── event.html                   # Single event detail page
│   ├── my-registrations.html        # User registrations & ticket modal
│   ├── login.html                   # User login page
│   ├── signup.html                  # New user registration page
│   ├── admin.html                   # Administrator dashboard
│   ├── .htaccess                    # Security headers & directory protections
│   ├── assets/
│   │   ├── css/style.css            # Complete design system & utility classes
│   │   └── js/                      # Plain ES6 frontend scripts (?v=4 cache-busted)
│   │       ├── common.js            # App namespace, modals, toasts, poll, api wrapper
│   │       ├── events.js            # Discovery page controller, filters, pagination
│   │       ├── event-detail.js      # Single event view & live seat updates
│   │       ├── my-registrations.js  # User dashboard, ticket view, barcode SVG
│   │       ├── auth.js              # Auth forms validation & submissions
│   │       └── admin.js             # Admin dashboard, event CRUD, attendees, CSV
│   └── api/                         # RESTful JSON API endpoints
│       ├── me.php                   # Current authenticated session check
│       ├── login.php                # User login & session creation
│       ├── logout.php               # Session termination
│       ├── signup.php               # Account creation & immediate login
│       ├── events.php               # Event catalog query (filters, sort, pagination)
│       ├── event.php                # Single event details by ID
│       ├── register.php             # Concurrency-safe event registration
│       ├── cancel.php               # Registration cancellation
│       ├── my_registrations.php     # User registrations partitioned (upcoming/past)
│       ├── admin_events.php         # Admin event CRUD actions (create/update/delete)
│       └── admin_attendees.php      # Admin attendee roster & CSV export
├── includes/                        # Backend business logic (outside DocumentRoot)
│   ├── config.php                   # .env parser and environment configurations
│   ├── db.php                       # Database connection singleton (PDO)
│   ├── bootstrap.php                # Session configuration, headers, JSON helpers
│   ├── auth.php                     # Authentication & role-checking helpers
│   ├── validator.php                # Validation routines for users and events
│   └── services/
│       ├── EventService.php         # Event query building, pagination, and mutations
│       └── RegistrationService.php  # Transactional registration & row locking
├── sql/
│   ├── schema.sql                   # Idempotent database schema & indexes
│   └── seed.sql                     # Seed events and demo accounts
├── scripts/
│   ├── setup_db.ps1                 # Database provisioning script
│   ├── create_admin.php             # CLI tool to create admin accounts
│   └── concurrency_test.php         # Concurrency test suite (curl_multi parallel races)
└── apache/
    └── event-portal.conf            # Sample VirtualHost configuration
```

---

## API Reference

All requests and responses communicate via JSON (except file downloads).

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/signup.php` | POST | Public | Creates a user account and establishes a session |
| `/api/login.php` | POST | Public | Authenticates credentials and starts a session |
| `/api/logout.php` | POST | Public | Terminates active session and clears cookies |
| `/api/me.php` | GET | Public | Returns current user profile (HTTP 401 if guest) |
| `/api/events.php` | GET | Public | Lists events with search, category, sort, and pagination |
| `/api/event.php?id=` | GET | Public | Fetches single event metadata and seat availability |
| `/api/register.php` | POST | User | Registers the logged-in user for an event |
| `/api/cancel.php` | POST | User | Cancels an existing active registration |
| `/api/my_registrations.php` | GET | User | Returns user's upcoming and past registrations |
| `/api/admin_events.php` | POST | Admin | Event mutations (`action`: `create`, `update`, `delete`) |
| `/api/admin_attendees.php` | GET | Admin | Event attendee list (supports `format=csv`) |

### Request & Response Standards

- All `POST` endpoints strictly require `Content-Type: application/json`.
- **Success Format:**
  ```json
  { "success": true, "data": { ... }, "message": "Success message." }
  ```
- **Error Format:**
  ```json
  { "success": false, "error": { "code": "ERROR_CODE", "message": "Description of error." } }
  ```

### HTTP Status Codes

| Code | Status | Meaning |
|---|---|---|
| `200` | OK | Successful retrieval or state change |
| `201` | Created | Resource successfully created (Event / Registration / Account) |
| `304` | Not Modified | Conditional polling optimization |
| `400` | Bad Request | Missing required parameters or invalid payload |
| `401` | Unauthorized | Authentication required or invalid credentials |
| `403` | Forbidden | Insufficient permissions (Admin required) |
| `404` | Not Found | Requested event or resource does not exist |
| `405` | Method Not Allowed | Request method is not supported for endpoint |
| `409` | Conflict | Business logic conflict (`FULL`, `DUPLICATE`, `EVENT_PASSED`) |
| `415` | Unsupported Media Type | Non-JSON `POST` request rejected by server safeguard |
| `422` | Unprocessable Entity | Form field validation errors (`fields`: `{ name: "..." }`) |
| `429` | Rate Limited | Too many failed authentication attempts |
| `500` | Server Error | Internal server or database exception |

---

### Why there is no CSRF token

The application relies on two lightweight safeguards instead of synchronizer tokens:
1. **Strict JSON Content-Type requirement:** Every POST endpoint enforces `Content-Type: application/json` at the server level (returning HTTP 415 `UNSUPPORTED_MEDIA_TYPE` otherwise). Standard HTML forms and cross-site requests cannot send JSON payloads without triggering a CORS preflight, effectively preventing cross-site form submissions.
2. **Secure session cookies:** Session cookies are configured with `SameSite=Lax` and `HttpOnly`, ensuring they cannot be accessed by scripts or sent along with cross-site subrequests.

---

## Concurrency & Locking Architecture

To prevent over-registration and race conditions when multiple users simultaneously register for the last seat, EventHub uses a battle-tested transactional architecture:

1. **Row-Level Locking (`SELECT ... FOR UPDATE`):**
   When `RegistrationService::register()` begins, it starts a database transaction and acquires an exclusive row-level lock on the event row:
   ```sql
   SELECT id, capacity, event_date FROM events WHERE id = :id FOR UPDATE;
   ```
   Concurrent requests for the same event are serialized by PostgreSQL until the active transaction commits or rolls back.

2. **Accurate Seat Calculation Inside Transaction:**
   Active registrations are counted under lock:
   ```sql
   SELECT COUNT(*) FROM registrations WHERE event_id = :event_id AND status = 'active';
   ```
   If `count >= capacity`, the transaction immediately rolls back and returns HTTP 409 `FULL`.

3. **Computed Seats (No Drift):**
   Remaining seats are dynamically calculated (`capacity - count`), never stored as a mutable integer counter in the database.

4. **Database-Level Partial Unique Index:**
   To guarantee that no user can ever register twice for the same event (even under high parallel load), the database schema enforces:
   ```sql
   CREATE UNIQUE INDEX uq_active_registration ON registrations(event_id, user_id) WHERE status = 'active';
   ```
   Any simultaneous registration attempt caught by this constraint triggers a `23505` unique violation, which is caught and returned as HTTP 409 `DUPLICATE`.

---

## Security & Input Sanitation

- **SQL Injection Prevention:** All database queries utilize native prepared statements with parameter binding via PDO.
- **XSS Prevention:** All dynamic content is rendered through safe DOM node methods (`.textContent`, `.setAttribute`) rather than raw string concatenation into `innerHTML`.
- **Security Headers (`.htaccess`):**
  - `Content-Security-Policy`: Restricts scripts, styles, fonts, and frame ancestors.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Session Protections:**
  - `HttpOnly` and `SameSite=Lax` cookie flags.
  - Session ID regeneration (`session_regenerate_id(true)`) upon authentication.
  - Automatic idle timeout after 30 minutes of inactivity.
- **CSV Injection Defense:** Attendees exported to CSV have cells starting with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) sanitized with single-quote escaping.

---

## Running the Concurrency Test Suite

EventHub includes an automated multi-threaded test suite that simulates high-concurrency race conditions using `curl_multi`:

```powershell
C:\xampp\php\php.exe scripts\concurrency_test.php http://localhost:8080
```

### What the Test Suite Verifies
1. **Capacity-1 Race (10 users):** 10 concurrent requests race for a single available seat. Asserts that exactly 1 request receives HTTP 201, 9 requests receive HTTP 409 `FULL`, and the database registration count is exactly 1.
2. **Capacity-5 Race (15 users):** 15 concurrent requests race for 5 available seats. Asserts that exactly 5 requests succeed, 10 receive HTTP 409 `FULL`, and the database count is exactly 5.
3. **Duplicate Prevention Race (10 sessions):** Creates a user account once, generates 10 independent authenticated sessions, and fires 10 simultaneous registration requests for the same user. Asserts that exactly 1 request succeeds, 9 receive HTTP 409 `DUPLICATE`, and database count is 1.
4. **Automated Cleanup:** Automatically purges temporary test users (`conctest%`) and test events upon completion.

---

## Seed Data Events

| Event Title | Category | Capacity | Notes |
|---|---|---|---|
| AI & ML Summit 2026 | Technology | 150 | Alice registered |
| Wine Tasting Evening | Food & Drink | 1 | Tests capacity-1 boundary condition |
| Marathon Training Bootcamp | Sports | 40 | Standard open event |
| Startup Pitch Night | Business | 80 | Standard open event |
| Watercolor Workshop | Arts | 20 | Standard open event |
| Cybersecurity Seminar | Technology | 5 | Nearly full (4/5 registered) |
| Jazz Night Under the Stars | Music | 200 | Large capacity event |
| Past Conference on Web Standards | Technology | 100 | Past event (2025) for historical tab verification |
