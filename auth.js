import { supabase } from './supabaseConfig.js';

// The account allowed into the admin dashboard (matches login.js).
const ADMIN_EMAIL = 'admin@gmail.com';

export async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
}

// ── ADMIN SESSION GUARD ──────────────────────────────────────────────────────
// Call at the top of every admin page. Confirms a valid Supabase session exists
// AND that it belongs to the admin account. If not, redirect to the login page
// (using replace() so the protected page is not left in browser history).
// Returns the admin user object when valid, or null after redirecting.
export async function requireAdmin() {
    const user = await getUser();
    if (!user) {
        // Not logged in — send to login to authenticate.
        window.location.replace('login.html');
        return null;
    }
    if (user.email !== ADMIN_EMAIL) {
        // Logged in but not an admin — bounce back to the main user-facing site.
        window.location.replace('index.html');
        return null;
    }
    return user;
}

// ── ADMIN LOGOUT ─────────────────────────────────────────────────────────────
// Ends the Supabase session (clears the persisted auth token), then redirects
// to the login page.
export async function adminLogout() {
    try {
        await supabase.auth.signOut();
    } catch (err) {
        console.error('Logout failed:', err);
    }
    window.location.replace('login.html');
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
            let anchorLi = li;

            // Admin-only: an "Admin Dashboard" button beside Logout. Regular users
            // and guests never reach this branch, so they never see it.
            if (user.email === ADMIN_EMAIL) {
                const adminLi = document.createElement('li');
                adminLi.innerHTML = '<a href="merchadmin.html" id="nav-admin" class="btn-account">Admin Dashboard</a>';
                anchorLi.after(adminLi);
                anchorLi = adminLi;
            }

            const logoutLi = document.createElement('li');
            logoutLi.innerHTML = '<a href="#" id="nav-logout" class="btn-account">Log-out</a>';
            anchorLi.after(logoutLi);
            document.getElementById('nav-logout').addEventListener('click', async e => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = 'index.html';
            });
        }
    }
}
