/**
 * event-detail.js — Single event detail page with live seat polling.
 */
'use strict';

(function ($) {

    let pollInterval = null;
    let eventId = null;

    function getEventId() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('id'), 10) || null;
    }

    function loadEvent() {
        if (!eventId) {
            $('#event-content').html(
                '<div class="empty-state"><div class="empty-state-icon">❓</div>' +
                '<h3>Event not found</h3><p>No event ID specified.</p>' +
                '<a href="/index.html" class="btn btn-outline" style="margin-top:1rem">Back to Events</a></div>'
            );
            return;
        }

        $('#event-content').html('<div class="spinner"></div>');

        App.api('GET', '/api/event.php', { id: eventId }).then(function (res) {
            renderEvent(res.data);
        }).catch(function (res) {
            let msg = 'Event not found.';
            if (res && res.error) msg = res.error.message;
            $('#event-content').html(
                '<div class="empty-state"><div class="empty-state-icon">😔</div>' +
                '<h3>' + App.escapeHtml(msg) + '</h3>' +
                '<a href="/index.html" class="btn btn-outline" style="margin-top:1rem">Back to Events</a></div>'
            );
        });
    }

    function renderEvent(event) {
        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);
        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;

        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = '<button class="btn btn-danger btn-lg btn-cancel-detail" data-event-id="' + event.id + '">Cancel Registration</button>';
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Full — No Seats Available</button>';
        } else {
            actionBtn = '<button class="btn btn-primary btn-lg btn-register-detail" data-event-id="' + event.id + '">Register for This Event</button>';
        }

        const $content = $(
            '<div class="event-detail">' +
                '<div class="event-detail-header">' +
                    '<a href="/index.html" class="btn btn-ghost btn-sm" style="margin-bottom:1rem">← Back to Events</a>' +
                    '<h1 class="event-detail-title"></h1>' +
                    '<div style="margin-top:0.5rem">' + App.getStatusBadge(event) + '</div>' +
                '</div>' +
                '<div class="event-detail-info">' +
                    '<div class="detail-info-item">' +
                        '<div class="detail-info-icon">📅</div>' +
                        '<div class="detail-info-text">' +
                            '<div class="label">Date & Time</div>' +
                            '<div class="value detail-date"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="detail-info-item">' +
                        '<div class="detail-info-icon">📍</div>' +
                        '<div class="detail-info-text">' +
                            '<div class="label">Venue</div>' +
                            '<div class="value detail-venue"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="detail-info-item">' +
                        '<div class="detail-info-icon">🏷️</div>' +
                        '<div class="detail-info-text">' +
                            '<div class="label">Category</div>' +
                            '<div class="value detail-category"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="detail-info-item">' +
                        '<div class="detail-info-icon">💺</div>' +
                        '<div class="detail-info-text">' +
                            '<div class="label">Availability</div>' +
                            '<div class="value detail-seats" aria-live="polite"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="capacity-bar-container" style="margin-bottom:2rem">' +
                    '<div class="capacity-bar" style="height:8px">' +
                        '<div class="capacity-bar-fill ' + barClass + '" style="width:' + fillPercent + '%"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="event-detail-description"></div>' +
                '<div class="event-detail-actions" aria-live="polite">' + actionBtn + '</div>' +
            '</div>'
        );

        $content.find('.event-detail-title').text(event.title);
        $content.find('.detail-date').text(App.formatDateTime(event.event_date));
        $content.find('.detail-venue').text(event.venue || 'TBD');
        $content.find('.detail-category').text(event.category || 'General');
        $content.find('.detail-seats').text(event.remaining_seats + ' of ' + event.capacity + ' seats left');
        $content.find('.event-detail-description').text(event.description || 'No description available.');

        document.title = event.title + ' — EventHub';

        $('#event-content').empty().append($content);
    }

    function updateEventDetail(event) {
        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);

        $('.detail-seats').text(event.remaining_seats + ' of ' + event.capacity + ' seats left');
        const $fill = $('.capacity-bar-fill');
        $fill.css('width', fillPercent + '%').removeClass('low medium high full').addClass(barClass);

        // Update badge
        const $badge = $('.event-detail-header .badge');
        if ($badge.length) $badge.replaceWith(App.getStatusBadge(event));

        // Update action
        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;
        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = '<button class="btn btn-danger btn-lg btn-cancel-detail" data-event-id="' + event.id + '">Cancel Registration</button>';
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-lg" disabled>Full — No Seats Available</button>';
        } else {
            actionBtn = '<button class="btn btn-primary btn-lg btn-register-detail" data-event-id="' + event.id + '">Register for This Event</button>';
        }
        $('.event-detail-actions').html(actionBtn);
    }

    // ── Polling ──────────────────────────────────────────────────────
    function startPolling() {
        pollInterval = setInterval(function () {
            App.api('GET', '/api/event.php', { id: eventId }).then(function (res) {
                if (res.success) {
                    const oldSeats = $('.detail-seats').text();
                    updateEventDetail(res.data);
                    const newSeats = res.data.remaining_seats + ' of ' + res.data.capacity + ' seats left';
                    if (oldSeats !== newSeats) {
                        $('.event-detail').addClass('seat-updated');
                        setTimeout(function () { $('.event-detail').removeClass('seat-updated'); }, 1000);
                    }
                }
            });
        }, 5000);
    }

    $(document).on('visibilitychange', function () {
        if (document.hidden) {
            if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        } else {
            if (eventId) {
                App.api('GET', '/api/event.php', { id: eventId }).then(function (res) {
                    if (res.success) updateEventDetail(res.data);
                });
                startPolling();
            }
        }
    });

    // ── Register ─────────────────────────────────────────────────────
    $(document).on('click', '.btn-register-detail', function () {
        if (!App.currentUser) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = '/login.html?next=' + next;
            return;
        }

        const $btn = $(this);
        $btn.prop('disabled', true).html('<span class="spinner-inline"></span> Registering...');

        App.api('POST', '/api/register.php', { event_id: eventId }).then(function (res) {
            App.toast('success', res.message);
            updateEventDetail(res.data);
        }).catch(function (res) {
            if (res && res.error) {
                App.toast('error', res.error.message);
                loadEvent(); // Refresh
            }
        });
    });

    // ── Cancel ───────────────────────────────────────────────────────
    $(document).on('click', '.btn-cancel-detail', function () {
        const $btn = $(this);
        App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel your registration?',
            'Yes, Cancel',
            'btn-danger'
        ).then(function (confirmed) {
            if (!confirmed) return;
            $btn.prop('disabled', true).html('<span class="spinner-inline"></span> Cancelling...');

            App.api('POST', '/api/cancel.php', { event_id: eventId }).then(function (res) {
                App.toast('success', res.message);
                updateEventDetail(res.data);
            }).catch(function (res) {
                if (res && res.error) App.toast('error', res.error.message);
                loadEvent();
            });
        });
    });

    // ── Init ─────────────────────────────────────────────────────────
    App.init(function () {
        if (window.location.pathname !== '/event.html') return;
        eventId = getEventId();
        loadEvent();
        if (eventId) startPolling();
    });

})(jQuery);
