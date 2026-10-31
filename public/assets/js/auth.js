/**
 * auth.js — Client-side authentication workflows.
 * Handles validation and form submission for login and signup,
 * password toggle visibility, inline errors, and safe post-login redirection.
 */
'use strict';

(() => {
    const SIGNUP_RULES = {
        name: [
            { test: v => v.length >= 2, msg: 'Name must be at least 2 characters.' },
            { test: v => v.length <= 100, msg: 'Name must be at most 100 characters.' }
        ],
        email: [
            { test: v => v.length > 0, msg: 'Email is required.' },
            { test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Please enter a valid email address.' }
        ],
        password: [
            { test: v => v.length >= 8, msg: 'Password must be at least 8 characters.' },
            { test: v => /[A-Za-z]/.test(v), msg: 'Password must contain at least one letter.' },
            { test: v => /[0-9]/.test(v), msg: 'Password must contain at least one number.' }
        ]
    };

    const LOGIN_RULES = {
        email: [{ test: v => v.length > 0, msg: 'Email is required.' }],
        password: [{ test: v => v.length > 0, msg: 'Password is required.' }]
    };

    function validate(form, rulesTable) {
        App.clearFieldErrors(form);
        const errors = {};
        Object.entries(rulesTable).forEach(([field, rules]) => {
            const raw = form.querySelector(`[name="${field}"]`)?.value || '';
            const val = (field === 'password') ? raw : raw.trim();
            for (const r of rules) {
                if (!r.test(val)) {
                    errors[field] = r.msg;
                    break;
                }
            }
        });

        if (Object.keys(errors).length > 0) {
            App.showFieldErrors(form, errors);
            return false;
        }
        return true;
    }

    function getRedirectUrl() {
        const next = new URLSearchParams(window.location.search).get('next');
        return App.safeRedirect(next);
    }

    on('click', '.password-toggle', function () {
        const input = this.closest('.password-wrapper')?.querySelector('.form-input');
        if (!input) return;
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        this.textContent = isPw ? 'Hide' : 'Show';
    });

    on('submit', '#signup-form', async function (e) {
        e.preventDefault();
        const form = this;
        if (!validate(form, SIGNUP_RULES)) return;

        const btn = form.querySelector('[type="submit"]');
        const origText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Creating account...';

        try {
            const res = await App.api('POST', '/api/auth.php', {
                action: 'signup',
                name: form.querySelector('[name="name"]').value.trim(),
                email: form.querySelector('[name="email"]').value.trim(),
                password: form.querySelector('[name="password"]').value
            });
            App.toast('success', res.message || 'Account created!');
            setTimeout(() => { window.location.href = getRedirectUrl(); }, 500);
        } catch (res) {
            btn.disabled = false;
            btn.textContent = origText;
            App.clearFieldErrors(form);
            if (res?.error) {
                if (res.error.fields) {
                    App.showFieldErrors(form, res.error.fields);
                } else if (res.error.code === 'DUPLICATE') {
                    App.showFieldErrors(form, { email: res.error.message });
                } else {
                    App.toast('error', res.error.message);
                }
            }
        }
    });

    on('submit', '#login-form', async function (e) {
        e.preventDefault();
        const form = this;
        if (!validate(form, LOGIN_RULES)) return;

        const btn = form.querySelector('[type="submit"]');
        const origText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Logging in...';

        try {
            const res = await App.api('POST', '/api/auth.php', {
                action: 'login',
                email: form.querySelector('[name="email"]').value.trim(),
                password: form.querySelector('[name="password"]').value
            });
            App.toast('success', res.message || 'Welcome back!');
            setTimeout(() => { window.location.href = getRedirectUrl(); }, 500);
        } catch (res) {
            btn.disabled = false;
            btn.textContent = origText;
            App.clearFieldErrors(form);
            if (res?.error) {
                if (res.error.code === 'INVALID_CREDENTIALS') {
                    App.showFieldErrors(form, { password: res.error.message || 'Invalid email or password.' });
                } else if (res.error.fields) {
                    App.showFieldErrors(form, res.error.fields);
                } else {
                    App.toast('error', res.error.message || 'Login failed.');
                }
            }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        App.init(user => {
            if (user) window.location.href = getRedirectUrl();
        });
    });
})();
