/**
 * events.js — Event discovery feed and real-time seat tracking.
 * Renders all events with capacity progress bars, handles registration
 * and cancellation actions, and polls every 5s for live seat updates.
 */
'use strict';

(() => {
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
        card.querySelector('.event-card-description').textContent = App.truncate(event.description, 120);

        updateEventCard(card, event);
        return card;
    }

    async function loadEvents(showLoading) {
        const grid = $('#events-grid');
        if (showLoading && grid) {
            grid.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
        }

        try {
            const res = await App.api('GET', '/api/events.php');
            const events = res.data.events || [];

            if (events.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <h3>No events found</h3>
                    </div>
                `;
            } else {
                grid.innerHTML = '';
                events.forEach(e => grid.appendChild(buildEventCard(e)));
            }
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

    async function pollEvents() {
        try {
            const res = await App.api('GET', '/api/events.php');
            (res.data.events || []).forEach(event => {
                const card = $(`.event-card[data-event-id="${event.id}"]`);
                if (!card || card.dataset.busy) return;

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
                    App.api('GET', '/api/events.php', { id: eventId }).then(ev => {
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
            loadEvents(true);
            poller = App.poll(pollEvents, 5000);
        });
    });
})();
