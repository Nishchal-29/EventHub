-- Event Registration Portal — Seed Data
-- Demo credentials:
--   alice@example.com   / Password1 (user)
--   bob@example.com     / Password2 (user)
--   carol@example.com   / Password3 (user)
--   admin@example.com   / AdminPass1 (admin)

-- Clear existing seed data (idempotent)
TRUNCATE registrations, events, users, login_attempts RESTART IDENTITY CASCADE;

INSERT INTO users (name, email, password_hash, role) VALUES
('Alice Johnson', 'alice@example.com', '$2y$10$puBJGJ9N1Ck13LVNDfwOMe1Ixb95VEMevdFtvRhl5JbzDFcKlsutm', 'user'),
('Bob Williams', 'bob@example.com', '$2y$10$nf75N8nq4ZRKwc0TzrgRG.xLRBiJDE2lBdxSY6GDp6aMffx8bSGiu', 'user'),
('Carol Davis', 'carol@example.com', '$2y$10$OCiGWOYStdhg3V0eyrVFkeVnqu1fpNvLhilwiE1hvNM.hsvfPs0NO', 'user'),
('Admin User', 'admin@example.com', '$2y$10$/lMvV7tgvUGo15sWEdGgleUDtgWw2j93pL.1lQGgs0Z4YYgf99wLC', 'admin');

INSERT INTO events (title, description, venue, category, event_date, capacity, created_by) VALUES
(
    'AI & Machine Learning Summit 2026',
    'Dive deep into the latest advancements in artificial intelligence and machine learning. Featuring keynote speakers from leading tech companies, hands-on workshops, and networking sessions.',
    'Tech Convention Center, Hall A',
    'Technology',
    '2026-12-15 09:00:00+00',
    150,
    4
),
(
    'Exclusive Wine Tasting Evening',
    'An intimate evening of fine wines from vineyards across the globe. Expert sommeliers will guide you through a curated selection of reds, whites, and sparkling wines paired with artisanal cheeses.',
    'Grand Ballroom, The Ritz',
    'Food & Drink',
    '2026-11-20 18:30:00+00',
    1,
    4
),
(
    'Marathon Training Bootcamp',
    'A 4-hour intensive bootcamp designed for runners preparing for their next marathon. Includes pace training, nutrition advice, and injury prevention techniques led by professional coaches.',
    'City Sports Complex',
    'Sports',
    '2026-11-28 06:00:00+00',
    40,
    4
),
(
    'Startup Pitch Night',
    'Watch 10 promising startups pitch their ideas to a panel of venture capitalists. Network with founders and investors over drinks after the presentations.',
    'Innovation Hub, Floor 3',
    'Business',
    '2026-12-05 19:00:00+00',
    80,
    4
),
(
    'Watercolor Painting Workshop',
    'Learn the fundamentals of watercolor painting in this hands-on workshop. All materials provided. Perfect for beginners and intermediate artists looking to refine their technique.',
    'Downtown Art Studio',
    'Arts',
    '2026-12-01 10:00:00+00',
    20,
    4
),
(
    'Cybersecurity Awareness Seminar',
    'Essential knowledge for professionals and individuals alike. Topics include phishing prevention, password management, data privacy regulations, and emerging cyber threats in 2026.',
    'University Auditorium B',
    'Technology',
    '2026-11-25 14:00:00+00',
    5,
    4
),
(
    'Jazz Night Under the Stars',
    'An outdoor evening of live jazz performances featuring local and international artists. Bring your blankets, enjoy food truck offerings, and soak in the music under the night sky.',
    'Riverside Amphitheatre',
    'Music',
    '2026-12-10 20:00:00+00',
    200,
    4
),
(
    'Past Conference on Web Standards',
    'This conference already happened. It covered the latest W3C specifications, browser compatibility updates, and the future of progressive web apps.',
    'Digital Media Center',
    'Technology',
    '2025-06-15 09:00:00+00',
    100,
    4
);

-- Pre-register some users to make the cybersecurity event nearly full (capacity 5, 4 registered)
-- We only have 3 real users + admin, so register alice, bob, carol, and admin
INSERT INTO registrations (event_id, user_id, status) VALUES
(6, 1, 'active'),
(6, 2, 'active'),
(6, 3, 'active'),
(6, 4, 'active');

-- Alice is also registered for the AI Summit
INSERT INTO registrations (event_id, user_id, status) VALUES
(1, 1, 'active');

-- Bob has a cancelled registration for the marathon (history)
INSERT INTO registrations (event_id, user_id, status) VALUES
(3, 2, 'cancelled');
