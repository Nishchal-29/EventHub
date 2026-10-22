/**
 * events.js — Event listing page with search, filters, pagination, registration,
 * and real-time seat polling with ETag support.
 */
'use strict';

(function ($) {

    let currentPage = 1;
    let currentFilters = {};
    let pollInterval = null;
    let pollEtag = null;
    let pollErrors = 0;
    let pollInProgress = false;
    let categories = [];

    // ── Build a single event card ────────────────────────────────────
    function buildEventCard(event) {
        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);
        const statusBadge = App.getStatusBadge(event);
        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;

        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = '<button class="btn btn-danger btn-sm btn-cancel-reg" data-event-id="' + event.id + '">Cancel Registration</button>';
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Full</button>';
        } else {
            actionBtn = '<button class="btn btn-primary btn-sm btn-register" data-event-id="' + event.id + '">Register</button>';
        }

        const $card = $(
            '<div class="card event-card" data-event-id="' + event.id + '">' +
                '<div class="event-card-header">' +
                    '<a class="event-card-title" href="/event.html?id=' + event.id + '"></a>' +
                    statusBadge +
                '</div>' +
                '<div class="event-card-meta">' +
                    '<div class="event-card-meta-item">' +
                        '<span class="meta-icon">📅</span>' +
                        '<span class="meta-date"></span>' +
                    '</div>' +
                    (event.venue ? '<div class="event-card-meta-item"><span class="meta-icon">📍</span><span class="meta-venue"></span></div>' : '') +
                    (event.category ? '<div class="event-card-meta-item"><span class="badge badge-category"></span></div>' : '') +
                '</div>' +
                '<div class="event-card-description"></div>' +
                '<div class="event-card-footer">' +
                    '<div class="capacity-bar-container">' +
                        '<div class="capacity-info">' +
                            '<span class="capacity-text seats-text"></span>' +
                            '<span class="capacity-count">' + event.registered_count + '/' + event.capacity + '</span>' +
                        '</div>' +
                        '<div class="capacity-bar">' +
                            '<div class="capacity-bar-fill ' + barClass + '" style="width: ' + fillPercent + '%"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="event-card-actions">' + actionBtn + '</div>' +
                '</div>' +
            '</div>'
        );

        // Use .text() for all user data to prevent XSS
        $card.find('.event-card-title').text(event.title);
        $card.find('.meta-date').text(App.formatDateTime(event.event_date));
        if (event.venue) $card.find('.meta-venue').text(event.venue);
        if (event.category) $card.find('.badge-category').text(event.category);
        $card.find('.event-card-description').text(App.truncate(event.description, 120));
        $card.find('.seats-text').text(event.remaining_seats + ' of ' + event.capacity + ' seats left');

        return $card;
    }

    // ── Update a card's dynamic data (seat counts, status, buttons) ──
    function updateEventCard($card, event) {
        const barClass = App.getCapacityBarClass(event);
        const fillPercent = Math.min(100, (event.registered_count / event.capacity) * 100);
        const isPast = event.status === 'past';
        const isFull = event.status === 'full';
        const isRegistered = event.user_registered;

        // Update badge
        const $header = $card.find('.event-card-header');
        $header.find('.badge').replaceWith(App.getStatusBadge(event));

        // Update capacity
        $card.find('.seats-text').text(event.remaining_seats + ' of ' + event.capacity + ' seats left');
        $card.find('.capacity-count').text(event.registered_count + '/' + event.capacity);
        const $fill = $card.find('.capacity-bar-fill');
        $fill.css('width', fillPercent + '%')
             .removeClass('low medium high full')
             .addClass(barClass);

        // Update action button
        let actionBtn = '';
        if (isPast) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Event Ended</button>';
        } else if (isRegistered) {
            actionBtn = '<button class="btn btn-danger btn-sm btn-cancel-reg" data-event-id="' + event.id + '">Cancel Registration</button>';
        } else if (isFull) {
            actionBtn = '<button class="btn btn-full-disabled btn-sm" disabled>Full</button>';
        } else {
            actionBtn = '<button class="btn btn-primary btn-sm btn-register" data-event-id="' + event.id + '">Register</button>';
        }
        $card.find('.event-card-actions').html(actionBtn);
    }

    // ── Load Events ──────────────────────────────────────────────────
    function loadEvents(page, showLoading) {
        if (showLoading) {
            const skeletons = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
            $('#events-grid').html(skeletons);
            $('#events-pagination').empty();
        }

        currentPage = page || 1;
        const params = $.extend({}, currentFilters, { page: currentPage, per_page: 12 });

        App.api('GET', '/api/events.php', params).then(function (res) {
            const data = res.data;

            // Populate category filter if not done
            if (categories.length === 0 && data.categories) {
                categories = data.categories;
                const $cat = $('#filter-category');
                $cat.empty().append('<option value="">All Categories</option>');
                categories.forEach(function (c) {
                    const $opt = $('<option></option>').val(c).text(c);
                    $cat.append($opt);
                });
                if (currentFilters.category) {
                    $cat.val(currentFilters.category);
                }
            }

            renderEvents(data.events);
            renderPagination(data.pagination);
        }).catch(function () {
            $('#events-grid').html(
                '<div class="empty-state"><div class="empty-state-icon">⚠️</div>' +
                '<h3>Failed to load events</h3><p>Please try again later.</p></div>'
            );
        });
    }

    function renderEvents(events) {
        const $grid = $('#events-grid');
        if (events.length === 0) {
            $grid.html(
                '<div class="empty-state"><div class="empty-state-icon">📭</div>' +
                '<h3>No events found</h3><p>Try adjusting your search or filters.</p></div>'
            );
            return;
        }

        $grid.empty();
        events.forEach(function (event) {
            $grid.append(buildEventCard(event));
        });
    }

    function renderPagination(pagination) {
        const $pag = $('#events-pagination');
        $pag.empty();
        if (pagination.pages <= 1) return;

        if (pagination.page > 1) {
            $pag.append('<button class="btn btn-outline btn-page" data-page="' + (pagination.page - 1) + '">‹</button>');
        }

        const maxVisible = 5;
        let start = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
        let end = Math.min(pagination.pages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            const active = i === pagination.page ? ' active' : '';
            $pag.append('<button class="btn btn-outline btn-page' + active + '" data-page="' + i + '">' + i + '</button>');
        }

        if (pagination.page < pagination.pages) {
            $pag.append('<button class="btn btn-outline btn-page" data-page="' + (pagination.page + 1) + '">›</button>');
        }

        $pag.append('<span class="pagination-info">Page ' + pagination.page + ' of ' + pagination.pages + '</span>');
    }

    // ── Polling for seat updates ─────────────────────────────────────
    function startPolling() {
        stopPolling();
        pollInterval = setInterval(pollEvents, 5000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function pollEvents() {
        if (pollInProgress) return;
        pollInProgress = true;

        const params = $.extend({}, currentFilters, { page: currentPage, per_page: 12 });

        const ajaxOpts = {
            url: '/api/events.php',
            method: 'GET',
            data: params,
            dataType: 'json',
            headers: {}
        };
        if (pollEtag) {
            ajaxOpts.headers['If-None-Match'] = pollEtag;
        }

        $.ajax(ajaxOpts).then(function (res, textStatus, xhr) {
            pollInProgress = false;
            pollErrors = 0;

            // Save ETag
            const etag = xhr.getResponseHeader('ETag');
            if (etag) pollEtag = etag;

            if (res && res.success && res.data && res.data.events) {
                updateCardsFromPoll(res.data.events);
            }
        }).catch(function (xhr) {
            pollInProgress = false;
            if (xhr.status === 304) {
                // No change, that's fine
                pollErrors = 0;
                return;
            }
            pollErrors++;
            // Back off on repeated errors
            if (pollErrors >= 3) {
                stopPolling();
                setTimeout(function () {
                    pollErrors = 0;
                    startPolling();
                }, 30000);
            }
        });
    }

    function updateCardsFromPoll(events) {
        events.forEach(function (event) {
            const $card = $('.event-card[data-event-id="' + event.id + '"]');
            if ($card.length === 0) return;

            // Check if seat data changed
            const oldText = $card.find('.capacity-count').text();
            const newText = event.registered_count + '/' + event.capacity;
            if (oldText !== newText) {
                updateEventCard($card, event);
                $card.addClass('seat-updated');
                setTimeout(function () { $card.removeClass('seat-updated'); }, 1000);
            } else {
                // Still update badge (user_registered might have changed)
                updateEventCard($card, event);
            }
        });
    }

    // ── Visibility handling: pause polling on hidden tab ─────────────
    $(document).on('visibilitychange', function () {
        if (document.hidden) {
            stopPolling();
        } else {
            pollEtag = null; // Force refresh on return
            pollEvents();
            startPolling();
        }
    });

    // ── Event handlers ───────────────────────────────────────────────
    // Search (debounced)
    let searchTimer = null;
    $(document).on('input', '#search-input', function () {
        clearTimeout(searchTimer);
        const q = $(this).val();
        searchTimer = setTimeout(function () {
            currentFilters.q = q;
            loadEvents(1, true);
        }, 300);
    });

    // Category filter
    $(document).on('change', '#filter-category', function () {
        currentFilters.category = $(this).val();
        loadEvents(1, true);
    });

    // Sort
    $(document).on('change', '#filter-sort', function () {
        currentFilters.sort = $(this).val();
        loadEvents(1, true);
    });

    // Upcoming toggle
    $(document).on('click', '#toggle-upcoming', function () {
        $(this).toggleClass('active');
        currentFilters.upcoming = $(this).hasClass('active') ? '1' : '';
        loadEvents(1, true);
    });

    // Pagination
    $(document).on('click', '.btn-page', function () {
        const page = parseInt($(this).data('page'), 10);
        loadEvents(page, true);
        $('html, body').animate({ scrollTop: 0 }, 300);
    });

    // ── Register ─────────────────────────────────────────────────────
    $(document).on('click', '.btn-register', function () {
        if (!App.currentUser) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = '/login.html?next=' + next;
            return;
        }

        const $btn = $(this);
        const eventId = parseInt($btn.data('event-id'), 10);
        $btn.prop('disabled', true).html('<span class="spinner-inline"></span>');

        App.api('POST', '/api/register.php', { event_id: eventId }).then(function (res) {
            App.toast('success', res.message || 'Registered!');
            const $card = $btn.closest('.event-card');
            updateEventCard($card, res.data);
            $card.addClass('seat-updated');
            setTimeout(function () { $card.removeClass('seat-updated'); }, 1000);
        }).catch(function (res) {
            if (res && res.error) {
                App.toast('error', res.error.message);
                if (res.error.code === 'FULL' || res.error.code === 'DUPLICATE') {
                    refreshSingleEvent(eventId);
                }
            }
            $btn.prop('disabled', false).text('Register');
        });
    });

    // ── Cancel Registration ──────────────────────────────────────────
    $(document).on('click', '.btn-cancel-reg', function () {
        const $btn = $(this);
        const eventId = parseInt($btn.data('event-id'), 10);

        App.confirm(
            'Cancel Registration',
            'Are you sure you want to cancel your registration for this event?',
            'Yes, Cancel',
            'btn-danger'
        ).then(function (confirmed) {
            if (!confirmed) return;

            $btn.prop('disabled', true).html('<span class="spinner-inline"></span>');

            App.api('POST', '/api/cancel.php', { event_id: eventId }).then(function (res) {
                App.toast('success', res.message || 'Registration cancelled.');
                const $card = $btn.closest('.event-card');
                updateEventCard($card, res.data);
                $card.addClass('seat-updated');
                setTimeout(function () { $card.removeClass('seat-updated'); }, 1000);
            }).catch(function (res) {
                if (res && res.error) {
                    App.toast('error', res.error.message);
                }
                $btn.prop('disabled', false).text('Cancel Registration');
            });
        });
    });

    // Refresh a single event's data from the server
    function refreshSingleEvent(eventId) {
        App.api('GET', '/api/event.php', { id: eventId }).then(function (res) {
            if (res.success) {
                const $card = $('.event-card[data-event-id="' + eventId + '"]');
                if ($card.length) {
                    updateEventCard($card, res.data);
                }
            }
        });
    }

    // ── Page Init ────────────────────────────────────────────────────
    App.init(function () {
        // Only run on index page
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;
        loadEvents(1, true);
        startPolling();
    });

})(jQuery);
