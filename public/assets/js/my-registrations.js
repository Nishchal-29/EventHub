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
                    <button class="btn btn-outline btn-sm btn-view-ticket" data-reg-id="${reg.registration_id}" data-event-id="${reg.event_id}">🎫 View Ticket</button>
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

    function generateBarcodeSvg(code) {
        let bars = '';
        let x = 12;
        for (let i = 0; i < code.length; i++) {
            const c = code.charCodeAt(i);
            const w1 = (c % 3) + 1;
            const w2 = ((c >> 1) % 2) + 1;
            const w3 = ((c >> 2) % 3) + 1;
            bars += `<rect x="${x}" y="0" width="${w1}" height="44" fill="currentColor"/>`;
            bars += `<rect x="${x + w1 + 2}" y="0" width="${w2}" height="44" fill="currentColor"/>`;
            bars += `<rect x="${x + w1 + w2 + 4}" y="0" width="${w3}" height="44" fill="currentColor"/>`;
            x += w1 + w2 + w3 + 7;
        }
        bars += `<rect x="${x + 2}" y="0" width="2" height="44" fill="currentColor"/>`;
        bars += `<rect x="${x + 6}" y="0" width="3" height="44" fill="currentColor"/>`;
        return `<svg viewBox="0 0 ${x + 12} 44" class="barcode-svg" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
    }

    function showTicketModal(reg) {
        const isPast = currentTab === 'past';
        const passCode = 'EH-' + String(reg.registration_id || reg.event_id).padStart(6, '0');
        const userName = App.currentUser?.name || 'Attendee';
        const userEmail = App.currentUser?.email || '';
        const statusText = isPast ? 'Past Event' : 'Confirmed Admission';
        const statusClass = isPast ? 'badge-past' : 'badge-registered';

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="ticket-header-band">
                <div class="ticket-brand">
                    <span class="ticket-logo">🎟️</span>
                    <div>
                        <div class="ticket-brand-name">EventHub Admission Pass</div>
                        <div class="ticket-pass-id">${App.escapeHtml(passCode)}</div>
                    </div>
                </div>
                <div class="ticket-header-status">
                    <span class="badge ${statusClass}">${statusText}</span>
                    <button class="modal-close ticket-modal-close" aria-label="Close">×</button>
                </div>
            </div>
            <div class="ticket-body">
                <div class="ticket-event-main">
                    <span class="ticket-category-tag">${App.escapeHtml(reg.category || 'General')}</span>
                    <h2 class="ticket-event-title"></h2>
                </div>
                <div class="ticket-details-grid">
                    <div class="ticket-detail-item">
                        <span class="ticket-detail-icon">📅</span>
                        <div><div class="ticket-detail-label">Date & Time</div><div class="ticket-detail-value ticket-date"></div></div>
                    </div>
                    <div class="ticket-detail-item">
                        <span class="ticket-detail-icon">📍</span>
                        <div><div class="ticket-detail-label">Venue / Location</div><div class="ticket-detail-value ticket-venue"></div></div>
                    </div>
                    <div class="ticket-detail-item">
                        <span class="ticket-detail-icon">👤</span>
                        <div><div class="ticket-detail-label">Attendee Name</div><div class="ticket-detail-value ticket-attendee"></div></div>
                    </div>
                    <div class="ticket-detail-item">
                        <span class="ticket-detail-icon">✉️</span>
                        <div><div class="ticket-detail-label">Attendee Email</div><div class="ticket-detail-value ticket-email"></div></div>
                    </div>
                    <div class="ticket-detail-item">
                        <span class="ticket-detail-icon">🕒</span>
                        <div><div class="ticket-detail-label">Registered On</div><div class="ticket-detail-value ticket-registered-at"></div></div>
                    </div>
                    <div class="ticket-detail-item">
                        <span class="ticket-detail-icon">👥</span>
                        <div><div class="ticket-detail-label">Event Capacity</div><div class="ticket-detail-value ticket-capacity"></div></div>
                    </div>
                </div>
                ${reg.description ? `
                    <div class="ticket-section ticket-description-section">
                        <div class="ticket-section-title">About this Event</div>
                        <div class="ticket-description"></div>
                    </div>
                ` : ''}
                <div class="ticket-divider">
                    <div class="ticket-notch ticket-notch-left"></div>
                    <div class="ticket-dashed-line"></div>
                    <div class="ticket-notch ticket-notch-right"></div>
                </div>
                <div class="ticket-barcode-section">
                    <div class="ticket-barcode">${generateBarcodeSvg(passCode)}</div>
                    <div class="ticket-barcode-code">${App.escapeHtml(passCode)}</div>
                    <div class="ticket-notice">Present this digital ticket at the entrance check-in. Non-transferable.</div>
                </div>
            </div>
        `;

        wrapper.querySelector('.ticket-event-title').textContent = reg.title;
        wrapper.querySelector('.ticket-date').textContent = App.formatDateTime(reg.event_date);
        wrapper.querySelector('.ticket-venue').textContent = reg.venue || 'Virtual / Online';
        wrapper.querySelector('.ticket-attendee').textContent = userName;
        wrapper.querySelector('.ticket-email').textContent = userEmail;
        wrapper.querySelector('.ticket-registered-at').textContent = App.formatDateTime(reg.registered_at);
        wrapper.querySelector('.ticket-capacity').textContent = `${reg.capacity} total capacity${reg.remaining_seats !== undefined ? ` (${reg.remaining_seats} remaining)` : ''}`;
        if (reg.description) {
            wrapper.querySelector('.ticket-description').textContent = reg.description;
        }

        App.modal({
            title: null,
            body: wrapper,
            modalClass: 'ticket-modal',
            overlayClass: 'ticket-modal-overlay',
            footerClass: 'ticket-footer',
            buttons: [
                {
                    text: '🖨️ Print / Save Pass',
                    class: 'btn-outline btn-print-ticket',
                    onClick: () => window.print()
                },
                {
                    text: 'Close',
                    class: 'btn-primary btn-close-ticket',
                    onClick: close => close()
                }
            ]
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

    on('click', '.btn-view-ticket', function () {
        const regId = parseInt(this.dataset.regId, 10);
        const eventId = parseInt(this.dataset.eventId, 10);
        const list = registrations[currentTab] || [];
        const reg = list.find(r => (regId && r.registration_id === regId) || r.event_id === eventId);
        if (reg) showTicketModal(reg);
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