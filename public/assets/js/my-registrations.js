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
                    '<div>' + cancelBtn + '</div>' +
                '</div>'
            );

            $card.find('.reg-title').text(reg.title);
            $card.find('.meta-date').append(document.createTextNode(App.formatDateTime(reg.event_date)));
            if (reg.venue) $card.find('.meta-venue').append(document.createTextNode(reg.venue));
            $card.find('.meta-reg-date').append(document.createTextNode(App.formatDateTime(reg.registered_at)));

            $content.append($card);
        });
    }

    // ── Tab switching ────────────────────────────────────────────────
    $(document).on('click', '.tab', function () {
        const tab = $(this).data('tab');
        $('.tab').removeClass('active');
        $(this).addClass('active');
        renderTab(tab);
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
