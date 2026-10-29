'use strict';

(() => {
    let eventId = null;
    let poller = null;

    function getEventId() {
        const id = new URLSearchParams(window.location.search).get('id');
        return id ? parseInt(id, 10) : null;
    }

    function renderDynamicParts(event) {
        const container = $('#event-content');
        if (!container) return;

        const badge = container.querySelector('.event-detail-header .badge');
        if (badge) badge.outerHTML = App.getStatusBadge(event);

        const seats = container.querySelector('.detail-seats');
        if (seats) seats.textContent = `${event.remaining_seats} of ${event.capacity} seats left`;

        const fill = container.querySelector('.capacity-bar-fill');
        if (fill) {
            const pct = Math.min(100, (event.registered_count / event.capacity) * 100);
            fill.style.width = `${pct}%`;
            fill.className = `capacity-bar-fill ${App.getCapacityBarClass(event)}`;
        }

        const actions = container.querySelector('.event-detail-actions');
        if (actions && !actions.dataset.busy) {
            actions.innerHTML = App.actionButton(event, 'lg');
        }
    }

    function renderStaticShell(event) {
        const container = $('#event-content');
        if (!container) return;

        container.innerHTML = `
            <div class="event-detail">
                <div class="event-detail-header">
                    <a href="/index.html" class="btn btn-ghost btn-sm mb-4">← Back to Events</a>
                    <h1 class="event-detail-title"></h1>
                    <div class="mt-2"><span class="badge"></span></div>
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
                <div class="capacity-bar-container mb-6">
                    <div class="capacity-bar h-2">
                        <div class="capacity-bar-fill"></div>
                    </div>
                </div>
                <div class="event-detail-description"></div>
                <div class="event-detail-actions" aria-live="polite"></div>
            </div>
        `;

        container.querySelector('.event-detail-title').textContent = event.title;
        container.querySelector('.detail-date').textContent = App.formatDateTime(event.event_date);
        container.querySelector('.detail-venue').textContent = event.venue || 'TBD';
        container.querySelector('.detail-category').textContent = event.category || 'General';
        container.querySelector('.event-detail-description').textContent = event.description || 'No description available.';

        document.title = `${event.title} — EventHub`;
        renderDynamicParts(event);
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
                    <a href="/index.html" class="btn btn-outline mt-4">Back to Events</a>
                </div>
            `;
            return;
        }

        container.innerHTML = '<div class="spinner"></div>';

        try {
            const res = await App.api('GET', '/api/event.php', { id: eventId });
            renderStaticShell(res.data);
            if (!poller) poller = App.poll(pollEventDetail, 5000);
        } catch (res) {
            const msg = res?.error?.message || 'Event not found.';
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">😔</div>
                    <h3>${App.escapeHtml(msg)}</h3>
                    <a href="/index.html" class="btn btn-outline mt-4">Back to Events</a>
                </div>
            `;
        }
    }

    async function pollEventDetail() {
        if (!eventId) return;
        const actions = $('.event-detail-actions');
        if (actions?.dataset.busy) return; 

        try {
            const res = await App.api('GET', '/api/event.php', { id: eventId });
            const oldText = $('.detail-seats')?.textContent;
            renderDynamicParts(res.data);
            const newText = `${res.data.remaining_seats} of ${res.data.capacity} seats left`;

            if (oldText && oldText !== newText) {
                const detail = $('.event-detail');
                detail?.classList.add('seat-updated');
                setTimeout(() => detail?.classList.remove('seat-updated'), 1000);
            }
        } catch {
        }
    }

    on('click', '.btn-register-detail', async function () {
        if (!App.currentUser) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login.html?next=${next}`;
            return;
        }

        const btn = this;
        const actions = btn.closest('.event-detail-actions');
        if (actions) actions.dataset.busy = 'true';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Registering...';

        try {
            const res = await App.api('POST', '/api/register.php', { event_id: eventId });
            App.toast('success', res.message || 'Registered!');
            if (actions) delete actions.dataset.busy;
            renderDynamicParts(res.data);
            const detail = $('.event-detail');
            detail?.classList.add('seat-updated');
            setTimeout(() => detail?.classList.remove('seat-updated'), 1000);
        } catch (res) {
            if (actions) delete actions.dataset.busy;
            if (res?.error) App.toast('error', res.error.message);
            loadEvent();
        }
    });

    on('click', '.btn-cancel-detail', async function () {
        const ok = await App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel your registration?',
            'Yes, Cancel',
            'btn-danger'
        );
        if (!ok) return;

        const btn = this;
        const actions = btn.closest('.event-detail-actions');
        if (actions) actions.dataset.busy = 'true';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Cancelling...';

        try {
            const res = await App.api('POST', '/api/cancel.php', { event_id: eventId });
            App.toast('success', res.message || 'Cancelled!');
            if (actions) delete actions.dataset.busy;
            renderDynamicParts(res.data);
            const detail = $('.event-detail');
            detail?.classList.add('seat-updated');
            setTimeout(() => detail?.classList.remove('seat-updated'), 1000);
        } catch (res) {
            if (actions) delete actions.dataset.busy;
            if (res?.error) App.toast('error', res.error.message);
            loadEvent();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        App.init(() => {
            if (window.location.pathname !== '/event.html') return;
            eventId = getEventId();
            loadEvent();
        });
    });
})();