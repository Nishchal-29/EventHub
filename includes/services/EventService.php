<?php
declare(strict_types=1);

class EventService
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function list(array $filters, ?int $userId = null): array
    {
        $where = [];
        $params = [];

        // Search
        if (!empty($filters['q'])) {
            $where[] = "(e.title ILIKE :q OR e.description ILIKE :q OR e.venue ILIKE :q)";
            $params['q'] = '%' . $filters['q'] . '%';
        }

        // Category
        if (!empty($filters['category'])) {
            $where[] = "e.category = :category";
            $params['category'] = $filters['category'];
        }

        // Date range
        if (!empty($filters['from'])) {
            $where[] = "e.event_date >= :from_date";
            $params['from_date'] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = "e.event_date <= :to_date";
            $params['to_date'] = $filters['to'];
        }

        // Upcoming only
        if (!empty($filters['upcoming'])) {
            $where[] = "e.event_date > NOW()";
        }

        $whereClause = '';
        if (!empty($where)) {
            $whereClause = 'WHERE ' . implode(' AND ', $where);
        }

        // Sort (whitelisted)
        $sortMap = [
            'date'  => 'e.event_date ASC',
            'title' => 'e.title ASC',
            'seats' => 'remaining_seats DESC',
        ];
        $sort = $sortMap[$filters['sort'] ?? 'date'] ?? $sortMap['date'];

        // Pagination
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($filters['per_page'] ?? 12)));
        $offset = ($page - 1) * $perPage;

        // User registration subquery
        $userRegSelect = 'FALSE AS user_registered';
        $userRegJoin = '';
        if ($userId !== null) {
            $userRegSelect = 'CASE WHEN ur.id IS NOT NULL THEN TRUE ELSE FALSE END AS user_registered';
            $userRegJoin = "LEFT JOIN registrations ur ON ur.event_id = e.id AND ur.user_id = :user_id AND ur.status = 'active'";
            $params['user_id'] = $userId;
        }

        // Count total
        $countSql = "SELECT COUNT(*) FROM events e $whereClause";
        $countStmt = $this->db->prepare($countSql);
        $countParams = $params;
        unset($countParams['user_id']);
        $countStmt->execute($countParams);
        $total = (int) $countStmt->fetchColumn();

        // Main query
        $sql = "
            SELECT
                e.id, e.title, e.description, e.venue, e.category,
                e.event_date, e.capacity,
                COUNT(r.id) FILTER (WHERE r.status = 'active') AS registered_count,
                e.capacity - COUNT(r.id) FILTER (WHERE r.status = 'active') AS remaining_seats,
                CASE
                    WHEN e.event_date <= NOW() THEN 'past'
                    WHEN COUNT(r.id) FILTER (WHERE r.status = 'active') >= e.capacity THEN 'full'
                    ELSE 'open'
                END AS status,
                $userRegSelect
            FROM events e
            LEFT JOIN registrations r ON r.event_id = e.id
            $userRegJoin
            $whereClause
            GROUP BY e.id" . ($userId !== null ? ', ur.id' : '') . "
            ORDER BY $sort
            LIMIT :lim OFFSET :off
        ";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue(':' . $key, $val);
        }
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $events = $stmt->fetchAll();

        // Format
        foreach ($events as &$event) {
            $event['id'] = (int) $event['id'];
            $event['capacity'] = (int) $event['capacity'];
            $event['registered_count'] = (int) $event['registered_count'];
            $event['remaining_seats'] = (int) $event['remaining_seats'];
            $event['user_registered'] = (bool) $event['user_registered'];
            $event['event_date'] = (new DateTimeImmutable($event['event_date']))->format(DateTimeInterface::ATOM);
        }
        unset($event);

        return [
            'events' => $events,
            'pagination' => [
                'page'      => $page,
                'per_page'  => $perPage,
                'total'     => $total,
                'pages'     => (int) ceil($total / $perPage),
            ],
        ];
    }

    public function getById(int $id, ?int $userId = null): ?array
    {
        $userRegSelect = 'FALSE AS user_registered';
        $userRegJoin = '';
        $params = ['id' => $id];
        if ($userId !== null) {
            $userRegSelect = 'CASE WHEN ur.id IS NOT NULL THEN TRUE ELSE FALSE END AS user_registered';
            $userRegJoin = "LEFT JOIN registrations ur ON ur.event_id = e.id AND ur.user_id = :user_id AND ur.status = 'active'";
            $params['user_id'] = $userId;
        }

        $sql = "
            SELECT
                e.id, e.title, e.description, e.venue, e.category,
                e.event_date, e.capacity,
                COUNT(r.id) FILTER (WHERE r.status = 'active') AS registered_count,
                e.capacity - COUNT(r.id) FILTER (WHERE r.status = 'active') AS remaining_seats,
                CASE
                    WHEN e.event_date <= NOW() THEN 'past'
                    WHEN COUNT(r.id) FILTER (WHERE r.status = 'active') >= e.capacity THEN 'full'
                    ELSE 'open'
                END AS status,
                $userRegSelect
            FROM events e
            LEFT JOIN registrations r ON r.event_id = e.id
            $userRegJoin
            WHERE e.id = :id
            GROUP BY e.id" . ($userId !== null ? ', ur.id' : '') . "
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $event = $stmt->fetch();
        if (!$event) {
            return null;
        }

        $event['id'] = (int) $event['id'];
        $event['capacity'] = (int) $event['capacity'];
        $event['registered_count'] = (int) $event['registered_count'];
        $event['remaining_seats'] = (int) $event['remaining_seats'];
        $event['user_registered'] = (bool) $event['user_registered'];
        $event['event_date'] = (new DateTimeImmutable($event['event_date']))->format(DateTimeInterface::ATOM);

        return $event;
    }

    public function create(array $data, int $createdBy): array
    {
        $sql = "
            INSERT INTO events (title, description, venue, category, event_date, capacity, created_by)
            VALUES (:title, :description, :venue, :category, :event_date, :capacity, :created_by)
            RETURNING id
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'title'       => trim($data['title']),
            'description' => trim($data['description'] ?? ''),
            'venue'       => trim($data['venue'] ?? ''),
            'category'    => trim($data['category'] ?? ''),
            'event_date'  => $data['event_date'],
            'capacity'    => (int) $data['capacity'],
            'created_by'  => $createdBy,
        ]);
        $id = (int) $stmt->fetchColumn();
        return $this->getById($id);
    }

    public function update(int $id, array $data): array
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT id, capacity FROM events WHERE id = :id FOR UPDATE");
            $stmt->execute(['id' => $id]);
            $event = $stmt->fetch();
            if (!$event) {
                $this->db->rollBack();
                json_error('NOT_FOUND', 'Event not found.', 404);
            }

            $stmt = $this->db->prepare("SELECT COUNT(*) FROM registrations WHERE event_id = :id AND status = 'active'");
            $stmt->execute(['id' => $id]);
            $activeCount = (int) $stmt->fetchColumn();

            $newCapacity = (int) $data['capacity'];
            if ($newCapacity < $activeCount) {
                $this->db->rollBack();
                json_error(
                    'CAPACITY_BELOW_REGISTRATIONS',
                    "Cannot reduce capacity below current registrations ($activeCount).",
                    409
                );
            }

            $sql = "
                UPDATE events
                SET title = :title, description = :description, venue = :venue,
                    category = :category, event_date = :event_date, capacity = :capacity,
                    updated_at = NOW()
                WHERE id = :id
            ";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                'title'       => trim($data['title']),
                'description' => trim($data['description'] ?? ''),
                'venue'       => trim($data['venue'] ?? ''),
                'category'    => trim($data['category'] ?? ''),
                'event_date'  => $data['event_date'],
                'capacity'    => $newCapacity,
                'id'          => $id,
            ]);

            $this->db->commit();
            return $this->getById($id);
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function delete(int $id): void
    {
        $stmt = $this->db->prepare("DELETE FROM events WHERE id = :id");
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() === 0) {
            json_error('NOT_FOUND', 'Event not found.', 404);
        }
    }

    public function getCategories(): array
    {
        $stmt = $this->db->query("SELECT DISTINCT category FROM events WHERE category IS NOT NULL AND category != '' ORDER BY category");
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
}