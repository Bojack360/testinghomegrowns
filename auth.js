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
        const fullName = meta.full_name || user.email || '';
        const initial = fullName.charAt(0).toUpperCase();

        // Turn the login link into a circular avatar
        loginLink.textContent = initial;
        loginLink.removeAttribute('href');
        Object.assign(loginLink.style, {
            width:          '38px',
            height:         '38px',
            borderRadius:   '50%',
            padding:        '0',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontWeight:     '700',
            fontSize:       '1rem',
            cursor:         'default',
            background:     'rgba(212,197,181,0.15)',
            border:         '2px solid #d4c5b5',
            color:          '#d4c5b5',
            letterSpacing:  '0',
            textTransform:  'uppercase',
        });

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
