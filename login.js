import { supabase } from './supabaseConfig.js';

const form = document.getElementById('loginform1');
const btn  = form.querySelector('.btn-submit');

form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError();

    const emailVal = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    btn.textContent = 'Logging in…';
    btn.disabled = true;

    const { data, error } = await supabase.auth.signInWithPassword({ email: emailVal, password });

    if (error) {
        showError(error.message);
        btn.textContent = 'Login';
        btn.disabled = false;
        return;
    }

    // Admin gets a real Supabase session AND goes to the admin panel
    if (data.user?.email === 'admin@gmail.com') {
        window.location.href = 'merchadmin.html';
        return;
    }

    const redirect = new URLSearchParams(window.location.search).get('redirect') || 'index.html';
    window.location.href = redirect;
});

function showError(msg) {
    let el = document.getElementById('login-error');
    if (!el) {
        el = document.createElement('p');
        el.id = 'login-error';
        el.style.cssText = 'color:#e74c3c;font-size:0.85rem;margin:8px 0 0;text-align:center;';
        btn.before(el);
    }
    el.textContent = msg;
}

function clearError() {
    document.getElementById('login-error')?.remove();
}
