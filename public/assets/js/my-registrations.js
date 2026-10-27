/**
 * my-registrations.js — User's registrations with upcoming/past tabs and cancel.
 */
'use strict';

(function ($) {

    let registrations = { upcoming: [], past: [] };

    function loadRegistrations() {
        $('#registrations-content').html('<div class="spinner"></div>');

        App.api('GET', '/api/my_registrations.php').then(function (res) {
            registrations = res.data;
            updateTabCounts();
            renderTab('upcoming');
        }).catch(function () {
            $('#registrations-content').html(
                '<div class="empty-state"><div class="empty-state-icon">⚠️</div>' +
                '<h3>Failed to load registrations</h3></div>'
            );
        });
    }

    function updateTabCounts() {
        $('#tab-upcoming .tab-count').text(registrations.upcoming.length);
        $('#tab-past .tab-count').text(registrations.past.length);
    }

    function renderTab(tab) {
        const items = registrations[tab] || [];
        const $content = $('#registrations-content');
        $content.empty();

        if (items.length === 0) {
            const msg = tab === 'upcoming'
                ? 'You have no upcoming registrations.'
                : 'No past registrations.';
            $content.html(
                '<div class="empty-state"><div class="empty-state-icon">' + (tab === 'upcoming' ? '🎫' : '📋') + '</div>' +
                '<h3>' + msg + '</h3>' +
                '<p>' + (tab === 'upcoming' ? '<a href="/index.html">Browse events</a> to get started.' : '') + '</p></div>'
            );
            return;
        }

        items.forEach(function (reg) {
            const isPast = new Date(reg.event_date) <= new Date();
            let cancelBtn = '';
            if (!isPast) {
                cancelBtn = '<button class="btn btn-danger btn-sm btn-cancel-myreg" data-event-id="' + reg.event_id + '">Cancel</button>';
            }

            const viewTicketBtn = '<button class="btn btn-outline btn-sm btn-view-ticket" data-reg-id="' + reg.registration_id + '" data-event-id="' + reg.event_id + '">🎫 View Ticket</button>';

            const $card = $(
                '<div class="card registration-card" data-event-id="' + reg.event_id + '">' +
                    '<div class="registration-info">' +
                        '<h4><a class="reg-title" href="/event.html?id=' + reg.event_id + '"></a></h4>' +
                        '<div class="registration-meta">' +
                            '<span class="meta-date">📅 </span>' +
                            (reg.venue ? '<span class="meta-venue">📍 </span>' : '') +
                            '<span class="meta-reg-date">Registered: </span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="registration-actions">' +
                        viewTicketBtn +
                        cancelBtn +
                    '</div>' +
                '</div>'
            );

            $card.find('.reg-title').text(reg.title);
            $card.find('.meta-date').append(document.createTextNode(App.formatDateTime(reg.event_date)));
            if (reg.venue) $card.find('.meta-venue').append(document.createTextNode(reg.venue));
            $card.find('.meta-reg-date').append(document.createTextNode(App.formatDateTime(reg.registered_at)));

            $content.append($card);
        });
    }

    // ── Barcode Generator (Scalable SVG) ─────────────────────────────
    function generateBarcodeSvg(code) {
        let bars = '';
        let x = 12;
        for (let i = 0; i < code.length; i++) {
            const charCode = code.charCodeAt(i);
            const w1 = (charCode % 3) + 1;
            const w2 = ((charCode >> 1) % 2) + 1;
            const w3 = ((charCode >> 2) % 3) + 1;
            bars += '<rect x="' + x + '" y="0" width="' + w1 + '" height="44" fill="currentColor"/>';
            x += w1 + 2;
            bars += '<rect x="' + x + '" y="0" width="' + w2 + '" height="44" fill="currentColor"/>';
            x += w2 + 2;
            bars += '<rect x="' + x + '" y="0" width="' + w3 + '" height="44" fill="currentColor"/>';
            x += w3 + 3;
        }
        bars += '<rect x="' + (x + 2) + '" y="0" width="2" height="44" fill="currentColor"/>';
        bars += '<rect x="' + (x + 6) + '" y="0" width="3" height="44" fill="currentColor"/>';
        const totalWidth = x + 12;
        return '<svg viewBox="0 0 ' + totalWidth + ' 44" class="barcode-svg" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + bars + '</svg>';
    }

    // ── Ticket Modal (Detailed Preview) ──────────────────────────────
    function showTicketModal(reg) {
        const isPast = new Date(reg.event_date) <= new Date();
        const passCode = 'EH-' + String(reg.registration_id || reg.event_id).padStart(6, '0');
        const userName = App.currentUser ? App.currentUser.name : 'Attendee';
        const userEmail = App.currentUser ? App.currentUser.email : '';
        const statusText = isPast ? 'Past Event' : 'Confirmed Admission';
        const statusClass = isPast ? 'badge-past' : 'badge-registered';

        const $overlay = $(
            '<div class="modal-overlay ticket-modal-overlay" role="dialog" aria-modal="true">' +
                '<div class="modal modal-large ticket-modal">' +
                    '<div class="ticket-header-band">' +
                        '<div class="ticket-brand">' +
                            '<span class="ticket-logo">🎟️</span>' +
                            '<div>' +
                                '<div class="ticket-brand-name">EventHub Admission Pass</div>' +
                                '<div class="ticket-pass-id">' + App.escapeHtml(passCode) + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="ticket-header-status">' +
                            '<span class="badge ' + statusClass + '">' + statusText + '</span>' +
                            '<button class="modal-close ticket-modal-close" aria-label="Close">×</button>' +
                        '</div>' +
                    '</div>' +

                    '<div class="ticket-body">' +
                        '<div class="ticket-event-main">' +
                            '<span class="ticket-category-tag">' + App.escapeHtml(reg.category || 'General') + '</span>' +
                            '<h2 class="ticket-event-title"></h2>' +
                        '</div>' +

                        '<div class="ticket-details-grid">' +
                            '<div class="ticket-detail-item">' +
                                '<span class="ticket-detail-icon">📅</span>' +
                                '<div>' +
                                    '<div class="ticket-detail-label">Date & Time</div>' +
                                    '<div class="ticket-detail-value ticket-date"></div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="ticket-detail-item">' +
                                '<span class="ticket-detail-icon">📍</span>' +
                                '<div>' +
                                    '<div class="ticket-detail-label">Venue / Location</div>' +
                                    '<div class="ticket-detail-value ticket-venue"></div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="ticket-detail-item">' +
                                '<span class="ticket-detail-icon">👤</span>' +
                                '<div>' +
                                    '<div class="ticket-detail-label">Attendee Name</div>' +
                                    '<div class="ticket-detail-value ticket-attendee"></div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="ticket-detail-item">' +
                                '<span class="ticket-detail-icon">✉️</span>' +
                                '<div>' +
                                    '<div class="ticket-detail-label">Attendee Email</div>' +
                                    '<div class="ticket-detail-value ticket-email"></div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="ticket-detail-item">' +
                                '<span class="ticket-detail-icon">🕒</span>' +
                                '<div>' +
                                    '<div class="ticket-detail-label">Registered On</div>' +
                                    '<div class="ticket-detail-value ticket-registered-at"></div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="ticket-detail-item">' +
                                '<span class="ticket-detail-icon">👥</span>' +
                                '<div>' +
                                    '<div class="ticket-detail-label">Event Capacity</div>' +
                                    '<div class="ticket-detail-value ticket-capacity"></div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        (reg.description ?
                            '<div class="ticket-section ticket-description-section">' +
                                '<div class="ticket-section-title">About this Event</div>' +
                                '<div class="ticket-description"></div>' +
                            '</div>' : '') +

                        '<div class="ticket-divider">' +
                            '<div class="ticket-notch ticket-notch-left"></div>' +
                            '<div class="ticket-dashed-line"></div>' +
                            '<div class="ticket-notch ticket-notch-right"></div>' +
                        '</div>' +

                        '<div class="ticket-barcode-section">' +
                            '<div class="ticket-barcode">' +
                                generateBarcodeSvg(passCode) +
                            '</div>' +
                            '<div class="ticket-barcode-code">' + App.escapeHtml(passCode) + '</div>' +
                            '<div class="ticket-notice">Present this digital ticket at the entrance check-in. Non-transferable.</div>' +
                        '</div>' +
                    '</div>' +

                    '<div class="modal-footer ticket-footer">' +
                        '<button class="btn btn-outline btn-print-ticket">🖨️ Print / Save Pass</button>' +
                        '<button class="btn btn-primary btn-close-ticket">Close</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );

        $overlay.find('.ticket-event-title').text(reg.title);
        $overlay.find('.ticket-date').text(App.formatDateTime(reg.event_date));
        $overlay.find('.ticket-venue').text(reg.venue || 'Virtual / Online');
        $overlay.find('.ticket-attendee').text(userName);
        $overlay.find('.ticket-email').text(userEmail);
        $overlay.find('.ticket-registered-at').text(App.formatDateTime(reg.registered_at));
        $overlay.find('.ticket-capacity').text(reg.capacity + ' total capacity' + (reg.remaining_seats !== undefined ? ' (' + reg.remaining_seats + ' remaining)' : ''));
        if (reg.description) {
            $overlay.find('.ticket-description').text(reg.description);
        }

        function closeModal() {
            $overlay.addClass('removing');
            setTimeout(function () { $overlay.remove(); }, 200);
            $(document).off('keydown.ticketModal');
        }

        $overlay.find('.btn-close-ticket, .ticket-modal-close').on('click', closeModal);
        $overlay.on('click', function (e) {
            if ($(e.target).hasClass('modal-overlay')) closeModal();
        });

        $(document).on('keydown.ticketModal', function (e) {
            if (e.key === 'Escape') closeModal();
        });

        $overlay.find('.btn-print-ticket').on('click', function () {
            window.print();
        });

        $('body').append($overlay);
    }

    // ── Tab switching ────────────────────────────────────────────────
    $(document).on('click', '.tab', function () {
        const tab = $(this).data('tab');
        $('.tab').removeClass('active');
        $(this).addClass('active');
        renderTab(tab);
    });

    // ── View Ticket ──────────────────────────────────────────────────
    $(document).on('click', '.btn-view-ticket', function () {
        const regId = parseInt($(this).data('reg-id'), 10);
        const eventId = parseInt($(this).data('event-id'), 10);

        let reg = registrations.upcoming.find(function (r) {
            return (regId && r.registration_id === regId) || r.event_id === eventId;
        });
        if (!reg) {
            reg = registrations.past.find(function (r) {
                return (regId && r.registration_id === regId) || r.event_id === eventId;
            });
        }

        if (reg) {
            showTicketModal(reg);
        }
    });

    // ── Cancel ───────────────────────────────────────────────────────
    $(document).on('click', '.btn-cancel-myreg', function () {
        const $btn = $(this);
        const eventId = parseInt($btn.data('event-id'), 10);
        const $card = $btn.closest('.registration-card');

        App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel this registration?',
            'Yes, Cancel',
            'btn-danger'
        ).then(function (confirmed) {
            if (!confirmed) return;

            $btn.prop('disabled', true).html('<span class="spinner-inline"></span>');

            App.api('POST', '/api/cancel.php', { event_id: eventId }).then(function (res) {
                App.toast('success', res.message);

                // Remove from local data
                registrations.upcoming = registrations.upcoming.filter(function (r) { return r.event_id !== eventId; });
                updateTabCounts();

                // Animate out
                $card.addClass('fade-out');
                setTimeout(function () {
                    $card.remove();
                    if ($('#registrations-content .registration-card').length === 0) {
                        renderTab('upcoming');
                    }
                }, 400);
            }).catch(function (res) {
                if (res && res.error) App.toast('error', res.error.message);
                $btn.prop('disabled', false).text('Cancel');
            });
        });
    });

    // ── Init ─────────────────────────────────────────────────────────
    App.init(function (user) {
        if (window.location.pathname !== '/my-registrations.html') return;
        if (!user) {
            window.location.href = '/login.html?next=' + encodeURIComponent('/my-registrations.html');
            return;
        }
        loadRegistrations();
    });

})(jQuery);
