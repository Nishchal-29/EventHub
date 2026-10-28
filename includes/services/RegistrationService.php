<?php
declare(strict_types=1);

class RegistrationService
{
    private PDO $db;
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function register(int $userId, int $eventId): array
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT id, capacity, event_date FROM events WHERE id = :id FOR UPDATE");
            $stmt->execute(['id' => $eventId]);
            $event = $stmt->fetch();

            if (!$event) {
                $this->db->rollBack();
                json_error('NOT_FOUND', 'Event not found.', 404);
            }

            $eventDate = new DateTimeImmutable($event['event_date']);
            if ($eventDate <= new DateTimeImmutable()) {
                $this->db->rollBack();
                json_error('EVENT_PASSED', 'This event has already passed.', 409);
            }

            $stmt = $this->db->prepare(
                "SELECT id FROM registrations WHERE event_id = :event_id AND user_id = :user_id AND status = 'active'"
            );
            $stmt->execute(['event_id' => $eventId, 'user_id' => $userId]);
            if ($stmt->fetch()) {
                $this->db->rollBack();
                json_error('DUPLICATE', 'You are already registered for this event.', 409);
            }

            $stmt = $this->db->prepare(
                "SELECT COUNT(*) FROM registrations WHERE event_id = :event_id AND status = 'active'"
            );
            $stmt->execute(['event_id' => $eventId]);
            $activeCount = (int) $stmt->fetchColumn();

            if ($activeCount >= (int) $event['capacity']) {
                $this->db->rollBack();
                json_error('FULL', 'This event is full. No seats remaining.', 409);
            }

            // usleep(300000);

            $stmt = $this->db->prepare(
                "INSERT INTO registrations (event_id, user_id, status) VALUES (:event_id, :user_id, 'active')"
            );
            $stmt->execute(['event_id' => $eventId, 'user_id' => $userId]);

            $this->db->commit();

            return $this->getEventCounts($eventId, $userId);
        } catch (\PDOException $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($e->getCode() === '23505') {
                json_error('DUPLICATE', 'You are already registered for this event.', 409);
            }
            throw $e;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function cancel(int $userId, int $eventId): array
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT id, event_date FROM events WHERE id = :id FOR UPDATE");
            $stmt->execute(['id' => $eventId]);
            $event = $stmt->fetch();

            if (!$event) {
                $this->db->rollBack();
                json_error('NOT_FOUND', 'Event not found.', 404);
            }

            $eventDate = new DateTimeImmutable($event['event_date']);
            if ($eventDate <= new DateTimeImmutable()) {
                $this->db->rollBack();
                json_error('EVENT_PASSED', 'Cannot cancel registration for a past event.', 409);
            }

            $stmt = $this->db->prepare(
                "UPDATE registrations SET status = 'cancelled', cancelled_at = NOW()
                 WHERE event_id = :event_id AND user_id = :user_id AND status = 'active'"
            );
            $stmt->execute(['event_id' => $eventId, 'user_id' => $userId]);

            if ($stmt->rowCount() === 0) {
                $this->db->rollBack();
                json_error('NOT_REGISTERED', 'You are not registered for this event.', 409);
            }

            $this->db->commit();

            return $this->getEventCounts($eventId, $userId);
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function getUserRegistrations(int $userId): array
    {
        $sql = "
            SELECT
                r.id AS registration_id, r.event_id, r.registered_at,
                e.title, e.description, e.venue, e.category, e.event_date, e.capacity,
                COUNT(ar.id) FILTER (WHERE ar.status = 'active') AS registered_count,
                e.capacity - COUNT(ar.id) FILTER (WHERE ar.status = 'active') AS remaining_seats,
                CASE
                    WHEN e.event_date <= NOW() THEN 'past'
                    WHEN COUNT(ar.id) FILTER (WHERE ar.status = 'active') >= e.capacity THEN 'full'
                    ELSE 'open'
                END AS status
            FROM registrations r
            JOIN events e ON e.id = r.event_id
            LEFT JOIN registrations ar ON ar.event_id = e.id
            WHERE r.user_id = :user_id AND r.status = 'active'
            GROUP BY r.id, e.id
            ORDER BY e.event_date ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $rows = $stmt->fetchAll();

        $upcoming = [];
        $past = [];
        $now = new DateTimeImmutable();

        foreach ($rows as &$row) {
            $row['registration_id'] = (int) $row['registration_id'];
            $row['event_id'] = (int) $row['event_id'];
            $row['capacity'] = (int) $row['capacity'];
            $row['registered_count'] = (int) $row['registered_count'];
            $row['remaining_seats'] = (int) $row['remaining_seats'];
            $eventDate = new DateTimeImmutable($row['event_date']);
            $row['event_date'] = $eventDate->format(DateTimeInterface::ATOM);
            $row['registered_at'] = (new DateTimeImmutable($row['registered_at']))->format(DateTimeInterface::ATOM);

            if ($eventDate > $now) {
                $upcoming[] = $row;
            } else {
                $past[] = $row;
            }
        }

        return ['upcoming' => $upcoming, 'past' => $past];
    }

    public function getAttendees(int $eventId): array
    {
        $sql = "
            SELECT u.name, u.email, r.registered_at
            FROM registrations r
            JOIN users u ON u.id = r.user_id
            WHERE r.event_id = :event_id AND r.status = 'active'
            ORDER BY r.registered_at ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['event_id' => $eventId]);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['registered_at'] = (new DateTimeImmutable($row['registered_at']))->format(DateTimeInterface::ATOM);
        }

        return $rows;
    }

    private function getEventCounts(int $eventId, int $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM registrations WHERE event_id = :event_id AND status = 'active'"
        );
        $stmt->execute(['event_id' => $eventId]);
        $registeredCount = (int) $stmt->fetchColumn();

        $stmt = $this->db->prepare("SELECT capacity FROM events WHERE id = :id");
        $stmt->execute(['id' => $eventId]);
        $capacity = (int) $stmt->fetchColumn();

        $stmt = $this->db->prepare(
            "SELECT id FROM registrations WHERE event_id = :event_id AND user_id = :user_id AND status = 'active'"
        );
        $stmt->execute(['event_id' => $eventId, 'user_id' => $userId]);
        $userRegistered = (bool) $stmt->fetch();

        return [
            'id'               => $eventId,
            'event_id'         => $eventId,
            'capacity'         => $capacity,
            'registered_count' => $registeredCount,
            'remaining_seats'  => $capacity - $registeredCount,
            'user_registered'  => $userRegistered,
            'status'           => $registeredCount >= $capacity ? 'full' : 'open',
        ];
    }
}