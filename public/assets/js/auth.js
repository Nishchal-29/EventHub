'use strict';

(() => {
    on('click', '.password-toggle', function () {
        const input = this.closest('.password-wrapper')?.querySelector('.form-input') || this.parentElement.querySelector('.form-input');
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        this.textContent = isPassword ? 'Hide' : 'Show';
    });

    function clearErrors(form) {
        form.querySelectorAll('.form-error').forEach(el => {
            el.classList.remove('visible');
            el.textContent = '';
        });
        form.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    }

    function showFieldError(form, field, message) {
        const input = form.querySelector(`[name="${field}"]`);
        if (input) {
            input.classList.add('error');
            const err = input.closest('.form-group')?.querySelector('.form-error');
            if (err) {
                err.classList.add('visible');
                err.textContent = message;
            }
        }
    }

    function showServerErrors(form, errors) {
        if (errors && typeof errors === 'object') {
            Object.entries(errors).forEach(([field, msg]) => showFieldError(form, field, msg));
        }
    }

    function validateSignup(form) {
        clearErrors(form);
        let valid = true;
        const name = form.querySelector('[name="name"]')?.value.trim() || '';
        const email = form.querySelector('[name="email"]')?.value.trim() || '';
        const password = form.querySelector('[name="password"]')?.value || '';

        if (name.length < 2) {
            showFieldError(form, 'name', 'Name must be at least 2 characters.');
            valid = false;
        } else if (name.length > 100) {
            showFieldError(form, 'name', 'Name must be at most 100 characters.');
            valid = false;
        }

        if (!email) {
            showFieldError(form, 'email', 'Email is required.');
            valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError(form, 'email', 'Please enter a valid email address.');
            valid = false;
        }

        if (password.length < 8) {
            showFieldError(form, 'password', 'Password must be at least 8 characters.');
            valid = false;
        } else if (!/[A-Za-z]/.test(password)) {
            showFieldError(form, 'password', 'Password must contain at least one letter.');
            valid = false;
        } else if (!/[0-9]/.test(password)) {
            showFieldError(form, 'password', 'Password must contain at least one number.');
            valid = false;
        }

        return valid;
    }

    function validateLogin(form) {
        clearErrors(form);
        let valid = true;
        const email = form.querySelector('[name="email"]')?.value.trim() || '';
        const password = form.querySelector('[name="password"]')?.value || '';

        if (!email) {
            showFieldError(form, 'email', 'Email is required.');
            valid = false;
        }
        if (!password) {
            showFieldError(form, 'password', 'Password is required.');
            valid = false;
        }

        return valid;
    }

    function getRedirectUrl() {
        const next = new URLSearchParams(window.location.search).get('next');
        return App.safeRedirect(next) || '/index.html';
    }

    on('submit', '#signup-form', async function (e) {
        e.preventDefault();
        const form = this;
        if (!validateSignup(form)) return;

        const btn = form.querySelector('[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Creating account...';

        try {
            const res = await App.api('POST', '/api/signup.php', {
                name: form.querySelector('[name="name"]').value.trim(),
                email: form.querySelector('[name="email"]').value.trim(),
                password: form.querySelector('[name="password"]').value
            });
            App.toast('success', res.message || 'Account created!');
            setTimeout(() => { window.location.href = getRedirectUrl(); }, 500);
        } catch (res) {
            btn.disabled = false;
            btn.textContent = originalText;
            clearErrors(form);
            if (res?.error) {
                if (res.error.fields) {
                    showServerErrors(form, res.error.fields);
                } else if (res.error.code === 'DUPLICATE') {
                    showFieldError(form, 'email', res.error.message);
                } else {
                    App.toast('error', res.error.message);
                }
            }
        }
    });

    on('submit', '#login-form', async function (e) {
        e.preventDefault();
        const form = this;
        if (!validateLogin(form)) return;

        const btn = form.querySelector('[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Logging in...';

        try {
            const res = await App.api('POST', '/api/login.php', {
                email: form.querySelector('[name="email"]').value.trim(),
                password: form.querySelector('[name="password"]').value
            });
            App.toast('success', res.message || 'Welcome back!');
            setTimeout(() => { window.location.href = getRedirectUrl(); }, 500);
        } catch (res) {
            btn.disabled = false;
            btn.textContent = originalText;
            clearErrors(form);
            if (res?.error) {
                if (res.error.code === 'INVALID_CREDENTIALS') {
                    showFieldError(form, 'password', res.error.message || 'Invalid email or password.');
                    App.toast('error', res.error.message || 'Invalid email or password.');
                } else if (res.error.code === 'RATE_LIMITED') {
                    showFieldError(form, 'password', res.error.message);
                    App.toast('error', res.error.message);
                } else if (res.error.fields) {
                    showServerErrors(form, res.error.fields);
                } else {
                    App.toast('error', res.error.message || 'Login failed. Please check your credentials.');
                }
            } else {
                App.toast('error', 'Login failed. Please check your credentials.');
            }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        App.init(user => {
            if (user) window.location.href = getRedirectUrl();
        });
    });
})();