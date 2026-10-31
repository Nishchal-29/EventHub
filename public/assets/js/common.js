/**
 * common.js — Global App namespace, shared UI components and API client.
 * Provides central modal/confirm, floating toasts, field error bindings,
 * polling controller, responsive navbar, and authenticated fetch wrapper.
 */
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
    let currentUser = null;
    let toastContainer = null;

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function formatDateTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const date = d.toLocaleDateString(undefined, {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
        const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return `${date} at ${time}`;
    }

    function truncate(str, len) {
        return (str && str.length > len) ? str.substring(0, len) + '…' : (str || '');
    }

    function safeRedirect(url) {
        return (typeof url === 'string' && /^\/(?![\/\\])[^\r\n]*$/.test(url)) ? url : '/index.html';
    }

    async function api(method, url, data) {
        const upper = method.toUpperCase();
        let fetchUrl = url;
        const opts = { method: upper, headers: { 'Accept': 'application/json' } };

        if (upper === 'GET') {
            if (data) {
                const params = new URLSearchParams();
                Object.entries(data).forEach(([k, v]) => {
                    if (v !== undefined && v !== null && v !== '') params.append(k, v);
                });
                const qs = params.toString();
                if (qs) fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + qs;
            }
        } else {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data || {});
        }

        let response, json;
        try {
            response = await fetch(fetchUrl, opts);
            json = await response.json().catch(() => null);
        } catch {
            toast('error', 'Network error. Please check your connection.');
            return Promise.reject({ success: false, error: { code: 'NETWORK_ERROR', message: 'Network error.' } });
        }

        if (response.ok && json?.success) return json;

        const res = json || {
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Server error. Please try again later.' }
        };

        const status = response.status;
        if (status === 401) {
            if (!url.includes('/api/auth.php') && window.location.pathname !== '/login.html') {
                const next = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login.html?next=${next}`;
            }
        } else if (status === 403) {
            toast('error', res.error?.message || 'Access denied.');
        } else if (status === 429) {
            toast('error', res.error?.message || 'Too many requests. Please wait.');
        } else if (status >= 500) {
            toast('error', res.error?.message || 'Server error. Please try again later.');
        }

        return Promise.reject(res);
    }

    function toast(type, message) {
        if (!toastContainer || !document.body.contains(toastContainer)) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            toastContainer.setAttribute('role', 'status');
            document.body.appendChild(toastContainer);
        }

        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.textContent = icons[type] || 'ℹ';

        const msg = document.createElement('span');
        msg.className = 'toast-message';
        msg.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';

        el.append(icon, msg, closeBtn);

        const remove = () => {
            if (el.classList.contains('removing')) return;
            el.classList.add('removing');
            setTimeout(() => el.remove(), 250);
        };

        closeBtn.addEventListener('click', remove);
        toastContainer.appendChild(el);
        setTimeout(remove, 5000);
    }

    function modal({ title, body, buttons = [], modalClass = '' }) {
        const overlay = document.createElement('div');
        overlay.className = `modal-overlay ${modalClass ? modalClass + '-overlay' : ''}`.trim();
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const box = document.createElement('div');
        box.className = `modal ${modalClass}`.trim();

        if (title) {
            const header = document.createElement('div');
            header.className = 'modal-header';
            const h2 = document.createElement('h2');
            h2.textContent = title;
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.textContent = '×';
            header.append(h2, closeBtn);
            box.appendChild(header);
        }

        const bodyWrap = document.createElement('div');
        bodyWrap.className = 'modal-body';
        if (typeof body === 'string') bodyWrap.innerHTML = body;
        else if (body instanceof Node) bodyWrap.appendChild(body);
        box.appendChild(bodyWrap);

        if (buttons.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            buttons.forEach(b => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `btn ${b.class || 'btn-outline'}`.trim();
                btn.textContent = b.text || '';
                btn.addEventListener('click', () => (b.onClick ? b.onClick(close) : close()));
                footer.appendChild(btn);
            });
            box.appendChild(footer);
        }

        overlay.appendChild(box);

        const onKeyDown = e => { if (e.key === 'Escape') close(); };
        function close() {
            document.removeEventListener('keydown', onKeyDown);
            overlay.classList.add('removing');
            setTimeout(() => overlay.remove(), 200);
        }

        box.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', close));
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKeyDown);

        document.body.appendChild(overlay);
        const focusEl = box.querySelector('input:not([disabled]), select:not([disabled]), button.btn-confirm, button.btn-primary, button.modal-close') || overlay;
        focusEl.focus();

        return { overlay, modalBox: box, bodyContainer: bodyWrap, close };
    }

    function confirm(title, message, confirmText = 'Confirm', confirmClass = 'btn-danger') {
        return new Promise(resolve => {
            const p = document.createElement('p');
            p.textContent = message;
            let confirmed = false;

            const m = modal({
                title,
                body: p,
                buttons: [
                    { text: 'Cancel', class: 'btn-outline btn-cancel', onClick: close => { close(); resolve(false); } },
                    { text: confirmText, class: `${confirmClass} btn-confirm`, onClick: close => { confirmed = true; close(); resolve(true); } }
                ]
            });

            const onKeyDown = e => {
                if (e.key === 'Enter') {
                    if (document.activeElement && document.activeElement.classList.contains('btn-cancel')) return;
                    e.preventDefault();
                    confirmed = true;
                    m.close();
                    resolve(true);
                }
            };
            document.addEventListener('keydown', onKeyDown);

            const origClose = m.close;
            m.close = () => {
                document.removeEventListener('keydown', onKeyDown);
                origClose();
                if (!confirmed) resolve(false);
            };
        });
    }

    function actionButton(event, size = 'sm') {
        const isLg = size === 'lg';
        const sz = isLg ? 'btn-lg' : 'btn-sm';
        const regClass = isLg ? 'btn-register-detail' : 'btn-register';
        const cancelClass = isLg ? 'btn-cancel-detail' : 'btn-cancel-reg';

        if (event.status === 'past') {
            return `<button class="btn btn-full-disabled ${sz}" disabled>Event Ended</button>`;
        }
        if (event.user_registered) {
            return `<button class="btn btn-danger ${sz} ${cancelClass}" data-event-id="${event.id}">Cancel Registration</button>`;
        }
        if (event.status === 'full') {
            const label = isLg ? 'Full — No Seats Available' : 'Full';
            return `<button class="btn btn-full-disabled ${sz}" disabled>${label}</button>`;
        }
        const label = isLg ? 'Register for This Event' : 'Register';
        return `<button class="btn btn-primary ${sz} ${regClass}" data-event-id="${event.id}">${label}</button>`;
    }

    function poll(fn, ms = 5000) {
        let timer = null, running = false, stopped = false;

        async function tick() {
            if (stopped || running || document.hidden) return;
            running = true;
            try { await fn(); } finally { running = false; }
        }

        function start() { if (!stopped && !timer) timer = setInterval(tick, ms); }
        function pause() { if (timer) { clearInterval(timer); timer = null; } }

        function onVisibility() {
            if (document.hidden) pause();
            else if (!stopped) { tick(); start(); }
        }

        document.addEventListener('visibilitychange', onVisibility);
        start();

        return function stop() {
            stopped = true;
            pause();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }

    function clearFieldErrors(root) {
        if (!root) return;
        root.querySelectorAll('.form-error').forEach(el => {
            el.classList.remove('visible');
            el.textContent = '';
        });
        root.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    }

    function showFieldErrors(root, fields) {
        if (!root || !fields) return;
        Object.entries(fields).forEach(([field, msg]) => {
            if (!msg) return;
            const input = root.querySelector(`[name="${field}"]`) || root.querySelector(`#ef-${field}`);
            if (input) input.classList.add('error');

            const err = root.querySelector(`#err-${field}`) ||
                        input?.closest('.form-group')?.querySelector('.form-error');
            if (err) {
                err.textContent = msg;
                err.classList.add('visible');
            }
        });
    }

    function getStatusBadge(event) {
        if (event.user_registered) return '<span class="badge badge-registered">✓ Registered</span>';
        if (event.status === 'past') return '<span class="badge badge-past">Past</span>';
        if (event.status === 'full') return '<span class="badge badge-full">Full</span>';
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
            if (currentUser.role === 'admin') navHtml += `<li><a href="/admin.html" class="${isActive('/admin.html')}">Admin</a></li>`;
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

        navHtml += `</ul></div></nav>`;

        const existingNav = $('nav.navbar');
        if (existingNav) existingNav.outerHTML = navHtml;
        else document.body.insertAdjacentHTML('afterbegin', navHtml);

        $('#nav-toggle')?.addEventListener('click', function () {
            const menu = $('#nav-menu');
            if (menu) {
                menu.classList.toggle('open');
                this.setAttribute('aria-expanded', String(menu.classList.contains('open')));
            }
        });

        $('#btn-logout')?.addEventListener('click', async () => {
            await api('POST', '/api/auth.php', { action: 'logout' });
            window.location.href = '/index.html';
        });
    }

    async function init(callback) {
        try {
            const res = await fetch('/api/auth.php', { headers: { 'Accept': 'application/json' } });
            const json = await res.json().catch(() => null);
            currentUser = (json?.success && json.data) ? json.data : null;
        } catch {
            currentUser = null;
        }

        buildNavbar();
        if (typeof callback === 'function') callback(currentUser);
    }

    return {
        init, api, toast, modal, confirm, actionButton, poll,
        showFieldErrors, clearFieldErrors, formatDateTime,
        truncate, getStatusBadge, getCapacityBarClass,
        safeRedirect, escapeHtml,
        get currentUser() { return currentUser; }
    };
})();
