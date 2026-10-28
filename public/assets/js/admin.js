'use strict';

(() => {
    let allEvents = [];

    async function loadAdminEvents() {
        const body = $('#admin-events-body');
        if (body) body.innerHTML = '<tr><td colspan="7" style="text-align:center"><div class="spinner"></div></td></tr>';

        try {
            const res = await App.api('GET', '/api/events.php', { per_page: 50 });
            allEvents = res.data.events;
            renderEventsTable();
            renderStats();
        } catch {
            App.toast('error', 'Failed to load events.');
        }
    }

    function renderStats() {
        const total = allEvents.length;
        const upcoming = allEvents.filter(e => e.status !== 'past').length;
        const totalRegs = allEvents.reduce((sum, e) => sum + e.registered_count, 0);
        const full = allEvents.filter(e => e.status === 'full').length;

        const statTotal = $('#stat-total');
        const statUpcoming = $('#stat-upcoming');
        const statRegs = $('#stat-registrations');
        const statFull = $('#stat-full');

        if (statTotal) statTotal.textContent = total;
        if (statUpcoming) statUpcoming.textContent = upcoming;
        if (statRegs) statRegs.textContent = totalRegs;
        if (statFull) statFull.textContent = full;
    }

    function renderEventsTable() {
        const body = $('#admin-events-body');
        if (!body) return;
        body.innerHTML = '';

        if (allEvents.length === 0) {
            body.innerHTML = '<tr><td colspan="7" class="empty-state" style="padding:3rem"><p>No events yet.</p></td></tr>';
            return;
        }

        allEvents.forEach(event => {
            const row = document.createElement('tr');
            row.dataset.eventId = event.id;
            row.innerHTML = `
                <td class="ev-title"></td>
                <td class="ev-date"></td>
                <td class="ev-category"></td>
                <td>${event.registered_count} / ${event.capacity}</td>
                <td>${App.getStatusBadge(event)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-ghost btn-sm btn-edit" data-event-id="${event.id}">Edit</button>
                        <button class="btn btn-ghost btn-sm btn-attendees" data-event-id="${event.id}">Attendees</button>
                        <button class="btn btn-ghost btn-sm btn-delete" data-event-id="${event.id}" style="color:var(--danger)">Delete</button>
                    </div>
                </td>
            `;

            row.querySelector('.ev-title').textContent = event.title;
            row.querySelector('.ev-date').textContent = App.formatDateTime(event.event_date);
            row.querySelector('.ev-category').textContent = event.category || '—';

            body.appendChild(row);
        });
    }

    function showEventModal(event) {
        const isEdit = !!event;
        const modalTitle = isEdit ? 'Edit Event' : 'Create Event';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="modal modal-large">
                <div class="modal-header">
                    <h2>${App.escapeHtml(modalTitle)}</h2>
                    <button class="modal-close" aria-label="Close">×</button>
                </div>
                <div class="modal-body">
                    <form id="event-form">
                        <div class="form-group">
                            <label class="form-label" for="ef-title">Title *</label>
                            <input type="text" id="ef-title" name="title" class="form-input" maxlength="200" required>
                            <div class="form-error" id="err-title"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="ef-description">Description</label>
                            <textarea id="ef-description" name="description" class="form-textarea form-input"></textarea>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                            <div class="form-group">
                                <label class="form-label" for="ef-venue">Venue</label>
                                <input type="text" id="ef-venue" name="venue" class="form-input" maxlength="200">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="ef-category">Category *</label>
                                <select id="ef-category" name="category" class="form-select form-input" required>
                                    <option value="">Select Category</option>
                                    <option value="Arts">Arts</option>
                                    <option value="Business">Business</option>
                                    <option value="Food & Drink">Food & Drink</option>
                                    <option value="Music">Music</option>
                                    <option value="Sports">Sports</option>
                                    <option value="Technology">Technology</option>
                                </select>
                                <div class="form-error" id="err-category"></div>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                            <div class="form-group">
                                <label class="form-label" for="ef-date">Event Date & Time *</label>
                                <input type="datetime-local" id="ef-date" name="event_date" class="form-input" required>
                                <div class="form-error" id="err-event_date"></div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="ef-capacity">Capacity *</label>
                                <input type="number" id="ef-capacity" name="capacity" class="form-input" min="1" max="100000" required>
                                <div class="form-error" id="err-capacity"></div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline btn-modal-cancel">Cancel</button>
                    <button class="btn btn-primary btn-save-event">${isEdit ? 'Update Event' : 'Create Event'}</button>
                </div>
            </div>
        `;

        if (isEdit) {
            overlay.querySelector('#ef-title').value = event.title;
            overlay.querySelector('#ef-description').value = event.description || '';
            overlay.querySelector('#ef-venue').value = event.venue || '';
            const defaultCats = ['Arts', 'Business', 'Food & Drink', 'Music', 'Sports', 'Technology'];
            if (event.category && !defaultCats.includes(event.category)) {
                const opt = document.createElement('option');
                opt.value = event.category;
                opt.textContent = event.category;
                overlay.querySelector('#ef-category').appendChild(opt);
            }
            overlay.querySelector('#ef-category').value = event.category || '';
            overlay.querySelector('#ef-date').value = App.isoToDatetimeLocal(event.event_date);
            overlay.querySelector('#ef-capacity').value = event.capacity;
        }

        const closeModal = () => {
            document.removeEventListener('keydown', onKeyDown);
            overlay.classList.add('removing');
            setTimeout(() => overlay.remove(), 200);
        };

        const onKeyDown = e => {
            if (e.key === 'Escape') closeModal();
        };

        overlay.querySelector('.btn-modal-cancel').addEventListener('click', closeModal);
        overlay.querySelector('.modal-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', onKeyDown);

        overlay.querySelector('.btn-save-event').addEventListener('click', async function () {
            const btn = this;
            overlay.querySelectorAll('.form-error').forEach(el => {
                el.classList.remove('visible');
                el.textContent = '';
            });
            overlay.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));

            const data = {
                title: overlay.querySelector('#ef-title').value.trim(),
                description: overlay.querySelector('#ef-description').value.trim(),
                venue: overlay.querySelector('#ef-venue').value.trim(),
                category: overlay.querySelector('#ef-category').value.trim(),
                event_date: overlay.querySelector('#ef-date').value,
                capacity: overlay.querySelector('#ef-capacity').value
            };

            let valid = true;
            if (!data.title) {
                overlay.querySelector('#err-title').textContent = 'Title is required.';
                overlay.querySelector('#err-title').classList.add('visible');
                overlay.querySelector('#ef-title').classList.add('error');
                valid = false;
            }
            if (!data.category) {
                overlay.querySelector('#err-category').textContent = 'Please select a category.';
                overlay.querySelector('#err-category').classList.add('visible');
                overlay.querySelector('#ef-category').classList.add('error');
                valid = false;
            }
            if (!data.event_date) {
                overlay.querySelector('#err-event_date').textContent = 'Event date is required.';
                overlay.querySelector('#err-event_date').classList.add('visible');
                overlay.querySelector('#ef-date').classList.add('error');
                valid = false;
            }
            if (!data.capacity || parseInt(data.capacity, 10) < 1) {
                overlay.querySelector('#err-capacity').textContent = 'Valid capacity (at least 1) is required.';
                overlay.querySelector('#err-capacity').classList.add('visible');
                overlay.querySelector('#ef-capacity').classList.add('error');
                valid = false;
            }
            if (!valid) return;

            if (isEdit) {
                data.action = 'update';
                data.id = event.id;
            } else {
                data.action = 'create';
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-inline"></span> Saving...';

            try {
                const res = await App.api('POST', '/api/admin_events.php', data);
                App.toast('success', res.message);
                closeModal();
                loadAdminEvents();
            } catch (res) {
                btn.disabled = false;
                btn.textContent = isEdit ? 'Update Event' : 'Create Event';
                if (res?.error) {
                    if (res.error.fields) {
                        Object.entries(res.error.fields).forEach(([field, msg]) => {
                            const errEl = overlay.querySelector(`#err-${field}`);
                            if (errEl) {
                                errEl.textContent = msg;
                                errEl.classList.add('visible');
                            }
                            overlay.querySelector(`[name="${field}"]`)?.classList.add('error');
                        });
                    } else {
                        App.toast('error', res.error.message);
                    }
                }
            }
        });

        document.body.appendChild(overlay);
        overlay.querySelector('#ef-title').focus();
    }

    async function showAttendeesModal(eventId) {
        const event = allEvents.find(e => e.id === eventId);
        const eventTitle = event ? event.title : `Event #${eventId}`;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="modal modal-large">
                <div class="modal-header">
                    <h2>Attendees</h2>
                    <button class="modal-close" aria-label="Close">×</button>
                </div>
                <div class="modal-body">
                    <p class="modal-event-title" style="color:var(--text-secondary);margin-bottom:1rem"></p>
                    <div id="attendees-list"><div class="spinner"></div></div>
                </div>
                <div class="modal-footer">
                    <a class="btn btn-outline btn-sm" id="btn-csv-download" href="/api/admin_attendees.php?event_id=${eventId}&format=csv" download>Download CSV</a>
                    <button class="btn btn-outline btn-modal-cancel">Close</button>
                </div>
            </div>
        `;

        overlay.querySelector('.modal-event-title').textContent = eventTitle;

        const closeModal = () => {
            document.removeEventListener('keydown', onKeyDown);
            overlay.classList.add('removing');
            setTimeout(() => overlay.remove(), 200);
        };

        const onKeyDown = e => {
            if (e.key === 'Escape') closeModal();
        };

        overlay.querySelector('.btn-modal-cancel').addEventListener('click', closeModal);
        overlay.querySelector('.modal-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', onKeyDown);

        document.body.appendChild(overlay);

        try {
            const res = await App.api('GET', '/api/admin_attendees.php', { event_id: eventId });
            const attendees = res.data.attendees;
            const list = overlay.querySelector('#attendees-list');
            if (!list) return;

            if (attendees.length === 0) {
                list.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No attendees yet.</p></div>';
                return;
            }

            list.innerHTML = `<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:0.5rem">${attendees.length} attendee(s)</p>`;
            const container = document.createElement('div');
            container.className = 'attendee-list';

            attendees.forEach(a => {
                const item = document.createElement('div');
                item.className = 'attendee-item';
                item.innerHTML = `
                    <div>
                        <div class="att-name" style="font-weight:600;color:var(--text-primary)"></div>
                        <div class="att-email" style="font-size:0.75rem;color:var(--text-muted)"></div>
                    </div>
                    <div class="att-date" style="font-size:0.75rem;color:var(--text-muted)"></div>
                `;
                item.querySelector('.att-name').textContent = a.name;
                item.querySelector('.att-email').textContent = a.email;
                item.querySelector('.att-date').textContent = App.formatDateTime(a.registered_at);
                container.appendChild(item);
            });

            list.appendChild(container);
        } catch {
            const list = overlay.querySelector('#attendees-list');
            if (list) list.innerHTML = '<div class="empty-state"><p>Failed to load attendees.</p></div>';
        }
    }

    on('click', '#btn-create-event', () => showEventModal(null));

    on('click', '.btn-edit', function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        const event = allEvents.find(e => e.id === eventId);
        if (event) showEventModal(event);
    });

    on('click', '.btn-attendees', function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        showAttendeesModal(eventId);
    });

    on('click', '.btn-delete', async function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        const event = allEvents.find(e => e.id === eventId);
        const title = event ? event.title : 'this event';

        const confirmed = await App.confirm(
            'Delete Event',
            `Are you sure you want to delete "${title}"? This will also remove all registrations. This action cannot be undone.`,
            'Delete',
            'btn-danger'
        );
        if (!confirmed) return;

        try {
            const res = await App.api('POST', '/api/admin_events.php', { action: 'delete', id: eventId });
            App.toast('success', res.message);
            loadAdminEvents();
        } catch (res) {
            if (res?.error) App.toast('error', res.error.message);
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        App.init(user => {
            if (window.location.pathname !== '/admin.html') return;
            if (!user || user.role !== 'admin') {
                window.location.href = '/index.html';
                return;
            }
            loadAdminEvents();
        });
    });
})();