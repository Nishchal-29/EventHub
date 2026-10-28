'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (evt, sel, fn, root = document) => {
    root.addEventListener(evt, e => {
        const target = e.target.closest(sel);
        if (target && root.contains(target)) fn.call(target, e, target);
    });
};

const App = (() => {
    let csrfToken = null;
    let csrfPromise = null;
    let currentUser = null;
    let toastContainer = null;

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

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
        return `${formatDate(iso)} at ${formatTime(iso)}`;
    }

    function isoToDatetimeLocal(iso) {
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '…' : str;
    }

    async function fetchCsrf() {
        try {
            const res = await fetch('/api/csrf.php', { cache: 'no-store' });
            const json = await res.json();
            if (json?.success && json.data?.token) {
                csrfToken = json.data.token;
            }
        } catch {
            csrfToken = null;
        }
        csrfPromise = null;
        return csrfToken;
    }

    function ensureCsrf() {
        if (csrfToken) return Promise.resolve(csrfToken);
        if (!csrfPromise) csrfPromise = fetchCsrf();
        return csrfPromise;
    }

    async function api(method, url, data) {
        const upper = method.toUpperCase();
        if (upper !== 'GET' && !csrfToken) {
            await ensureCsrf();
        }

        let fetchUrl = url;
        const opts = {
            method: upper,
            headers: { 'Accept': 'application/json' }
        };

        if (csrfToken) {
            opts.headers['X-CSRF-Token'] = csrfToken;
        }

        if (data) {
            if (upper === 'GET') {
                const params = new URLSearchParams();
                Object.entries(data).forEach(([k, v]) => {
                    if (v !== undefined && v !== null && v !== '') params.append(k, v);
                });
                const qs = params.toString();
                if (qs) fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + qs;
            } else {
                opts.headers['Content-Type'] = 'application/json; charset=utf-8';
                opts.body = JSON.stringify(data);
            }
        }

        let response, json;
        try {
            response = await fetch(fetchUrl, opts);
            json = await response.json().catch(() => null);
        } catch (err) {
            toast('error', 'Network error. Please check your connection.');
            return Promise.reject({ success: false, error: { code: 'NETWORK_ERROR', message: 'Network error.' } });
        }

        if (response.ok && json?.success) {
            return json;
        }

        const res = json || {
            success: false,
            error: { code: 'UNKNOWN', message: 'An unexpected error occurred.' }
        };

        const status = response.status;
        if (status === 401) {
            if (!url.includes('/api/login.php') && window.location.pathname !== '/login.html') {
                const next = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login.html?next=${next}`;
            }
        } else if (status === 403) {
            if (res.error?.code === 'CSRF_FAILURE') {
                csrfToken = null;
                toast('error', 'Security token refreshed. Please try again.');
            } else {
                toast('error', res.error?.message || 'Access denied.');
            }
        } else if (status === 429) {
            toast('error', res.error?.message || 'Too many requests. Please wait.');
        } else if (status >= 500) {
            toast('error', 'Server error. Please try again later.');
        }

        return Promise.reject(res);
    }

    function ensureToastContainer() {
        if (!toastContainer || !document.body.contains(toastContainer)) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            toastContainer.setAttribute('role', 'status');
            document.body.appendChild(toastContainer);
        }
    }

    function showInPageAlert(type, message) {
        let flashContainer = $('#flash-container');
        if (!flashContainer) {
            const target = $('.main-content .container');
            if (target) {
                flashContainer = document.createElement('div');
                flashContainer.id = 'flash-container';
                flashContainer.className = 'flash-container';
                target.prepend(flashContainer);
            }
        }

        if (!flashContainer) return;

        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        const alert = document.createElement('div');
        alert.className = `alert alert-${escapeHtml(type)}`;
        alert.setAttribute('role', 'alert');
        alert.innerHTML = `
            <span class="alert-icon">${icons[type] || 'ℹ'}</span>
            <span class="alert-message"></span>
            <button type="button" class="alert-close" aria-label="Close">×</button>
        `;
        alert.querySelector('.alert-message').textContent = message;

        const removeAlert = () => {
            alert.classList.add('removing');
            setTimeout(() => alert.remove(), 250);
        };

        alert.querySelector('.alert-close').addEventListener('click', removeAlert);
        flashContainer.innerHTML = '';
        flashContainer.appendChild(alert);

        setTimeout(() => {
            if (document.body.contains(alert) && !alert.classList.contains('removing')) {
                removeAlert();
            }
        }, 6000);
    }

    function toast(type, message) {
        showInPageAlert(type, message);
        ensureToastContainer();

        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        const el = document.createElement('div');
        el.className = `toast toast-${escapeHtml(type)}`;
        el.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ'}</span>
            <span class="toast-message"></span>
            <button class="toast-close" aria-label="Close">×</button>
        `;
        el.querySelector('.toast-message').textContent = message;

        const removeToast = () => {
            if (el.classList.contains('removing')) return;
            el.classList.add('removing');
            setTimeout(() => el.remove(), 250);
        };

        el.querySelector('.toast-close').addEventListener('click', removeToast);
        toastContainer.appendChild(el);
        setTimeout(removeToast, 5000);
    }

    function confirm(title, message, confirmText = 'Confirm', confirmClass = 'btn-danger') {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <h2></h2>
                        <button class="modal-close" aria-label="Close">×</button>
                    </div>
                    <div class="modal-body"><p></p></div>
                    <div class="modal-footer">
                        <button class="btn btn-outline btn-cancel">Cancel</button>
                        <button class="btn ${escapeHtml(confirmClass)} btn-confirm"></button>
                    </div>
                </div>
            `;

            overlay.querySelector('.modal-header h2').textContent = title;
            overlay.querySelector('.modal-body p').textContent = message;
            const confirmBtn = overlay.querySelector('.btn-confirm');
            confirmBtn.textContent = confirmText;

            const close = result => {
                document.removeEventListener('keydown', onKeyDown);
                overlay.classList.add('removing');
                setTimeout(() => overlay.remove(), 200);
                resolve(result);
            };

            const onKeyDown = e => {
                if (e.key === 'Escape') close(false);
            };

            overlay.querySelector('.btn-confirm').addEventListener('click', () => close(true));
            overlay.querySelector('.btn-cancel').addEventListener('click', () => close(false));
            overlay.querySelector('.modal-close').addEventListener('click', () => close(false));
            overlay.addEventListener('click', e => {
                if (e.target === overlay) close(false);
            });
            document.addEventListener('keydown', onKeyDown);

            document.body.appendChild(overlay);
            confirmBtn.focus();
        });
    }

    function buildNavbar() {
        const path = window.location.pathname;
        const isActive = p => (path === p || path === p.replace('.html', '')) ? ' active' : '';

        let navHtml = `
            <nav class="navbar" role="navigation" aria-label="Main navigation">
                <div class="container">
                    <a href="/index.html" class="navbar-brand">EventHub</a>
                    <button class="navbar-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>
                    <ul class="navbar-nav" id="nav-menu">
                        <li><a href="/index.html" class="${isActive('/index.html')}${isActive('/')}">Events</a></li>
        `;

        if (currentUser) {
            navHtml += `<li><a href="/my-registrations.html" class="${isActive('/my-registrations.html')}">My Registrations</a></li>`;
            if (currentUser.role === 'admin') {
                navHtml += `<li><a href="/admin.html" class="${isActive('/admin.html')}">Admin</a></li>`;
            }
            navHtml += `
                        <li><span class="user-badge">${escapeHtml(currentUser.name)}</span></li>
                        <li><button id="btn-logout" class="btn btn-ghost btn-sm">Logout</button></li>
            `;
        } else {
            navHtml += `
                        <li><a href="/login.html" class="${isActive('/login.html')}">Login</a></li>
                        <li><a href="/signup.html" class="btn btn-primary btn-sm">Sign Up</a></li>
            `;
        }

        navHtml += `
                    </ul>
                </div>
            </nav>
        `;

        const existingNav = $('nav.navbar');
        if (existingNav) {
            existingNav.outerHTML = navHtml;
        } else {
            document.body.insertAdjacentHTML('afterbegin', navHtml);
        }

        $('#nav-toggle')?.addEventListener('click', function () {
            const menu = $('#nav-menu');
            if (menu) {
                menu.classList.toggle('open');
                this.setAttribute('aria-expanded', String(menu.classList.contains('open')));
            }
        });
        $('#btn-logout')?.addEventListener('click', async () => {
            await api('POST', '/api/logout.php');
            window.location.href = '/index.html';
        });
    }

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

    function getCapacityBarClass(event) {
        const ratio = event.registered_count / event.capacity;
        if (ratio >= 1) return 'full';
        if (ratio >= 0.9) return 'high';
        if (ratio >= 0.6) return 'medium';
        return 'low';
    }

    function safeRedirect(url) {
        if (!url || url.startsWith('//') || url.includes('://') || url.startsWith('\\')) {
            return '/index.html';
        }
        return url;
    }

    async function init(callback) {
        const [, meRes] = await Promise.all([
            ensureCsrf(),
            fetch('/api/me.php', { headers: { 'Accept': 'application/json' } })
                .then(r => r.json())
                .catch(() => null)
        ]);

        currentUser = (meRes?.success && meRes.data) ? meRes.data : null;
        buildNavbar();

        if (typeof callback === 'function') {
            callback(currentUser);
        }
    }

    return {
        init,
        api,
        toast,
        flash: toast,
        confirm,
        escapeHtml,
        formatDate,
        formatTime,
        formatDateTime,
        isoToDatetimeLocal,
        truncate,
        getStatusBadge,
        getCapacityBarClass,
        safeRedirect,
        get currentUser() { return currentUser; },
        get csrfToken() { return csrfToken; }
    };
})();