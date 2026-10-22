/**
 * auth.js — Login and signup form handling.
 * Client-side validation mirroring server rules, inline error display, show/hide password.
 */
'use strict';

(function ($) {

    // ── Password Toggle ──────────────────────────────────────────────
    $(document).on('click', '.password-toggle', function () {
        const $input = $(this).siblings('.form-input');
        const isPassword = $input.attr('type') === 'password';
        $input.attr('type', isPassword ? 'text' : 'password');
        $(this).text(isPassword ? 'Hide' : 'Show');
    });

    // ── Validation Helpers ───────────────────────────────────────────
    function clearErrors($form) {
        $form.find('.form-error').removeClass('visible').text('');
        $form.find('.form-input').removeClass('error');
    }

    function showFieldError($form, field, message) {
        const $input = $form.find('[name="' + field + '"]');
        $input.addClass('error');
        $input.closest('.form-group').find('.form-error').addClass('visible').text(message);
    }

    function showServerErrors($form, errors) {
        if (errors && typeof errors === 'object') {
            Object.keys(errors).forEach(function (field) {
                showFieldError($form, field, errors[field]);
            });
        }
    }

    function validateSignup($form) {
        clearErrors($form);
        let valid = true;
        const name = $form.find('[name="name"]').val().trim();
        const email = $form.find('[name="email"]').val().trim();
        const password = $form.find('[name="password"]').val();

        if (name.length < 2) {
            showFieldError($form, 'name', 'Name must be at least 2 characters.');
            valid = false;
        } else if (name.length > 100) {
            showFieldError($form, 'name', 'Name must be at most 100 characters.');
            valid = false;
        }

        if (!email) {
            showFieldError($form, 'email', 'Email is required.');
            valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError($form, 'email', 'Please enter a valid email address.');
            valid = false;
        }

        if (password.length < 8) {
            showFieldError($form, 'password', 'Password must be at least 8 characters.');
            valid = false;
        } else if (!/[A-Za-z]/.test(password)) {
            showFieldError($form, 'password', 'Password must contain at least one letter.');
            valid = false;
        } else if (!/[0-9]/.test(password)) {
            showFieldError($form, 'password', 'Password must contain at least one number.');
            valid = false;
        }

        return valid;
    }

    function validateLogin($form) {
        clearErrors($form);
        let valid = true;
        const email = $form.find('[name="email"]').val().trim();
        const password = $form.find('[name="password"]').val();

        if (!email) {
            showFieldError($form, 'email', 'Email is required.');
            valid = false;
        }
        if (!password) {
            showFieldError($form, 'password', 'Password is required.');
            valid = false;
        }

        return valid;
    }

    // ── Get redirect URL ─────────────────────────────────────────────
    function getRedirectUrl() {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        return App.safeRedirect(next) || '/index.html';
    }

    // ── Signup Form ──────────────────────────────────────────────────
    $(document).on('submit', '#signup-form', function (e) {
        e.preventDefault();
        const $form = $(this);
        if (!validateSignup($form)) return;

        const $btn = $form.find('[type="submit"]');
        const originalText = $btn.text();
        $btn.prop('disabled', true).html('<span class="spinner-inline"></span> Creating account...');

        App.api('POST', '/api/signup.php', {
            name: $form.find('[name="name"]').val().trim(),
            email: $form.find('[name="email"]').val().trim(),
            password: $form.find('[name="password"]').val()
        }).then(function (res) {
            App.toast('success', res.message || 'Account created!');
            setTimeout(function () {
                window.location.href = getRedirectUrl();
            }, 500);
        }).catch(function (res) {
            $btn.prop('disabled', false).text(originalText);
            clearErrors($form);
            if (res && res.error) {
                if (res.error.fields) {
                    showServerErrors($form, res.error.fields);
                } else if (res.error.code === 'DUPLICATE') {
                    showFieldError($form, 'email', res.error.message);
                } else {
                    App.toast('error', res.error.message);
                }
            }
        });
    });

    // ── Login Form ───────────────────────────────────────────────────
    $(document).on('submit', '#login-form', function (e) {
        e.preventDefault();
        const $form = $(this);
        if (!validateLogin($form)) return;

        const $btn = $form.find('[type="submit"]');
        const originalText = $btn.text();
        $btn.prop('disabled', true).html('<span class="spinner-inline"></span> Logging in...');

        App.api('POST', '/api/login.php', {
            email: $form.find('[name="email"]').val().trim(),
            password: $form.find('[name="password"]').val()
        }).then(function (res) {
            App.toast('success', res.message || 'Welcome back!');
            setTimeout(function () {
                window.location.href = getRedirectUrl();
            }, 500);
        }).catch(function (res) {
            $btn.prop('disabled', false).text(originalText);
            clearErrors($form);
            if (res && res.error) {
                if (res.error.code === 'INVALID_CREDENTIALS') {
                    showFieldError($form, 'password', res.error.message || 'Invalid email or password.');
                    App.toast('error', res.error.message || 'Invalid email or password.');
                } else if (res.error.code === 'RATE_LIMITED') {
                    showFieldError($form, 'password', res.error.message);
                    App.toast('error', res.error.message);
                } else if (res.error.fields) {
                    showServerErrors($form, res.error.fields);
                } else {
                    App.toast('error', res.error.message || 'Login failed. Please check your credentials.');
                }
            } else {
                App.toast('error', 'Login failed. Please check your credentials.');
            }
        });
    });

    // ── Init on DOM ready ─────────────────────────────────────────────
    $(function () {
        App.init(function (user) {
            if (user) {
                window.location.href = getRedirectUrl();
            }
        });
    });

})(jQuery);
