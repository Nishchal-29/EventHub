'use strict';

(() => {
    let pollInterval = null;
    let eventId = null;

    function getEventId() {
        const id = new URLSearchParams(window.location.search).get('id');
        return id ? parseInt(id, 10) : null;
    }

    async function loadEvent() {
        const container = $('#event-content');
        if (!container) return;

        if (!eventId) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❓</div>
                    <h3>Event not found</h3>
                    <p>No event ID specified.</p>
                    <a href="/index.html" class="btn btn-outline" style="margin-top:1rem">Back to Events</a>
                </div>
            `;
            return;
        }

        container.innerHTML = '<div class="spinner"></div>';

        try {
            const res = await App.api('GET', '/api/event.php', { id: eventId });
            renderEvent(res.data);
        } catch (res) {
            const msg = res?.error?.message || 'Event not found.';
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">😔</div>
                    <h3>${App.escapeHtml(msg)}</h3>
                    <a href="/index.html" class="btn btn-outline" style="margin-top:1rem">Back to Events</a>
                </div>
            `;
        }
    }

    function renderEvent(event) {
        const container = $('#event-content');
        if (!container) return;

        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);
        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;

        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = `<button class="btn btn-danger btn-lg btn-cancel-detail" data-event-id="${event.id}">Cancel Registration</button>`;
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Full — No Seats Available</button>';
        } else {
            actionBtn = `<button class="btn btn-primary btn-lg btn-register-detail" data-event-id="${event.id}">Register for This Event</button>`;
        }

        container.innerHTML = `
            <div class="event-detail">
                <div class="event-detail-header">
                    <a href="/index.html" class="btn btn-ghost btn-sm" style="margin-bottom:1rem">← Back to Events</a>
                    <h1 class="event-detail-title"></h1>
                    <div style="margin-top:0.5rem">${App.getStatusBadge(event)}</div>
                </div>
                <div class="event-detail-info">
                    <div class="detail-info-item">
                        <div class="detail-info-icon">📅</div>
                        <div class="detail-info-text">
                            <div class="label">Date & Time</div>
                            <div class="value detail-date"></div>
                        </div>
                    </div>
                    <div class="detail-info-item">
                        <div class="detail-info-icon">📍</div>
                        <div class="detail-info-text">
                            <div class="label">Venue</div>
                            <div class="value detail-venue"></div>
                        </div>
                    </div>
                    <div class="detail-info-item">
                        <div class="detail-info-icon">🏷️</div>
                        <div class="detail-info-text">
                            <div class="label">Category</div>
                            <div class="value detail-category"></div>
                        </div>
                    </div>
                    <div class="detail-info-item">
                        <div class="detail-info-icon">💺</div>
                        <div class="detail-info-text">
                            <div class="label">Availability</div>
                            <div class="value detail-seats" aria-live="polite"></div>
                        </div>
                    </div>
                </div>
                <div class="capacity-bar-container" style="margin-bottom:2rem">
                    <div class="capacity-bar" style="height:8px">
                        <div class="capacity-bar-fill ${barClass}" style="width:${fillPercent}%"></div>
                    </div>
                </div>
                <div class="event-detail-description"></div>
                <div class="event-detail-actions" aria-live="polite">${actionBtn}</div>
            </div>
        `;

        container.querySelector('.event-detail-title').textContent = event.title;
        container.querySelector('.detail-date').textContent = App.formatDateTime(event.event_date);
        container.querySelector('.detail-venue').textContent = event.venue || 'TBD';
        container.querySelector('.detail-category').textContent = event.category || 'General';
        container.querySelector('.detail-seats').textContent = `${event.remaining_seats} of ${event.capacity} seats left`;
        container.querySelector('.event-detail-description').textContent = event.description || 'No description available.';

        document.title = `${event.title} — EventHub`;
    }

    function updateEventDetail(event) {
        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);

        const seats = $('.detail-seats');
        if (seats) seats.textContent = `${event.remaining_seats} of ${event.capacity} seats left`;

        const fill = $('.capacity-bar-fill');
        if (fill) {
            fill.style.width = `${fillPercent}%`;
            fill.className = `capacity-bar-fill ${barClass}`;
        }

        const badge = $('.event-detail-header .badge');
        if (badge) badge.outerHTML = App.getStatusBadge(event);

        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;
        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = `<button class="btn btn-danger btn-lg btn-cancel-detail" data-event-id="${event.id}">Cancel Registration</button>`;
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Full — No Seats Available</button>';
        } else {
            actionBtn = `<button class="btn btn-primary btn-lg btn-register-detail" data-event-id="${event.id}">Register for This Event</button>`;
        }

        const actions = $('.event-detail-actions');
        if (actions) actions.innerHTML = actionBtn;
    }

    function startPolling() {
        stopPolling();
        pollInterval = setInterval(async () => {
            try {
                const res = await App.api('GET', '/api/event.php', { id: eventId });
                if (res?.success) {
                    const oldSeats = $('.detail-seats')?.textContent;
                    updateEventDetail(res.data);
                    const newSeats = `${res.data.remaining_seats} of ${res.data.capacity} seats left`;
                    if (oldSeats !== newSeats) {
                        const detail = $('.event-detail');
                        detail?.classList.add('seat-updated');
                        setTimeout(() => detail?.classList.remove('seat-updated'), 1000);
                    }
                }
            } catch {}
        }, 5000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPolling();
        } else if (eventId) {
            App.api('GET', '/api/event.php', { id: eventId }).then(res => {
                if (res?.success) updateEventDetail(res.data);
            });
            startPolling();
        }
    });

    on('click', '.btn-register-detail', async function () {
        if (!App.currentUser) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login.html?next=${next}`;
            return;
        }

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Registering...';

        try {
            const res = await App.api('POST', '/api/register.php', { event_id: eventId });
            App.toast('success', res.message);
            updateEventDetail(res.data);
        } catch (res) {
            if (res?.error) {
                App.toast('error', res.error.message);
                loadEvent();
            }
        }
    });

    on('click', '.btn-cancel-detail', async function () {
        const confirmed = await App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel your registration?',
            'Yes, Cancel',
            'btn-danger'
        );
        if (!confirmed) return;

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Cancelling...';

        try {
            const res = await App.api('POST', '/api/cancel.php', { event_id: eventId });
            App.toast('success', res.message);
            updateEventDetail(res.data);
        } catch (res) {
            if (res?.error) App.toast('error', res.error.message);
            loadEvent();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        App.init(() => {
            if (window.location.pathname !== '/event.html') return;
            eventId = getEventId();
            loadEvent();
            if (eventId) startPolling();
        });
    });
})();