import { supabase } from './supabaseConfig.js';

export async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
}

export async function requireAuth() {
    const user = await getUser();
    if (!user) {
        const here = window.location.pathname.split('/').pop() || 'index.html';
        window.location.href = `login.html?redirect=${encodeURIComponent(here)}`;
        return null;
    }
    return user;
}

export async function initNavAuth() {
    const user = await getUser();
    const loginLink = document.querySelector('a.btn-account[href="login.html"]');
    if (!loginLink) return;

    if (user) {
        const meta = user.user_metadata || {};
        const name = (meta.full_name || user.email || '').split('@')[0];
        loginLink.textContent = name;
        loginLink.removeAttribute('href');
        loginLink.style.cursor = 'default';

        const li = loginLink.closest('li');
        if (li && !document.getElementById('nav-logout')) {
            const logoutLi = document.createElement('li');
            logoutLi.innerHTML = '<a href="#" id="nav-logout" class="btn-account">Log-out</a>';
            li.after(logoutLi);
            document.getElementById('nav-logout').addEventListener('click', async e => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = 'index.html';
            });
        }
    }
}
