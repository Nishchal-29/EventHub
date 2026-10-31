/**
 * admin.js — Administrator dashboard.
 * Provides event statistics, event creation and deletion dialogs,
 * and attendee roster view for administrative users.
 */
'use strict';

(() => {
    let allEvents = [];

    function renderStats() {
        const stats = {
            'stat-total': allEvents.length,
            'stat-upcoming': allEvents.filter(e => e.status !== 'past').length,
            'stat-registrations': allEvents.reduce((sum, e) => sum + e.registered_count, 0),
            'stat-full': allEvents.filter(e => e.status === 'full').length
        };
        Object.entries(stats).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    function renderEventsTable() {
        const body = $('#admin-events-body');
        if (!body) return;
        body.innerHTML = '';

        if (allEvents.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="empty-state p-12 text-center"><p>No events yet.</p></td></tr>';
            return;
        }

        allEvents.forEach(event => {
            const row = document.createElement('tr');
            row.dataset.eventId = event.id;
            row.innerHTML = `
                <td class="ev-title"></td>
                <td class="ev-date"></td>
                <td>${event.registered_count} / ${event.capacity}</td>
                <td>${App.getStatusBadge(event)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-ghost btn-sm btn-attendees" data-event-id="${event.id}">Attendees</button>
                        <button class="btn btn-ghost btn-sm btn-delete text-danger" data-event-id="${event.id}">Delete</button>
                    </div>
                </td>
            `;

            row.querySelector('.ev-title').textContent = event.title;
            row.querySelector('.ev-date').textContent = App.formatDateTime(event.event_date);

            body.appendChild(row);
        });
    }

    async function loadAdminEvents() {
        const body = $('#admin-events-body');
        if (body) body.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner"></div></td></tr>';

        try {
            const res = await App.api('GET', '/api/events.php');
            allEvents = res.data.events || [];
            renderEventsTable();
            renderStats();
        } catch {
            App.toast('error', 'Failed to load events.');
        }
    }

    function showCreateEventModal() {
        const form = document.createElement('form');
        form.id = 'event-form';
        form.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="ef-title">Title *</label>
                <input type="text" id="ef-title" name="title" class="form-input" maxlength="200" required>
                <div class="form-error" id="err-title"></div>
            </div>
            <div class="form-group">
                <label class="form-label" for="ef-description">Description</label>
                <textarea id="ef-description" name="description" class="form-textarea form-input"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label" for="ef-venue">Venue</label>
                <input type="text" id="ef-venue" name="venue" class="form-input" maxlength="200">
            </div>
            <div class="grid-2-col">
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
        `;

        const m = App.modal({
            title: 'Create Event',
            body: form,
            modalClass: 'modal-large',
            buttons: [
                {
                    text: 'Cancel',
                    class: 'btn-outline btn-modal-cancel',
                    onClick: close => close()
                },
                {
                    text: 'Create Event',
                    class: 'btn-primary btn-save-event',
                    onClick: async close => {
                        App.clearFieldErrors(form);
                        const data = {
                            action: 'create',
                            title: form.querySelector('#ef-title').value.trim(),
                            description: form.querySelector('#ef-description').value.trim(),
                            venue: form.querySelector('#ef-venue').value.trim(),
                            event_date: form.querySelector('#ef-date').value,
                            capacity: form.querySelector('#ef-capacity').value
                        };

                        const errors = {};
                        if (!data.title) errors.title = 'Title is required.';
                        if (!data.event_date) errors.event_date = 'Event date is required.';
                        if (!data.capacity || parseInt(data.capacity, 10) < 1) {
                            errors.capacity = 'Valid capacity (at least 1) is required.';
                        }

                        if (Object.keys(errors).length > 0) {
                            App.showFieldErrors(form, errors);
                            return;
                        }

                        const saveBtn = m.modalBox.querySelector('.btn-save-event');
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<span class="spinner-inline"></span> Saving...';

                        try {
                            const res = await App.api('POST', '/api/admin.php', data);
                            App.toast('success', res.message || 'Event created.');
                            close();
                            loadAdminEvents();
                        } catch (res) {
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Create Event';
                            if (res?.error?.fields) {
                                App.showFieldErrors(form, res.error.fields);
                            } else if (res?.error) {
                                App.toast('error', res.error.message);
                            }
                        }
                    }
                }
            ]
        });
    }

    async function showAttendeesModal(eventId) {
        const ev = allEvents.find(e => e.id === eventId);
        const titleText = ev ? ev.title : `Event #${eventId}`;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <p class="modal-event-title text-secondary mb-4"></p>
            <div id="attendees-list"><div class="spinner"></div></div>
        `;
        wrapper.querySelector('.modal-event-title').textContent = titleText;

        App.modal({
            title: 'Attendees',
            body: wrapper,
            modalClass: 'modal-large',
            buttons: [
                {
                    text: 'Close',
                    class: 'btn-outline',
                    onClick: close => close()
                }
            ]
        });

        try {
            const res = await App.api('GET', '/api/admin.php', { attendees: eventId });
            const attendees = res.data.attendees || [];
            const list = wrapper.querySelector('#attendees-list');
            if (!list) return;

            if (attendees.length === 0) {
                list.innerHTML = '<div class="empty-state p-8"><p>No attendees yet.</p></div>';
                return;
            }

            list.innerHTML = `<p class="text-muted font-xs mb-2">${attendees.length} attendee(s)</p>`;
            const container = document.createElement('div');
            container.className = 'attendee-list';

            attendees.forEach(a => {
                const item = document.createElement('div');
                item.className = 'attendee-item';
                item.innerHTML = `
                    <div>
                        <div class="att-name font-bold text-primary"></div>
                        <div class="att-email font-xs text-muted"></div>
                    </div>
                    <div class="att-date font-xs text-muted"></div>
                `;
                item.querySelector('.att-name').textContent = a.name;
                item.querySelector('.att-email').textContent = a.email;
                item.querySelector('.att-date').textContent = App.formatDateTime(a.registered_at);
                container.appendChild(item);
            });

            list.appendChild(container);
        } catch {
            const list = wrapper.querySelector('#attendees-list');
            if (list) list.innerHTML = '<div class="empty-state"><p>Failed to load attendees.</p></div>';
        }
    }

    on('click', '#btn-create-event', () => showCreateEventModal());

    on('click', '.btn-attendees', function () {
        showAttendeesModal(parseInt(this.dataset.eventId, 10));
    });

    on('click', '.btn-delete', async function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        const ev = allEvents.find(e => e.id === eventId);
        const name = ev ? ev.title : 'this event';

        const ok = await App.confirm(
            'Delete Event',
            `Are you sure you want to delete "${name}"? This will also remove all registrations. This action cannot be undone.`,
            'Delete',
            'btn-danger'
        );
        if (!ok) return;

        try {
            const res = await App.api('POST', '/api/admin.php', { action: 'delete', id: eventId });
            App.toast('success', res.message || 'Event deleted.');
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
