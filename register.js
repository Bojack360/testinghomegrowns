import { supabase } from './supabaseConfig.js';

const form = document.querySelector('form');
const btn  = form.querySelector('.btn-submit');

form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError();

    const fullName = document.getElementById('fullname').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-confirm').value;

    if (password !== confirm) { showError('Passwords do not match.'); return; }
    if (password.length < 6)  { showError('Password must be at least 6 characters.'); return; }

    btn.textContent = 'Creating account…';
    btn.disabled = true;

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
    });

    if (error) {
        showError(error.message);
        btn.textContent = 'Register';
        btn.disabled = false;
        return;
    }

    form.innerHTML = `
        <div style="text-align:center;padding:16px 0;">
            <p style="color:#27ae60;font-size:1.1rem;margin-bottom:10px;">✓ Account created!</p>
            <p style="color:#888;font-size:0.88rem;line-height:1.6;">
                Check your inbox to confirm your email, then<br>
                <a href="login.html" style="color:#d4c5b5;text-decoration:underline;">click here to log in</a>.
            </p>
        </div>
    `;
});

function showError(msg) {
    let el = document.getElementById('reg-error');
    if (!el) {
        el = document.createElement('p');
        el.id = 'reg-error';
        el.style.cssText = 'color:#e74c3c;font-size:0.85rem;margin:8px 0 0;text-align:center;';
        btn.before(el);
    }
    el.textContent = msg;
}

function clearError() {
    document.getElementById('reg-error')?.remove();
}
