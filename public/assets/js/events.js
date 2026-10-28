'use strict';

(() => {
    let currentPage = 1;
    let currentFilters = {};
    let pollInterval = null;
    let pollEtag = null;
    let pollErrors = 0;
    let pollInProgress = false;
    let categories = [];

    function buildEventCard(event) {
        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);
        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;

        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = `<button class="btn btn-danger btn-sm btn-cancel-reg" data-event-id="${event.id}">Cancel Registration</button>`;
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Full</button>';
        } else {
            actionBtn = `<button class="btn btn-primary btn-sm btn-register" data-event-id="${event.id}">Register</button>`;
        }

        const card = document.createElement('div');
        card.className = 'card event-card';
        card.dataset.eventId = event.id;
        card.innerHTML = `
            <div class="event-card-header">
                <a class="event-card-title" href="/event.html?id=${event.id}"></a>
                ${App.getStatusBadge(event)}
            </div>
            <div class="event-card-meta">
                <div class="event-card-meta-item">
                    <span class="meta-icon">📅</span>
                    <span class="meta-date"></span>
                </div>
                ${event.venue ? '<div class="event-card-meta-item"><span class="meta-icon">📍</span><span class="meta-venue"></span></div>' : ''}
                ${event.category ? '<div class="event-card-meta-item"><span class="badge badge-category"></span></div>' : ''}
            </div>
            <div class="event-card-description"></div>
            <div class="event-card-footer">
                <div class="capacity-bar-container">
                    <div class="capacity-info">
                        <span class="capacity-text seats-text"></span>
                        <span class="capacity-count">${event.registered_count}/${event.capacity}</span>
                    </div>
                    <div class="capacity-bar">
                        <div class="capacity-bar-fill ${barClass}" style="width: ${fillPercent}%"></div>
                    </div>
                </div>
                <div class="event-card-actions">${actionBtn}</div>
            </div>
        `;

        card.querySelector('.event-card-title').textContent = event.title;
        card.querySelector('.meta-date').textContent = App.formatDateTime(event.event_date);
        if (event.venue) card.querySelector('.meta-venue').textContent = event.venue;
        if (event.category) card.querySelector('.badge-category').textContent = event.category;
        card.querySelector('.event-card-description').textContent = App.truncate(event.description, 120);
        card.querySelector('.seats-text').textContent = `${event.remaining_seats} of ${event.capacity} seats left`;

        return card;
    }

    function updateEventCard(card, event) {
        if (!card) return;
        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);
        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;

        const headerBadge = card.querySelector('.event-card-header .badge');
        if (headerBadge) {
            headerBadge.outerHTML = App.getStatusBadge(event);
        }

        const seatsText = card.querySelector('.seats-text');
        if (seatsText) seatsText.textContent = `${event.remaining_seats} of ${event.capacity} seats left`;

        const capCount = card.querySelector('.capacity-count');
        if (capCount) capCount.textContent = `${event.registered_count}/${event.capacity}`;

        const fill = card.querySelector('.capacity-bar-fill');
        if (fill) {
            fill.style.width = `${fillPercent}%`;
            fill.className = `capacity-bar-fill ${barClass}`;
        }

        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = `<button class="btn btn-danger btn-sm btn-cancel-reg" data-event-id="${event.id}">Cancel Registration</button>`;
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Full</button>';
        } else {
            actionBtn = `<button class="btn btn-primary btn-sm btn-register" data-event-id="${event.id}">Register</button>`;
        }

        const actions = card.querySelector('.event-card-actions');
        if (actions) actions.innerHTML = actionBtn;
    }

    async function loadEvents(page, showLoading) {
        const grid = $('#events-grid');
        const paginationEl = $('#events-pagination');

        if (showLoading && grid) {
            grid.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
            if (paginationEl) paginationEl.innerHTML = '';
        }

        currentPage = page || 1;
        const params = { ...currentFilters, page: currentPage, per_page: 12 };

        try {
            const res = await App.api('GET', '/api/events.php', params);
            const data = res.data;

            if (categories.length === 0 && data.categories) {
                categories = data.categories;
                const catSelect = $('#filter-category');
                if (catSelect) {
                    catSelect.innerHTML = '<option value="">All Categories</option>' +
                        categories.map(c => `<option value="${App.escapeHtml(c)}">${App.escapeHtml(c)}</option>`).join('');
                    if (currentFilters.category) catSelect.value = currentFilters.category;
                }
            }

            renderEvents(data.events);
            renderPagination(data.pagination);
        } catch {
            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <h3>Failed to load events</h3>
                        <p>Please try again later.</p>
                    </div>
                `;
            }
        }
    }

    function renderEvents(events) {
        const grid = $('#events-grid');
        if (!grid) return;

        if (events.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>No events found</h3>
                    <p>Try adjusting your search or filters.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        events.forEach(event => grid.appendChild(buildEventCard(event)));
    }

    function renderPagination(pagination) {
        const pag = $('#events-pagination');
        if (!pag) return;
        pag.innerHTML = '';
        if (pagination.pages <= 1) return;

        let html = '';
        if (pagination.page > 1) {
            html += `<button class="btn btn-outline btn-page" data-page="${pagination.page - 1}">‹</button>`;
        }

        const maxVisible = 5;
        let start = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
        let end = Math.min(pagination.pages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            const active = i === pagination.page ? ' active' : '';
            html += `<button class="btn btn-outline btn-page${active}" data-page="${i}">${i}</button>`;
        }

        if (pagination.page < pagination.pages) {
            html += `<button class="btn btn-outline btn-page" data-page="${pagination.page + 1}">›</button>`;
        }

        html += `<span class="pagination-info">Page ${pagination.page} of ${pagination.pages}</span>`;
        pag.innerHTML = html;
    }

    function startPolling() {
        stopPolling();
        pollInterval = setInterval(pollEvents, 5000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    async function pollEvents() {
        if (pollInProgress) return;
        pollInProgress = true;

        const params = new URLSearchParams({ ...currentFilters, page: currentPage, per_page: 12 });
        const headers = { 'Accept': 'application/json' };
        if (pollEtag) headers['If-None-Match'] = pollEtag;

        try {
            const res = await fetch(`/api/events.php?${params.toString()}`, { headers });
            pollInProgress = false;

            if (res.status === 304) {
                pollErrors = 0;
                return;
            }

            if (!res.ok) throw new Error('Poll response error');

            pollErrors = 0;
            const etag = res.headers.get('ETag');
            if (etag) pollEtag = etag;

            const json = await res.json();
            if (json?.success && json.data?.events) {
                updateCardsFromPoll(json.data.events);
            }
        } catch {
            pollInProgress = false;
            pollErrors++;
            if (pollErrors >= 3) {
                stopPolling();
                setTimeout(() => {
                    pollErrors = 0;
                    startPolling();
                }, 30000);
            }
        }
    }

    function updateCardsFromPoll(events) {
        events.forEach(event => {
            const card = $(`.event-card[data-event-id="${event.id}"]`);
            if (!card) return;

            const oldText = card.querySelector('.capacity-count')?.textContent;
            const newText = `${event.registered_count}/${event.capacity}`;

            if (oldText !== newText) {
                updateEventCard(card, event);
                card.classList.add('seat-updated');
                setTimeout(() => card.classList.remove('seat-updated'), 1000);
            } else {
                updateEventCard(card, event);
            }
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPolling();
        } else {
            pollEtag = null;
            pollEvents();
            startPolling();
        }
    });

    let searchTimer = null;
    on('input', '#search-input', function () {
        clearTimeout(searchTimer);
        const q = this.value;
        searchTimer = setTimeout(() => {
            currentFilters.q = q;
            loadEvents(1, true);
        }, 300);
    });

    on('change', '#filter-category', function () {
        currentFilters.category = this.value;
        loadEvents(1, true);
    });

    on('change', '#filter-sort', function () {
        currentFilters.sort = this.value;
        loadEvents(1, true);
    });

    on('click', '#toggle-upcoming', function () {
        this.classList.toggle('active');
        currentFilters.upcoming = this.classList.contains('active') ? '1' : '';
        loadEvents(1, true);
    });

    on('click', '.btn-page', function () {
        const page = parseInt(this.dataset.page, 10);
        loadEvents(page, true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    on('click', '.btn-register', async function () {
        if (!App.currentUser) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login.html?next=${next}`;
            return;
        }

        const btn = this;
        const eventId = parseInt(btn.dataset.eventId, 10);
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>';

        try {
            const res = await App.api('POST', '/api/register.php', { event_id: eventId });
            App.toast('success', res.message || 'Registered!');
            const card = btn.closest('.event-card');
            updateEventCard(card, res.data);
            card?.classList.add('seat-updated');
            setTimeout(() => card?.classList.remove('seat-updated'), 1000);
        } catch (res) {
            if (res?.error) {
                App.toast('error', res.error.message);
                if (res.error.code === 'FULL' || res.error.code === 'DUPLICATE') {
                    refreshSingleEvent(eventId);
                }
            }
            btn.disabled = false;
            btn.textContent = 'Register';
        }
    });

    on('click', '.btn-cancel-reg', async function () {
        const btn = this;
        const eventId = parseInt(btn.dataset.eventId, 10);

        const confirmed = await App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel your registration for this event?',
            'Yes, Cancel',
            'btn-danger'
        );
        if (!confirmed) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>';

        try {
            const res = await App.api('POST', '/api/cancel.php', { event_id: eventId });
            App.toast('success', res.message || 'Registration cancelled.');
            const card = btn.closest('.event-card');
            updateEventCard(card, res.data);
            card?.classList.add('seat-updated');
            setTimeout(() => card?.classList.remove('seat-updated'), 1000);
        } catch (res) {
            if (res?.error) App.toast('error', res.error.message);
            btn.disabled = false;
            btn.textContent = 'Cancel Registration';
        }
    });

    async function refreshSingleEvent(eventId) {
        try {
            const res = await App.api('GET', '/api/event.php', { id: eventId });
            if (res.success) {
                const card = $(`.event-card[data-event-id="${eventId}"]`);
                if (card) updateEventCard(card, res.data);
            }
        } catch {}
    }

    document.addEventListener('DOMContentLoaded', () => {
        App.init(() => {
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;
            loadEvents(1, true);
            startPolling();
        });
    });
})();