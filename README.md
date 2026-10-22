# EventHub — Event Registration Portal

A full-featured event registration web application with real-time seat updates, concurrency-safe registration, and an admin dashboard.

## Tech Stack

- **Backend:** PHP 8.1+ (plain PHP, PDO)
- **Database:** PostgreSQL 14+
- **Frontend:** HTML5, CSS3, JavaScript (ES6), jQuery 3.7.1
- **Web Server:** Apache 2.4 (XAMPP)

## Prerequisites

### Required Software
- **XAMPP** with Apache + PHP 8.1+ (or standalone Apache + PHP)
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

## Setup Guide (Windows + XAMPP)

### 1. Database Setup

Ensure PostgreSQL is running on `localhost:5432`. Then run:

```powershell
# From the project root directory
cd "C:\Users\ASUS\Documents\Sem 5\Web Dev Lab\Event Registration System"
.\scripts\setup_db.ps1
```

Or manually:
```powershell
$env:PGPASSWORD = "postgres"
psql -h localhost -p 5432 -U postgres -c "CREATE ROLE eventportal WITH LOGIN PASSWORD 'password';"
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE eventportal OWNER eventportal;"
$env:PGPASSWORD = "password"
psql -h localhost -p 5432 -U eventportal -d eventportal -f sql\schema.sql
psql -h localhost -p 5432 -U eventportal -d eventportal -f sql\seed.sql
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and adjust values if needed:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eventportal
DB_USER=eventportal
DB_PASS=password
APP_ENV=development
```

### 3. Apache Configuration

Edit `C:\xampp\apache\conf\httpd.conf`:

1. Ensure these modules are uncommented (remove the `#`):
   ```
   LoadModule rewrite_module modules/mod_rewrite.so
   LoadModule headers_module modules/mod_headers.so
   ```

2. Ensure `Include conf/extra/httpd-vhosts.conf` is uncommented.

3. Edit `C:\xampp\apache\conf\extra\httpd-vhosts.conf` and add:
   ```apache
   <VirtualHost *:8080>
       ServerName localhost
       DocumentRoot "C:/Users/ASUS/Documents/Sem 5/Web Dev Lab/Event Registration System/public"

       <Directory "C:/Users/ASUS/Documents/Sem 5/Web Dev Lab/Event Registration System/public">
           AllowOverride All
           Require all granted
           Options -Indexes +FollowSymLinks
       </Directory>

       ErrorLog "logs/eventportal-error.log"
       CustomLog "logs/eventportal-access.log" combined
   </VirtualHost>
   ```

4. Restart Apache from the XAMPP Control Panel.

### 4. Verify

Open `http://localhost:8080` in your browser. You should see the EventHub event listing page.

## Demo Credentials

| Email | Password | Role |
|---|---|---|
| alice@example.com | Password1 | User |
| bob@example.com | Password2 | User |
| carol@example.com | Password3 | User |
| admin@example.com | AdminPass1 | Admin |

### Creating Additional Admins

```powershell
C:\xampp\php\php.exe scripts\create_admin.php newadmin@example.com "New Admin"
```

## Project Structure

