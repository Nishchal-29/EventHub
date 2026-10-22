/**
 * common.js — Shared utilities: API wrapper, CSRF, toast, navbar, escaping.
 * Loaded on every page before page-specific JS.
 */
'use strict';

const App = (function ($) {
    let csrfToken = null;

    // ── HTML Escaping ────────────────────────────────────────────────
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    // ── Date Formatting ──────────────────────────────────────────────
    function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    function formatTime(iso) {
        const d = new Date(iso);
        return d.toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit'
        });
    }

    function formatDateTime(iso) {
        return formatDate(iso) + ' at ' + formatTime(iso);
    }

    function isoToDatetimeLocal(iso) {
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    // ── Text Truncation ──────────────────────────────────────────────
    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '…' : str;
    }

    // ── CSRF Token ───────────────────────────────────────────────────
    let csrfPromise = null;

    function fetchCsrf() {
        csrfPromise = $.ajax({
            url: '/api/csrf.php',
            method: 'GET',
            dataType: 'json',
            cache: false
        }).then(function (res) {
            if (res && res.success && res.data && res.data.token) {
                csrfToken = res.data.token;
            }
            return csrfToken;
        }).fail(function () {
            csrfPromise = null;
        });
        return csrfPromise;
    }

    function ensureCsrf() {
        if (csrfToken) {
            return $.Deferred().resolve(csrfToken).promise();
        }
        if (csrfPromise) {
            return csrfPromise;
        }
        return fetchCsrf();
    }

    // ── API Wrapper ──────────────────────────────────────────────────
    function api(method, url, data) {
        const upperMethod = method.toUpperCase();

        if (upperMethod !== 'GET' && !csrfToken) {
            return ensureCsrf().then(function () {
                return executeRequest(upperMethod, url, data);
            });
        }
        return executeRequest(upperMethod, url, data);
    }

    function executeRequest(method, url, data) {
        const opts = {
            url: url,
            method: method,
            dataType: 'json',
            headers: {}
        };

        if (csrfToken) {
            opts.headers['X-CSRF-Token'] = csrfToken;
        }

        if (data && method !== 'GET') {
            opts.contentType = 'application/json; charset=utf-8';
            opts.data = JSON.stringify(data);
        } else if (data && method === 'GET') {
            opts.data = data;
        }

        return $.ajax(opts).then(
            function (res) { return res; },
            function (xhr) {
                let res;
                try {
                    res = JSON.parse(xhr.responseText);
                } catch (e) {
                    res = { success: false, error: { code: 'UNKNOWN', message: 'An unexpected error occurred.' } };
                }

                const status = xhr.status;
                if (status === 401) {
                    if (!url.includes('/api/login.php') && window.location.pathname !== '/login.html') {
                        const next = encodeURIComponent(window.location.pathname + window.location.search);
                        window.location.href = '/login.html?next=' + next;
                    }
                    return $.Deferred().reject(res, status).promise();
                }
                if (status === 403) {
                    if (res && res.error && res.error.code === 'CSRF_FAILURE') {
                        csrfToken = null;
                        csrfPromise = null;
                        toast('error', 'Security token refreshed. Please try again.');
                    } else {
                        toast('error', res.error ? res.error.message : 'Access denied.');
                    }
                }
                if (status === 429) {
                    toast('error', res.error ? res.error.message : 'Too many requests. Please wait.');
                }
                if (status >= 500) {
                    toast('error', 'Server error. Please try again later.');
                }

                return $.Deferred().reject(res, status).promise();
            }
        );
    }

    // ── Flash Messages & Toasts ──────────────────────────────────────
    let toastContainer = null;

    function ensureToastContainer() {
        if (!toastContainer || !toastContainer.closest('body').length) {
            toastContainer = $('<div class="toast-container" aria-live="polite" role="status"></div>');
            $('body').append(toastContainer);
        }
    }

    function showInPageAlert(type, message) {
        let $flashContainer = $('#flash-container');
        if (!$flashContainer.length) {
            const $target = $('.main-content .container').first();
            if ($target.length) {
                $flashContainer = $('<div id="flash-container" class="flash-container"></div>');
                $target.prepend($flashContainer);
            }
        }

        if ($flashContainer.length) {
            const icons = { success: '✓', error: '✕', info: 'ℹ' };
            const $alert = $(
                '<div class="alert alert-' + escapeHtml(type) + '" role="alert">' +
                    '<span class="alert-icon">' + (icons[type] || 'ℹ') + '</span>' +
                    '<span class="alert-message"></span>' +
                    '<button type="button" class="alert-close" aria-label="Close">×</button>' +
                '</div>'
            );
            $alert.find('.alert-message').text(message);
            $alert.find('.alert-close').on('click', function () {
                $alert.addClass('removing');
                setTimeout(function () { $alert.remove(); }, 250);
            });
            $flashContainer.empty().append($alert);
            setTimeout(function () {
                if ($alert.closest('body').length && !$alert.hasClass('removing')) {
                    $alert.addClass('removing');
                    setTimeout(function () { $alert.remove(); }, 250);
                }
            }, 6000);
        }
    }

    function toast(type, message) {
        showInPageAlert(type, message);
        ensureToastContainer();
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        const $toast = $(
            '<div class="toast toast-' + escapeHtml(type) + '">' +
                '<span class="toast-icon">' + (icons[type] || 'ℹ') + '</span>' +
                '<span class="toast-message"></span>' +
                '<button class="toast-close" aria-label="Close">×</button>' +
            '</div>'
        );
        $toast.find('.toast-message').text(message);
        $toast.find('.toast-close').on('click', function () {
            removeToast($toast);
        });
        toastContainer.append($toast);
        setTimeout(function () { removeToast($toast); }, 5000);
    }

    function removeToast($toast) {
        if ($toast.hasClass('removing')) return;
        $toast.addClass('removing');
        setTimeout(function () { $toast.remove(); }, 250);
    }

    // ── Confirm Modal ────────────────────────────────────────────────
    function confirm(title, message, confirmText, confirmClass) {
        const deferred = $.Deferred();
        confirmText = confirmText || 'Confirm';
        confirmClass = confirmClass || 'btn-danger';

        const $overlay = $(
            '<div class="modal-overlay" role="dialog" aria-modal="true">' +
                '<div class="modal">' +
                    '<div class="modal-header">' +
                        '<h2></h2>' +
                        '<button class="modal-close" aria-label="Close">×</button>' +
                    '</div>' +
                    '<div class="modal-body"><p></p></div>' +
                    '<div class="modal-footer">' +
                        '<button class="btn btn-outline btn-cancel">Cancel</button>' +
                        '<button class="btn ' + escapeHtml(confirmClass) + ' btn-confirm"></button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );

        $overlay.find('.modal-header h2').text(title);
        $overlay.find('.modal-body p').text(message);
        $overlay.find('.btn-confirm').text(confirmText);

        function close(result) {
            $overlay.addClass('removing');
            setTimeout(function () { $overlay.remove(); }, 200);
            deferred.resolve(result);
        }

        $overlay.find('.btn-confirm').on('click', function () { close(true); });
        $overlay.find('.btn-cancel, .modal-close').on('click', function () { close(false); });
        $overlay.on('click', function (e) {
            if ($(e.target).hasClass('modal-overlay')) close(false);
        });

        // Keyboard: Escape to close
        $(document).on('keydown.confirm', function (e) {
            if (e.key === 'Escape') {
                $(document).off('keydown.confirm');
                close(false);
            }
        });

        $('body').append($overlay);
        $overlay.find('.btn-confirm').focus();

        return deferred.promise();
    }

    // ── Navbar ───────────────────────────────────────────────────────
    let currentUser = null;

    function buildNavbar() {
        const path = window.location.pathname;
        const isActive = (p) => path === p || path === p.replace('.html', '') ? ' active' : '';

        let navHtml =
            '<nav class="navbar" role="navigation" aria-label="Main navigation">' +
                '<div class="container">' +
                    '<a href="/index.html" class="navbar-brand">EventHub</a>' +
                    '<button class="navbar-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>' +
                    '<ul class="navbar-nav" id="nav-menu">' +
                        '<li><a href="/index.html" class="' + isActive('/index.html') + isActive('/') + '">Events</a></li>';

        if (currentUser) {
            navHtml +=
                        '<li><a href="/my-registrations.html" class="' + isActive('/my-registrations.html') + '">My Registrations</a></li>';
            if (currentUser.role === 'admin') {
                navHtml +=
                        '<li><a href="/admin.html" class="' + isActive('/admin.html') + '">Admin</a></li>';
            }
            navHtml +=
                        '<li><span class="user-badge">' + escapeHtml(currentUser.name) + '</span></li>' +
                        '<li><button id="btn-logout" class="btn btn-ghost btn-sm">Logout</button></li>';
        } else {
            navHtml +=
                        '<li><a href="/login.html" class="' + isActive('/login.html') + '">Login</a></li>' +
                        '<li><a href="/signup.html" class="btn btn-primary btn-sm">Sign Up</a></li>';
        }

        navHtml +=
                    '</ul>' +
                '</div>' +
            '</nav>';

        const $existingNav = $('nav.navbar');
        if ($existingNav.length) {
            $existingNav.replaceWith(navHtml);
        } else {
            $('body').prepend(navHtml);
        }

        // Mobile toggle
        $('#nav-toggle').on('click', function () {
            const $menu = $('#nav-menu');
            $menu.toggleClass('open');
            $(this).attr('aria-expanded', $menu.hasClass('open'));
        });

        // Logout
        $('#btn-logout').on('click', function () {
            api('POST', '/api/logout.php').then(function () {
                window.location.href = '/index.html';
            });
        });
    }

    // ── Status Badge Helper ──────────────────────────────────────────
    function getStatusBadge(event) {
        if (event.user_registered) {
            return '<span class="badge badge-registered">✓ Registered</span>';
        }
        if (event.status === 'past') {
            return '<span class="badge badge-past">Past</span>';
        }
        if (event.status === 'full') {
            return '<span class="badge badge-full">Full</span>';
        }
        if (event.remaining_seats <= 3 || (event.remaining_seats / event.capacity) <= 0.1) {
            return '<span class="badge badge-few-seats">Few Seats Left</span>';
        }
        return '<span class="badge badge-open">Open</span>';
    }

    // ── Capacity Bar Helper ──────────────────────────────────────────
    function getCapacityBarClass(event) {
        const ratio = event.registered_count / event.capacity;
        if (ratio >= 1) return 'full';
        if (ratio >= 0.9) return 'high';
        if (ratio >= 0.6) return 'medium';
        return 'low';
    }

    // ── Redirect Safety ─────────────────────────────────────────────
    function safeRedirect(url) {
        // Only allow same-origin relative paths
        if (!url || url.startsWith('//') || url.includes('://') || url.startsWith('\\')) {
            return '/index.html';
        }
        return url;
    }

    // ── Init ─────────────────────────────────────────────────────────
    function init(callback) {
        // Fetch CSRF + check session in parallel
        $.when(
            fetchCsrf(),
            $.ajax({ url: '/api/me.php', method: 'GET', dataType: 'json' })
                .then(function (res) { return res.success ? res.data : null; })
                .catch(function () { return null; }) // Not logged in is fine
        ).then(function (token, user) {
            currentUser = user;
            buildNavbar();
            if (typeof callback === 'function') {
                callback(currentUser);
            }
        });
    }

    // ── Public API ───────────────────────────────────────────────────
    return {
        init: init,
        api: api,
        toast: toast,
        flash: toast,
        confirm: confirm,
        escapeHtml: escapeHtml,
        formatDate: formatDate,
        formatTime: formatTime,
        formatDateTime: formatDateTime,
        isoToDatetimeLocal: isoToDatetimeLocal,
        truncate: truncate,
        getStatusBadge: getStatusBadge,
        getCapacityBarClass: getCapacityBarClass,
        safeRedirect: safeRedirect,
        get currentUser() { return currentUser; },
        get csrfToken() { return csrfToken; }
    };
})(jQuery);
