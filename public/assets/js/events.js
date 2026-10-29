'use strict';

(() => {
    let currentPage = 1;
    let currentFilters = {};
    let loadRequestId = 0;
    let categoriesLoaded = false;
    let poller = null;

    function updateEventCard(card, event) {
        if (!card) return;
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);
        const barClass = App.getCapacityBarClass(event);

        const badge = card.querySelector('.event-card-header .badge');
        if (badge) badge.outerHTML = App.getStatusBadge(event);

        const seats = card.querySelector('.seats-text');
        if (seats) seats.textContent = `${event.remaining_seats} of ${event.capacity} seats left`;

        const count = card.querySelector('.capacity-count');
        if (count) count.textContent = `${event.registered_count}/${event.capacity}`;

        const fill = card.querySelector('.capacity-bar-fill');
        if (fill) {
            fill.style.width = `${fillPercent}%`;
            fill.className = `capacity-bar-fill ${barClass}`;
        }

        const actions = card.querySelector('.event-card-actions');
        if (actions) actions.innerHTML = App.actionButton(event, 'sm');
    }

    function buildEventCard(event) {
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
                        <span class="capacity-count"></span>
                    </div>
                    <div class="capacity-bar">
                        <div class="capacity-bar-fill"></div>
                    </div>
                </div>
                <div class="event-card-actions"></div>
            </div>
        `;

        card.querySelector('.event-card-title').textContent = event.title;
        card.querySelector('.meta-date').textContent = App.formatDateTime(event.event_date);
        if (event.venue) card.querySelector('.meta-venue').textContent = event.venue;
        if (event.category) card.querySelector('.badge-category').textContent = event.category;
        card.querySelector('.event-card-description').textContent = App.truncate(event.description, 120);

        updateEventCard(card, event);
        return card;
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

    async function loadEvents(page, showLoading) {
        const grid = $('#events-grid');
        const pag = $('#events-pagination');

        if (showLoading && grid) {
            grid.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
            if (pag) pag.innerHTML = '';
        }

        currentPage = page || 1;
        const reqId = ++loadRequestId;
        const params = { ...currentFilters, page: currentPage, per_page: 12 };

        try {
            const res = await App.api('GET', '/api/events.php', params);
            if (reqId !== loadRequestId) return; // Drop stale responses

            const { events, pagination, categories } = res.data;
            if (!categoriesLoaded && categories) {
                categoriesLoaded = true;
                populateCategoryFilter(categories);
            }

            if (events.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <h3>No events found</h3>
                        <p>Try adjusting your search or filters.</p>
                    </div>
                `;
            } else {
                grid.innerHTML = '';
                events.forEach(e => grid.appendChild(buildEventCard(e)));
            }
            renderPagination(pagination);
        } catch {
            if (reqId === loadRequestId && grid) {
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

    function populateCategoryFilter(categories) {
        const select = $('#filter-category');
        if (!select) return;
        select.innerHTML = '<option value="">All Categories</option>' +
            categories.map(c => `<option value="${App.escapeHtml(c)}">${App.escapeHtml(c)}</option>`).join('');
        if (currentFilters.category) select.value = currentFilters.category;
    }

    async function pollEvents() {
        const params = { ...currentFilters, page: currentPage, per_page: 12 };
        try {
            const res = await App.api('GET', '/api/events.php', params);
            res.data.events.forEach(event => {
                const card = $(`.event-card[data-event-id="${event.id}"]`);
                if (!card || card.dataset.busy) return; // Skip in-flight card mutations

                const countEl = card.querySelector('.capacity-count');
                const oldText = countEl ? countEl.textContent : '';
                const newText = `${event.registered_count}/${event.capacity}`;

                updateEventCard(card, event);
                if (oldText && oldText !== newText) {
                    card.classList.add('seat-updated');
                    setTimeout(() => card.classList.remove('seat-updated'), 1000);
                }
            });
        } catch {
        }
    }

    function toggleUpcoming(el) {
        el.classList.toggle('active');
        const checked = el.classList.contains('active');
        el.setAttribute('aria-checked', String(checked));
        currentFilters.upcoming = checked ? '1' : '';
        loadEvents(1, true);
    }

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
        toggleUpcoming(this);
    });

    on('keydown', '#toggle-upcoming', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleUpcoming(this);
        }
    });

    on('click', '.btn-page', function () {
        loadEvents(parseInt(this.dataset.page, 10), true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    on('click', '.btn-register', async function () {
        if (!App.currentUser) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login.html?next=${next}`;
            return;
        }

        const btn = this;
        const card = btn.closest('.event-card');
        const eventId = parseInt(btn.dataset.eventId, 10);

        if (card) card.dataset.busy = 'true';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>';

        try {
            const res = await App.api('POST', '/api/register.php', { event_id: eventId });
            App.toast('success', res.message || 'Registered!');
            if (card) {
                delete card.dataset.busy;
                updateEventCard(card, res.data);
                card.classList.add('seat-updated');
                setTimeout(() => card.classList.remove('seat-updated'), 1000);
            }
        } catch (res) {
            if (card) delete card.dataset.busy;
            if (res?.error) {
                App.toast('error', res.error.message);
                if (res.error.code === 'FULL' || res.error.code === 'DUPLICATE') {
                    App.api('GET', '/api/event.php', { id: eventId }).then(ev => {
                        if (ev?.success && card) updateEventCard(card, ev.data);
                    }).catch(() => {});
                }
            }
            btn.disabled = false;
            btn.textContent = 'Register';
        }
    });

    on('click', '.btn-cancel-reg', async function () {
        const btn = this;
        const card = btn.closest('.event-card');
        const eventId = parseInt(btn.dataset.eventId, 10);

        const ok = await App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel your registration for this event?',
            'Yes, Cancel',
            'btn-danger'
        );
        if (!ok) return;

        if (card) card.dataset.busy = 'true';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>';

        try {
            const res = await App.api('POST', '/api/cancel.php', { event_id: eventId });
            App.toast('success', res.message || 'Registration cancelled.');
            if (card) {
                delete card.dataset.busy;
                updateEventCard(card, res.data);
                card.classList.add('seat-updated');
                setTimeout(() => card.classList.remove('seat-updated'), 1000);
            }
        } catch (res) {
            if (card) delete card.dataset.busy;
            if (res?.error) App.toast('error', res.error.message);
            btn.disabled = false;
            btn.textContent = 'Cancel Registration';
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        App.init(() => {
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;
            loadEvents(1, true);
            poller = App.poll(pollEvents, 5000);
        });
    });
})();