```
├── public/                      # Apache DocumentRoot (web-exposed)
│   ├── index.html               # Event listing page
│   ├── event.html               # Event detail page
│   ├── my-registrations.html    # User's registrations
│   ├── login.html / signup.html # Auth pages
│   ├── admin.html               # Admin dashboard
│   ├── .htaccess                # Security headers, directory protection
│   ├── assets/
│   │   ├── css/style.css        # Complete design system
│   │   ├── js/                  # Page-specific JS modules
│   │   └── vendor/              # jQuery 3.7.1 (vendored)
│   └── api/                     # JSON API endpoints
├── includes/                    # PHP includes (outside DocumentRoot)
│   ├── config.php               # .env parser + config
│   ├── db.php                   # PDO singleton
│   ├── bootstrap.php            # Session, headers, error handling
│   ├── auth.php                 # Auth helpers
│   ├── csrf.php                 # CSRF token gen/verify
│   ├── validator.php            # Input validation
│   └── services/
│       ├── EventService.php     # Event CRUD + listing
│       └── RegistrationService.php  # Transactional register/cancel
├── sql/
│   ├── schema.sql               # Idempotent schema
│   └── seed.sql                 # Demo data
├── scripts/
│   ├── setup_db.ps1             # Database setup
│   ├── create_admin.php         # CLI admin creation
│   └── concurrency_test.php     # Concurrency test suite
└── apache/
    └── event-portal.conf        # VirtualHost sample
```

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/csrf.php` | GET | No | Get CSRF token |
| `/api/signup.php` | POST | No | Create account |
| `/api/login.php` | POST | No | Log in |
| `/api/logout.php` | POST | No | Log out |
| `/api/me.php` | GET | No | Current user (401 if not logged in) |
| `/api/events.php` | GET | No | List events (filters, pagination, ETag) |
| `/api/event.php?id=` | GET | No | Single event detail |
| `/api/register.php` | POST | Yes | Register for event |
| `/api/cancel.php` | POST | Yes | Cancel registration |
| `/api/my_registrations.php` | GET | Yes | User's registrations |
| `/api/admin_events.php` | POST | Admin | Create/update/delete events |
| `/api/admin_attendees.php` | GET | Admin | Event attendees (JSON or CSV) |

### Request/Response Format

**All POST endpoints** require the `X-CSRF-Token` header (obtained from `/api/csrf.php`).

**Success response:**
```json
{ "success": true, "data": {...}, "message": "..." }
```

**Error response:**
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

### Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 304 | Not Modified (ETag match) |
| 400 | Bad request |
| 401 | Not authenticated |
| 403 | Forbidden / CSRF failure |
| 404 | Not found |
| 405 | Method not allowed |
| 409 | Conflict: `DUPLICATE`, `FULL`, `NOT_REGISTERED`, `EVENT_PASSED`, `CAPACITY_BELOW_REGISTRATIONS` |
| 422 | Validation errors (per-field) |
| 429 | Rate limited |
| 500 | Internal error |

## Architecture Notes

### Concurrency Safety

Registration concurrency is guaranteed by a multi-layered approach:

1. **Row-level locking:** `SELECT ... FOR UPDATE` on the event row inside a transaction serializes concurrent registrations for the same event. Only one transaction can proceed at a time per event.

2. **Application-level check:** Inside the transaction, we count active registrations and reject if `count >= capacity`.

3. **Partial unique index:** `CREATE UNIQUE INDEX uq_active_registration ON registrations(event_id, user_id) WHERE status='active'` provides a database-level safety net against duplicate active registrations, even if the application check is somehow bypassed.

4. **Remaining seats are always computed** (`capacity - COUNT(active)`) rather than stored as a counter, so they cannot drift out of sync.

### Session Security

- `HttpOnly`, `SameSite=Lax`, `Secure` (when HTTPS) cookies
- `session_regenerate_id(true)` on login
- Full session destruction on logout
- 30-minute idle timeout
- Strict mode enabled

### XSS Prevention

- All dynamic content is inserted via jQuery's `.text()` method
- Security headers: CSP, X-Content-Type-Options, X-Frame-Options
- No inline scripts or `eval()`

## Running the Concurrency Test

```powershell
C:\xampp\php\php.exe scripts\concurrency_test.php http://localhost:8080
```

This creates temporary test users and events, fires parallel requests using `curl_multi`, and verifies:
1. **Capacity-1 event:** Exactly 1 of N users succeeds, rest get `409 FULL`
2. **Capacity-5 event:** Exactly 5 of N users succeed, rest get `409 FULL`
3. **Duplicate prevention:** Same user firing 10 simultaneous requests → exactly 1 succeeds

Run it at least 3 times to verify consistency.

## Seed Data Events

| Event | Category | Capacity | Notes |
|---|---|---|---|
| AI & ML Summit 2026 | Technology | 150 | Alice registered |
| Wine Tasting Evening | Food & Drink | 1 | Tests capacity-1 edge case |
| Marathon Training Bootcamp | Sports | 40 | Standard event |
| Startup Pitch Night | Business | 80 | Standard event |
| Watercolor Workshop | Arts | 20 | Standard event |
| Cybersecurity Seminar | Technology | 5 | Nearly full (4/5 registered) |
| Jazz Night Under the Stars | Music | 200 | Large capacity |
| Past Conference on Web Standards | Technology | 100 | Past event (2025) |
