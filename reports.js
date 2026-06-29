import { supabase } from './supabaseConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    loadReports();
    document.getElementById('applyFilter').addEventListener('click', loadReports);
    document.getElementById('clearFilter').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value   = '';
        loadReports();
    });
});

async function loadReports() {
    const from = document.getElementById('dateFrom').value;
    const to   = document.getElementById('dateTo').value;

    const [{ data: events }, { data: orders }, { data: pos }] = await Promise.all([
        buildQuery(supabase.from('event_bookings').select('*').eq('status', 'approved').order('date', { ascending: false }), from, to, 'approved_at'),
        buildQuery(supabase.from('orders').select('*').order('created_at', { ascending: false }), from, to, 'created_at'),
        buildQuery(supabase.from('pos_transactions').select('*').order('created_at', { ascending: false }), from, to, 'created_at')
    ]);

    renderEvents(events   || []);
    renderOrders(orders   || []);
    renderPos(pos         || []);
    renderStats(events || [], orders || [], pos || []);
}

function buildQuery(q, from, to, field) {
    if (from) q = q.gte(field, from + 'T00:00:00');
    if (to)   q = q.lte(field, to   + 'T23:59:59');
    return q;
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats(events, orders, pos) {
    const onlineRevenue = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const posRevenue    = pos.reduce((s, t)   => s + (parseFloat(t.total) || 0), 0);

    document.getElementById('statEvents').textContent  = events.length;
    document.getElementById('statOrders').textContent  = orders.length;
    document.getElementById('statPos').textContent     = pos.length;
    document.getElementById('statRevenue').textContent = '₱' + (onlineRevenue + posRevenue).toFixed(2);
}

// ── Events ──────────────────────────────────────────────────────────────────
function renderEvents(events) {
    const tbody = document.getElementById('eventsBody');
    const noMsg = document.getElementById('noEvents');

    if (events.length === 0) {
        tbody.innerHTML  = '';
        noMsg.style.display = 'block';
        return;
    }
    noMsg.style.display = 'none';
    tbody.innerHTML = events.map(e => `
        <tr>
            <td>${fmtDate(e.date)}</td>
            <td>${esc(e.start)} - ${esc(e.end || '')}</td>
            <td>${esc(e.event_type || e.eventtype || '-')}</td>
            <td>${esc(e.pax || '-')}</td>
            <td>${fmtDateTime(e.submitted_at)}</td>
            <td>${fmtDateTime(e.approved_at)}</td>
        </tr>
    `).join('');
}

// ── Online Orders ──────────────────────────────────────────────────────────
function renderOrders(orders) {
    const tbody = document.getElementById('ordersBody');
    const noMsg = document.getElementById('noOrders');

    if (orders.length === 0) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        return;
    }
    noMsg.style.display = 'none';
    tbody.innerHTML = orders.map(o => {
        const items = Array.isArray(o.items)
            ? o.items.map(i => `${esc(i.name)} &times;${i.qty || i.quantity || 1}`).join(', ')
            : '-';
        const statusClass = (o.status || '').toLowerCase();
        return `
            <tr>
                <td>${fmtDateTime(o.created_at)}</td>
                <td>${esc(o.email || o.customer_email || '-')}</td>
                <td class="items-cell">${items}</td>
                <td>₱${parseFloat(o.total || 0).toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${esc(o.status || '-')}</span></td>
            </tr>
        `;
    }).join('');
}

// ── POS Transactions ───────────────────────────────────────────────────────
function renderPos(transactions) {
    const tbody = document.getElementById('posBody');
    const noMsg = document.getElementById('noPos');

    if (transactions.length === 0) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        return;
    }
    noMsg.style.display = 'none';
    tbody.innerHTML = transactions.map(t => {
        const items = Array.isArray(t.items)
            ? t.items.map(i => `${esc(i.name)} &times;${i.qty}`).join(', ')
            : '-';
        return `
            <tr>
                <td>${fmtDateTime(t.created_at)}</td>
                <td class="items-cell">${items}</td>
                <td>₱${parseFloat(t.total || 0).toFixed(2)}</td>
                <td>${esc(t.payment_method || '-')}</td>
            </tr>
        `;
    }).join('');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.logout = () => { window.location.href = 'index.html'; };
