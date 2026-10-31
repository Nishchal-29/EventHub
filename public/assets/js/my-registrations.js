/**
 * my-registrations.js — User registrations dashboard.
 * Displays user registrations partitioned into Upcoming and Past tabs
 * with real-time counters and one-click cancellation.
 */
'use strict';

(() => {
    let registrations = { upcoming: [], past: [] };
    let currentTab = 'upcoming';

    function updateTabCounts() {
        const up = $('#tab-upcoming .tab-count');
        const past = $('#tab-past .tab-count');
        if (up) up.textContent = registrations.upcoming.length;
        if (past) past.textContent = registrations.past.length;
    }

    function renderTab(tab) {
        currentTab = tab;
        const content = $('#registrations-content');
        if (!content) return;

        const items = registrations[tab] || [];
        content.innerHTML = '';

        if (items.length === 0) {
            const isUpcoming = tab === 'upcoming';
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${isUpcoming ? '🎫' : '📋'}</div>
                    <h3>${isUpcoming ? 'You have no upcoming registrations.' : 'No past registrations.'}</h3>
                    <p>${isUpcoming ? '<a href="/index.html">Browse events</a> to get started.' : ''}</p>
                </div>
            `;
            return;
        }

        const isUpcoming = tab === 'upcoming';
        items.forEach(reg => {
            const card = document.createElement('div');
            card.className = 'card registration-card';
            card.dataset.eventId = reg.event_id;

            const cancelBtn = isUpcoming
                ? `<button class="btn btn-danger btn-sm btn-cancel-myreg" data-event-id="${reg.event_id}">Cancel</button>`
                : '';

            card.innerHTML = `
                <div class="registration-info">
                    <h4><a class="reg-title" href="/event.html?id=${reg.event_id}"></a></h4>
                    <div class="registration-meta">
                        <span class="meta-date">📅 </span>
                        ${reg.venue ? '<span class="meta-venue">📍 </span>' : ''}
                        <span class="meta-reg-date">Registered: </span>
                    </div>
                </div>
                <div class="registration-actions">
                    ${cancelBtn}
                </div>
            `;

            card.querySelector('.reg-title').textContent = reg.title;
            card.querySelector('.meta-date').append(document.createTextNode(App.formatDateTime(reg.event_date)));
            if (reg.venue) card.querySelector('.meta-venue')?.append(document.createTextNode(reg.venue));
            card.querySelector('.meta-reg-date').append(document.createTextNode(App.formatDateTime(reg.registered_at)));

            content.appendChild(card);
        });
    }

    async function loadRegistrations() {
        const content = $('#registrations-content');
        if (content) content.innerHTML = '<div class="spinner"></div>';

        try {
            const res = await App.api('GET', '/api/my_registrations.php');
            registrations = res.data;
            updateTabCounts();
            renderTab(currentTab);
        } catch {
            if (content) {
                content.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <h3>Failed to load registrations</h3>
                    </div>
                `;
            }
        }
    }

    on('click', '.tab', function () {
        const tab = this.dataset.tab;
        $$('.tab').forEach(t => {
            const active = t === this;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', String(active));
        });
        renderTab(tab);
    });

    on('click', '.btn-cancel-myreg', async function () {
        const btn = this;
        const eventId = parseInt(btn.dataset.eventId, 10);
        const card = btn.closest('.registration-card');

        const ok = await App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel this registration?',
            'Yes, Cancel',
            'btn-danger'
        );
        if (!ok) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>';

        try {
            const res = await App.api('POST', '/api/cancel.php', { event_id: eventId });
            App.toast('success', res.message || 'Cancelled');
            registrations.upcoming = registrations.upcoming.filter(r => r.event_id !== eventId);
            updateTabCounts();

            if (card) {
                card.classList.add('fade-out');
                setTimeout(() => {
                    card.remove();
                    if ($$('#registrations-content .registration-card').length === 0) {
                        renderTab('upcoming');
                    }
                }, 400);
            }
        } catch (res) {
            if (res?.error) App.toast('error', res.error.message);
            btn.disabled = false;
            btn.textContent = 'Cancel';
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        App.init(user => {
            if (window.location.pathname !== '/my-registrations.html') return;
            if (!user) {
                const next = encodeURIComponent('/my-registrations.html');
                window.location.href = `/login.html?next=${next}`;
                return;
            }
            loadRegistrations();
        });
    });
})();
