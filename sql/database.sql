-- EventHub Database Schema & Seed Data (Rerunnable)
DROP TABLE IF EXISTS registrations, events, users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    venue VARCHAR(200),
    event_date TIMESTAMPTZ NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0)
);

CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- Seed Demo Accounts
-- Passwords: Alice -> Password1, Bob -> Password2, Carol -> Password3, Admin -> AdminPass1
INSERT INTO users (name, email, password_hash, role) VALUES
('Alice Johnson', 'alice@example.com', '$2y$10$d4tySXbzLSFSI/gA0bGfKO6qrzZLKbaG3NAHL.YvQFgAn/FObMVUe', 'user'),
('Bob Williams', 'bob@example.com', '$2y$10$b/PZ2GJCu1vol.AYTlcR5.E0CEzcuXkBAY15Gmiv0J13lAmwIfo8m', 'user'),
('Carol Davis', 'carol@example.com', '$2y$10$rwS32VxLe5b2S9dTfM7PX.f4bYU.ZRzdtdztGIsE4Xc1eVJlRBky2', 'user'),
('Admin User', 'admin@example.com', '$2y$10$8Qmt/cp4/IFfXwM8SjCgL.k.xMajog4yOGO7D4XaYEbhjtRU3E3EW', 'admin');

-- Seed Events
INSERT INTO events (title, description, venue, event_date, capacity) VALUES
(
    'AI & Machine Learning Summit 2026',
    'Dive deep into the latest advancements in artificial intelligence and machine learning. Featuring keynote speakers from leading tech companies, hands-on workshops, and networking sessions.',
    'Tech Convention Center, Hall A',
    '2026-12-15 09:00:00+00',
    150
),
(
    'Exclusive Wine Tasting Evening',
    'An intimate evening of fine wines from vineyards across the globe. Expert sommeliers will guide you through a curated selection of reds, whites, and sparkling wines paired with artisanal cheeses.',
    'Grand Ballroom, The Ritz',
    '2026-11-20 18:30:00+00',
    1
),
(
    'Marathon Training Bootcamp',
    'A 4-hour intensive bootcamp designed for runners preparing for their next marathon. Includes pace training, nutrition advice, and injury prevention techniques led by professional coaches.',
    'City Sports Complex',
    '2026-11-28 06:00:00+00',
    40
),
(
    'Startup Pitch Night',
    'Watch 10 promising startups pitch their ideas to a panel of venture capitalists. Network with founders and investors over drinks after the presentations.',
    'Innovation Hub, Floor 3',
    '2026-12-05 19:00:00+00',
    80
),
(
    'Watercolor Painting Workshop',
    'Learn the fundamentals of watercolor painting in this hands-on workshop. All materials provided. Perfect for beginners and intermediate artists looking to refine their technique.',
    'Downtown Art Studio',
    '2026-12-01 10:00:00+00',
    20
),
(
    'Cybersecurity Awareness Seminar',
    'Essential knowledge for professionals and individuals alike. Topics include phishing prevention, password management, data privacy regulations, and emerging cyber threats in 2026.',
    'University Auditorium B',
    '2026-11-25 14:00:00+00',
    5
),
(
    'Jazz Night Under the Stars',
    'An outdoor evening of live jazz performances featuring local and international artists. Bring your blankets, enjoy food truck offerings, and soak in the music under the night sky.',
    'Riverside Amphitheatre',
    '2026-12-10 20:00:00+00',
    200
),
(
    'Past Conference on Web Standards',
    'This conference already happened. It covered the latest W3C specifications, browser compatibility updates, and the future of progressive web apps.',
    'Digital Media Center',
    '2025-06-15 09:00:00+00',
    100
);

-- Seed Registrations:
-- Event 6 (Cybersecurity, capacity 5): 4 registered (nearly full)
INSERT INTO registrations (event_id, user_id) VALUES
(6, 1),
(6, 2),
(6, 3),
(6, 4);

-- Event 1 (AI Summit): Alice registered
INSERT INTO registrations (event_id, user_id) VALUES
(1, 1);
