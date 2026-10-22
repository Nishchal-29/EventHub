<?php
declare(strict_types=1);

/**
 * Input validation helpers — returns associative arrays of field errors.
 */

function validate_name(string $name): array
{
    $errors = [];
    $name = trim($name);
    if ($name === '') {
        $errors['name'] = 'Name is required.';
    } elseif (mb_strlen($name) < 2) {
        $errors['name'] = 'Name must be at least 2 characters.';
    } elseif (mb_strlen($name) > 100) {
        $errors['name'] = 'Name must be at most 100 characters.';
    }
    return $errors;
}

function validate_email_field(string $email): array
{
    $errors = [];
    $email = trim($email);
    if ($email === '') {
        $errors['email'] = 'Email is required.';
    } elseif (mb_strlen($email) > 150) {
        $errors['email'] = 'Email must be at most 150 characters.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Please enter a valid email address.';
    }
    return $errors;
}

function validate_password(string $password): array
{
    $errors = [];
    if (strlen($password) < 8) {
        $errors['password'] = 'Password must be at least 8 characters.';
    } elseif (!preg_match('/[A-Za-z]/', $password)) {
        $errors['password'] = 'Password must contain at least one letter.';
    } elseif (!preg_match('/[0-9]/', $password)) {
        $errors['password'] = 'Password must contain at least one number.';
    }
    return $errors;
}

function validate_event_fields(array $data): array
{
    $errors = [];

    $title = trim($data['title'] ?? '');
    if ($title === '') {
        $errors['title'] = 'Title is required.';
    } elseif (mb_strlen($title) > 200) {
        $errors['title'] = 'Title must be at most 200 characters.';
    }

    $eventDate = trim($data['event_date'] ?? '');
    if ($eventDate === '') {
        $errors['event_date'] = 'Event date is required.';
    } else {
        $dt = DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $eventDate);
        if (!$dt) {
            // Also accept datetime-local format from HTML forms
            $dt = DateTimeImmutable::createFromFormat('Y-m-d\TH:i', $eventDate);
            if (!$dt) {
                $dt = DateTimeImmutable::createFromFormat('Y-m-d\TH:i:s', $eventDate);
            }
        }
        if (!$dt) {
            $errors['event_date'] = 'Please enter a valid date and time.';
        }
    }

    $capacity = $data['capacity'] ?? '';
    if ($capacity === '' || $capacity === null) {
        $errors['capacity'] = 'Capacity is required.';
    } else {
        $cap = filter_var($capacity, FILTER_VALIDATE_INT);
        if ($cap === false || $cap < 1 || $cap > 100000) {
            $errors['capacity'] = 'Capacity must be an integer between 1 and 100,000.';
        }
    }

    if (isset($data['venue']) && mb_strlen(trim($data['venue'])) > 200) {
        $errors['venue'] = 'Venue must be at most 200 characters.';
    }

    if (isset($data['category']) && mb_strlen(trim($data['category'])) > 50) {
        $errors['category'] = 'Category must be at most 50 characters.';
    }

    return $errors;
}
