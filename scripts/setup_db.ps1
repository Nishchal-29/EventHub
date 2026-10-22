# Event Registration Portal — Database Setup (PowerShell)
# Usage: .\scripts\setup_db.ps1
# Requires: psql on PATH, PostgreSQL running on localhost:5432

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbName = "eventportal",
    [string]$DbUser = "eventportal",
    [string]$DbPass = "password"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Event Portal — Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Set PGPASSWORD for non-interactive auth
$env:PGPASSWORD = "postgres"

Write-Host "`n[1/4] Creating database role '$DbUser'..." -ForegroundColor Yellow
$roleExists = & psql -h $DbHost -p $DbPort -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'" 2>$null
if ($roleExists -eq "1") {
    Write-Host "  Role '$DbUser' already exists, skipping." -ForegroundColor Gray
} else {
    & psql -h $DbHost -p $DbPort -U postgres -c "CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPass';"
    Write-Host "  Role '$DbUser' created." -ForegroundColor Green
}

Write-Host "`n[2/4] Creating database '$DbName'..." -ForegroundColor Yellow
$dbExists = & psql -h $DbHost -p $DbPort -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>$null
if ($dbExists -eq "1") {
    Write-Host "  Database '$DbName' already exists, skipping." -ForegroundColor Gray
} else {
    & psql -h $DbHost -p $DbPort -U postgres -c "CREATE DATABASE $DbName OWNER $DbUser;"
    Write-Host "  Database '$DbName' created." -ForegroundColor Green
}

# Grant privileges
& psql -h $DbHost -p $DbPort -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;" 2>$null

# Switch to the eventportal user
$env:PGPASSWORD = $DbPass

Write-Host "`n[3/4] Applying schema..." -ForegroundColor Yellow
& psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f "$ProjectRoot\sql\schema.sql"
Write-Host "  Schema applied." -ForegroundColor Green

Write-Host "`n[4/4] Applying seed data..." -ForegroundColor Yellow
& psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f "$ProjectRoot\sql\seed.sql"
Write-Host "  Seed data applied." -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Database setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Demo credentials:" -ForegroundColor White
Write-Host "  alice@example.com   / Password1  (user)" -ForegroundColor Gray
Write-Host "  bob@example.com     / Password2  (user)" -ForegroundColor Gray
Write-Host "  carol@example.com   / Password3  (user)" -ForegroundColor Gray
Write-Host "  admin@example.com   / AdminPass1 (admin)" -ForegroundColor Gray

# Clean up
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
