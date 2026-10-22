/**
 * admin.js — Admin dashboard with events CRUD, attendees modal, CSV export.
 */
'use strict';

(function ($) {

    let allEvents = [];

    function loadAdminEvents() {
        $('#admin-events-body').html('<tr><td colspan="7" style="text-align:center"><div class="spinner"></div></td></tr>');

        App.api('GET', '/api/events.php', { per_page: 50 }).then(function (res) {
            allEvents = res.data.events;
            renderEventsTable();
            renderStats();
        }).catch(function () {
            App.toast('error', 'Failed to load events.');
        });
    }

    function renderStats() {
        const total = allEvents.length;
        const upcoming = allEvents.filter(function (e) { return e.status !== 'past'; }).length;
        const totalRegs = allEvents.reduce(function (sum, e) { return sum + e.registered_count; }, 0);
        const full = allEvents.filter(function (e) { return e.status === 'full'; }).length;

        $('#stat-total').text(total);
        $('#stat-upcoming').text(upcoming);
        $('#stat-registrations').text(totalRegs);
        $('#stat-full').text(full);
    }

    function renderEventsTable() {
        const $body = $('#admin-events-body');
        $body.empty();

        if (allEvents.length === 0) {
            $body.html('<tr><td colspan="7" class="empty-state" style="padding:3rem"><p>No events yet.</p></td></tr>');
            return;
        }

        allEvents.forEach(function (event) {
            const $row = $(
                '<tr data-event-id="' + event.id + '">' +
                    '<td class="ev-title"></td>' +
                    '<td class="ev-date"></td>' +
                    '<td class="ev-category"></td>' +
                    '<td>' + event.registered_count + ' / ' + event.capacity + '</td>' +
                    '<td>' + App.getStatusBadge(event) + '</td>' +
                    '<td>' +
                        '<div class="table-actions">' +
                            '<button class="btn btn-ghost btn-sm btn-edit" data-event-id="' + event.id + '">Edit</button>' +
                            '<button class="btn btn-ghost btn-sm btn-attendees" data-event-id="' + event.id + '">Attendees</button>' +
                            '<button class="btn btn-ghost btn-sm btn-delete" data-event-id="' + event.id + '" style="color:var(--danger)">Delete</button>' +
                        '</div>' +
                    '</td>' +
                '</tr>'
            );

            $row.find('.ev-title').text(event.title);
            $row.find('.ev-date').text(App.formatDateTime(event.event_date));
            $row.find('.ev-category').text(event.category || '—');

            $body.append($row);
        });
    }

    // ── Create/Edit Modal ────────────────────────────────────────────
    function showEventModal(event) {
        const isEdit = !!event;
        const title = isEdit ? 'Edit Event' : 'Create Event';

        const $overlay = $(
            '<div class="modal-overlay" role="dialog" aria-modal="true">' +
                '<div class="modal modal-large">' +
                    '<div class="modal-header">' +
                        '<h2>' + App.escapeHtml(title) + '</h2>' +
                        '<button class="modal-close" aria-label="Close">×</button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                        '<form id="event-form">' +
                            '<div class="form-group">' +
                                '<label class="form-label" for="ef-title">Title *</label>' +
                                '<input type="text" id="ef-title" name="title" class="form-input" maxlength="200" required>' +
                                '<div class="form-error" id="err-title"></div>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label class="form-label" for="ef-description">Description</label>' +
                                '<textarea id="ef-description" name="description" class="form-textarea form-input"></textarea>' +
                            '</div>' +
                            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
                                '<div class="form-group">' +
                                    '<label class="form-label" for="ef-venue">Venue</label>' +
                                    '<input type="text" id="ef-venue" name="venue" class="form-input" maxlength="200">' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label class="form-label" for="ef-category">Category *</label>' +
                                    '<select id="ef-category" name="category" class="form-select form-input" required>' +
                                        '<option value="">Select Category</option>' +
                                        '<option value="Arts">Arts</option>' +
                                        '<option value="Business">Business</option>' +
                                        '<option value="Food & Drink">Food & Drink</option>' +
                                        '<option value="Music">Music</option>' +
                                        '<option value="Sports">Sports</option>' +
                                        '<option value="Technology">Technology</option>' +
                                    '</select>' +
                                    '<div class="form-error" id="err-category"></div>' +
                                '</div>' +
                            '</div>' +
                            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
                                '<div class="form-group">' +
                                    '<label class="form-label" for="ef-date">Event Date & Time *</label>' +
                                    '<input type="datetime-local" id="ef-date" name="event_date" class="form-input" required>' +
                                    '<div class="form-error" id="err-event_date"></div>' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label class="form-label" for="ef-capacity">Capacity *</label>' +
                                    '<input type="number" id="ef-capacity" name="capacity" class="form-input" min="1" max="100000" required>' +
                                    '<div class="form-error" id="err-capacity"></div>' +
                                '</div>' +
                            '</div>' +
                        '</form>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                        '<button class="btn btn-outline btn-modal-cancel">Cancel</button>' +
                        '<button class="btn btn-primary btn-save-event">' + (isEdit ? 'Update Event' : 'Create Event') + '</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );

        if (isEdit) {
            $overlay.find('#ef-title').val(event.title);
            $overlay.find('#ef-description').val(event.description || '');
            $overlay.find('#ef-venue').val(event.venue || '');
            const defaultCats = ['Arts', 'Business', 'Food & Drink', 'Music', 'Sports', 'Technology'];
            if (event.category && !defaultCats.includes(event.category)) {
                $overlay.find('#ef-category').append($('<option></option>').val(event.category).text(event.category));
            }
            $overlay.find('#ef-category').val(event.category || '');
            $overlay.find('#ef-date').val(App.isoToDatetimeLocal(event.event_date));
            $overlay.find('#ef-capacity').val(event.capacity);
            $overlay.data('event-id', event.id);
        }

        function closeModal() {
            $overlay.addClass('removing');
            setTimeout(function () { $overlay.remove(); }, 200);
        }

        $overlay.find('.btn-modal-cancel, .modal-close').on('click', closeModal);
        $overlay.on('click', function (e) {
            if ($(e.target).hasClass('modal-overlay')) closeModal();
        });

        $overlay.find('.btn-save-event').on('click', function () {
            const $btn = $(this);
            // Clear errors
            $overlay.find('.form-error').removeClass('visible').text('');
            $overlay.find('.form-input').removeClass('error');

            const data = {
                title: $overlay.find('#ef-title').val().trim(),
                description: $overlay.find('#ef-description').val().trim(),
                venue: $overlay.find('#ef-venue').val().trim(),
                category: $overlay.find('#ef-category').val().trim(),
                event_date: $overlay.find('#ef-date').val(),
                capacity: $overlay.find('#ef-capacity').val(),
            };

            let valid = true;
            if (!data.title) {
                $overlay.find('#err-title').text('Title is required.').addClass('visible');
                $overlay.find('#ef-title').addClass('error');
                valid = false;
            }
            if (!data.category) {
                $overlay.find('#err-category').text('Please select a category.').addClass('visible');
                $overlay.find('#ef-category').addClass('error');
                valid = false;
            }
            if (!data.event_date) {
                $overlay.find('#err-event_date').text('Event date is required.').addClass('visible');
                $overlay.find('#ef-date').addClass('error');
                valid = false;
            }
            if (!data.capacity || parseInt(data.capacity, 10) < 1) {
                $overlay.find('#err-capacity').text('Valid capacity (at least 1) is required.').addClass('visible');
                $overlay.find('#ef-capacity').addClass('error');
                valid = false;
            }
            if (!valid) return;

            if (isEdit) {
                data.action = 'update';
                data.id = $overlay.data('event-id');
            } else {
                data.action = 'create';
            }

            $btn.prop('disabled', true).html('<span class="spinner-inline"></span> Saving...');

            App.api('POST', '/api/admin_events.php', data).then(function (res) {
                App.toast('success', res.message);
                closeModal();
                loadAdminEvents();
            }).catch(function (res) {
                $btn.prop('disabled', false).text(isEdit ? 'Update Event' : 'Create Event');
                if (res && res.error) {
                    if (res.error.fields) {
                        Object.keys(res.error.fields).forEach(function (field) {
                            const $errEl = $overlay.find('#err-' + field);
                            $errEl.text(res.error.fields[field]).addClass('visible');
                            $overlay.find('[name="' + field + '"]').addClass('error');
                        });
                    } else {
                        App.toast('error', res.error.message);
                    }
                }
            });
        });

        $('body').append($overlay);
        $overlay.find('#ef-title').focus();
    }

    // ── Attendees Modal ──────────────────────────────────────────────
    function showAttendeesModal(eventId) {
        const event = allEvents.find(function (e) { return e.id === eventId; });
        const eventTitle = event ? event.title : 'Event #' + eventId;

        const $overlay = $(
            '<div class="modal-overlay" role="dialog" aria-modal="true">' +
                '<div class="modal modal-large">' +
                    '<div class="modal-header">' +
                        '<h2>Attendees</h2>' +
                        '<button class="modal-close" aria-label="Close">×</button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                        '<p class="modal-event-title" style="color:var(--text-secondary);margin-bottom:1rem"></p>' +
                        '<div id="attendees-list"><div class="spinner"></div></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                        '<a class="btn btn-outline btn-sm" id="btn-csv-download" href="/api/admin_attendees.php?event_id=' + eventId + '&format=csv" download>Download CSV</a>' +
                        '<button class="btn btn-outline btn-modal-cancel">Close</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );

        $overlay.find('.modal-event-title').text(eventTitle);

        function closeModal() {
            $overlay.addClass('removing');
            setTimeout(function () { $overlay.remove(); }, 200);
        }

        $overlay.find('.btn-modal-cancel, .modal-close').on('click', closeModal);
        $overlay.on('click', function (e) {
            if ($(e.target).hasClass('modal-overlay')) closeModal();
        });

        $('body').append($overlay);

        // Load attendees
        App.api('GET', '/api/admin_attendees.php', { event_id: eventId }).then(function (res) {
            const attendees = res.data.attendees;
            const $list = $('#attendees-list');
            $list.empty();

            if (attendees.length === 0) {
                $list.html('<div class="empty-state" style="padding:2rem"><p>No attendees yet.</p></div>');
                return;
            }

            $list.append('<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:0.5rem">' + attendees.length + ' attendee(s)</p>');

            const $container = $('<div class="attendee-list"></div>');
            attendees.forEach(function (a) {
                const $item = $(
                    '<div class="attendee-item">' +
                        '<div>' +
                            '<div class="att-name" style="font-weight:600;color:var(--text-primary)"></div>' +
                            '<div class="att-email" style="font-size:0.75rem;color:var(--text-muted)"></div>' +
                        '</div>' +
                        '<div class="att-date" style="font-size:0.75rem;color:var(--text-muted)"></div>' +
                    '</div>'
                );
                $item.find('.att-name').text(a.name);
                $item.find('.att-email').text(a.email);
                $item.find('.att-date').text(App.formatDateTime(a.registered_at));
                $container.append($item);
            });
            $list.append($container);
        }).catch(function () {
            $('#attendees-list').html('<div class="empty-state"><p>Failed to load attendees.</p></div>');
        });
    }

    // ── Event handlers ───────────────────────────────────────────────
    $(document).on('click', '#btn-create-event', function () {
        showEventModal(null);
    });

    $(document).on('click', '.btn-edit', function () {
        const eventId = parseInt($(this).data('event-id'), 10);
        const event = allEvents.find(function (e) { return e.id === eventId; });
        if (event) showEventModal(event);
    });

    $(document).on('click', '.btn-attendees', function () {
        const eventId = parseInt($(this).data('event-id'), 10);
        showAttendeesModal(eventId);
    });

    $(document).on('click', '.btn-delete', function () {
        const eventId = parseInt($(this).data('event-id'), 10);
        const event = allEvents.find(function (e) { return e.id === eventId; });
        const title = event ? event.title : 'this event';

        App.confirm(
            'Delete Event',
            'Are you sure you want to delete "' + title + '"? This will also remove all registrations. This action cannot be undone.',
            'Delete',
            'btn-danger'
        ).then(function (confirmed) {
            if (!confirmed) return;

            App.api('POST', '/api/admin_events.php', { action: 'delete', id: eventId }).then(function (res) {
                App.toast('success', res.message);
                loadAdminEvents();
            }).catch(function (res) {
                if (res && res.error) App.toast('error', res.error.message);
            });
        });
    });

    // ── Init ─────────────────────────────────────────────────────────
    App.init(function (user) {
        if (window.location.pathname !== '/admin.html') return;
        if (!user || user.role !== 'admin') {
            window.location.href = '/index.html';
            return;
        }
        loadAdminEvents();
    });

})(jQuery);
