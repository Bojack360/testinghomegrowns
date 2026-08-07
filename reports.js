import { supabase } from './supabaseConfig.js';
import { requireAdmin, adminLogout } from './auth.js';
import { buildReceiptHTML, receiptDataFromTransaction } from './receipt.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!(await requireAdmin())) return;   // block non-admins before loading data
    loadReports();
    document.getElementById('applyFilter').addEventListener('click', loadReports);
    document.getElementById('clearFilter').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value   = '';
        loadReports();
    });
    // The Print button now opens a section-picker modal instead of printing directly.
    document.getElementById('printReport').addEventListener('click', openPrintModal);
    initReportTabs();
});

// ── Print section picker ─────────────────────────────────────────────────────
const PRINT_ORDER  = ['panel-events', 'panel-orders', 'panel-pos'];
const PRINT_LABELS = {
    'panel-events': 'Events',
    'panel-orders': 'Merchandise Reservations',
    'panel-pos':    'Product Sales',
};

function openPrintModal() {
    document.querySelectorAll('.print-check').forEach(c => { c.checked = true; });  // default: all
    document.getElementById('printError').style.display = 'none';
    document.getElementById('printModal').style.display = 'flex';
}
function closePrintModal() {
    document.getElementById('printModal').style.display = 'none';
}
function printSelectAll() {
    document.querySelectorAll('.print-check').forEach(c => { c.checked = true; });
    document.getElementById('printError').style.display = 'none';
}
function printClearSelection() {
    document.querySelectorAll('.print-check').forEach(c => { c.checked = false; });
}

function doPrint() {
    const checked = [...document.querySelectorAll('.print-check')].filter(c => c.checked).map(c => c.value);
    if (checked.length === 0) {
        document.getElementById('printError').style.display = 'block';
        return;
    }
    document.getElementById('printError').style.display = 'none';

    // Mark only the selected panels for print, in the fixed section order,
    // with a page break before every section after the first.
    const selected = PRINT_ORDER.filter(id => checked.includes(id));
    PRINT_ORDER.forEach(id => {
        const p = document.getElementById(id);
        if (p) p.classList.remove('print-include');
    });
    selected.forEach(id => {
        document.getElementById(id).classList.add('print-include');
    });

    // Build the print header (brand / title / meta).
    const from = document.getElementById('dateFrom').value;
    const to   = document.getElementById('dateTo').value;
    const fmt  = d => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    let range;
    if (from && to)  range = `${fmt(from)} to ${fmt(to)}`;
    else if (from)   range = `From ${fmt(from)}`;
    else if (to)     range = `Up to ${fmt(to)}`;
    else             range = 'All dates';

    document.getElementById('printGeneratedAt').textContent =
        'Date Generated: ' + new Date().toLocaleString('en-US',
            { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    document.getElementById('printDateRange').textContent = 'Date Range: ' + range;
    document.getElementById('printSections').textContent  =
        'Report Sections: ' + selected.map(id => PRINT_LABELS[id]).join(', ');

    closePrintModal();
    window.print();
}

// Show one report panel at a time via the tab bar (data-only handled elsewhere).
function initReportTabs() {
    const tabs   = document.querySelectorAll('.report-tab');
    const panels = document.querySelectorAll('.report-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.target;
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            panels.forEach(p => p.classList.toggle('active', p.id === targetId));
        });
    });
}

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

// ── Pagination (10 records per page, shared across the report tables) ─────────
const PAGE_SIZE = 10;
let eventsData = [], ordersData = [], posData = [];
let eventsPage = 1, ordersPage = 1, posPage = 1;

function buildPager(infoId, pagId, total, page, onPageChange) {
    const info = document.getElementById(infoId);
    const pag  = document.getElementById(pagId);
    const pages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const startIdx = (page - 1) * PAGE_SIZE;
    const shown    = Math.max(0, Math.min(PAGE_SIZE, total - startIdx));

    if (info) info.textContent = total === 0
        ? 'Showing 0 records'
        : `Showing ${startIdx + 1}–${startIdx + shown} of ${total} records`;

    if (!pag) return;
    pag.innerHTML = '';
    if (pages <= 1) return;

    const mk = (label, p, opts = {}) => {
        const b = document.createElement('button');
        b.className = 'page-btn' + (opts.active ? ' active' : '');
        b.innerHTML = label;
        b.disabled = !!opts.disabled;
        if (!opts.disabled && !opts.active) b.addEventListener('click', () => onPageChange(p));
        return b;
    };

    pag.appendChild(mk('&laquo;', 1, { disabled: page === 1 }));
    pag.appendChild(mk('&lsaquo;', page - 1, { disabled: page === 1 }));
    let s = Math.max(1, page - 2), e = Math.min(pages, s + 4); s = Math.max(1, e - 4);
    for (let p = s; p <= e; p++) pag.appendChild(mk(String(p), p, { active: p === page }));
    pag.appendChild(mk('&rsaquo;', page + 1, { disabled: page === pages }));
    pag.appendChild(mk('&raquo;', pages, { disabled: page === pages }));
}

// ── Events ──────────────────────────────────────────────────────────────────
function renderEvents(data) {
    if (data !== undefined) { eventsData = data; eventsPage = 1; renderEventsMini(); }   // fresh load resets to page 1
    const total    = eventsData.length;
    const pages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (eventsPage > pages) eventsPage = pages;
    if (eventsPage < 1) eventsPage = 1;
    const rows = eventsData.slice((eventsPage - 1) * PAGE_SIZE, (eventsPage - 1) * PAGE_SIZE + PAGE_SIZE);

    const tbody = document.getElementById('eventsBody');
    const noMsg = document.getElementById('noEvents');
    if (total === 0) { tbody.innerHTML = ''; noMsg.style.display = 'block'; }
    else {
        noMsg.style.display = 'none';
        tbody.innerHTML = rows.map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td>${esc(e.start)} - ${esc(e.end || '')}</td>
                <td>${esc(e.type || e.event_type || e.eventtype || '-')}</td>
                <td>${esc(e.pax || '-')}</td>
                <td>${fmtDateTime(e.submitted_at)}</td>
                <td>${fmtDateTime(e.approved_at)}</td>
            </tr>
        `).join('');
    }
    buildPager('eventsInfo', 'eventsPagination', total, eventsPage, p => { eventsPage = p; renderEvents(); });
}

// ── Online Orders ──────────────────────────────────────────────────────────
function renderOrders(data) {
    if (data !== undefined) {
        // Merchandise Reservations tab shows only completed (SOLD) records.
        // Filter the dataset before rendering so the table, summary cards, and
        // pagination all operate on SOLD-only data. ('approved' is the legacy
        // value that the system already displays as SOLD.)
        ordersData = data.filter(o => {
            const s = String(o.status || '').toLowerCase();
            return s === 'sold' || s === 'approved';
        });
        ordersPage = 1;
        renderOrdersMini();
    }
    const total = ordersData.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (ordersPage > pages) ordersPage = pages;
    if (ordersPage < 1) ordersPage = 1;
    const rows = ordersData.slice((ordersPage - 1) * PAGE_SIZE, (ordersPage - 1) * PAGE_SIZE + PAGE_SIZE);

    const tbody = document.getElementById('ordersBody');
    const noMsg = document.getElementById('noOrders');
    if (total === 0) { tbody.innerHTML = ''; noMsg.style.display = 'block'; }
    else {
        noMsg.style.display = 'none';
        tbody.innerHTML = rows.map(o => {
            const items = Array.isArray(o.items)
                ? o.items.map(i => `${esc(i.name)} &times;${i.qty || i.quantity || 1}`).join(', ')
                : '-';
            const statusRaw   = (o.status || '').toLowerCase();
            const statusLabel = statusRaw === 'approved' ? 'SOLD' : esc(o.status || '-');
            const statusClass = statusRaw === 'approved' ? 'approved' : statusRaw;
            return `
                <tr>
                    <td>${fmtDateTime(o.created_at)}</td>
                    <td>${esc(o.email || o.customer_email || '-')}</td>
                    <td class="items-cell">${items}</td>
                    <td>₱${parseFloat(o.total || 0).toFixed(2)}</td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                </tr>
            `;
        }).join('');
    }
    buildPager('ordersInfo', 'ordersPagination', total, ordersPage, p => { ordersPage = p; renderOrders(); });
}

// ── POS Transactions ───────────────────────────────────────────────────────
function renderPos(data) {
    if (data !== undefined) { posData = data; posPage = 1; renderPosMini(); }
    const total = posData.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (posPage > pages) posPage = pages;
    if (posPage < 1) posPage = 1;
    const rows = posData.slice((posPage - 1) * PAGE_SIZE, (posPage - 1) * PAGE_SIZE + PAGE_SIZE);

    const tbody = document.getElementById('posBody');
    const noMsg = document.getElementById('noPos');
    if (total === 0) { tbody.innerHTML = ''; noMsg.style.display = 'block'; }
    else {
        noMsg.style.display = 'none';
        tbody.innerHTML = rows.map(t => {
            const items = Array.isArray(t.items)
                ? t.items.map(i => `${esc(i.name)} &times;${i.qty}`).join(', ')
                : '-';
            return `
                <tr>
                    <td>${fmtDateTime(t.created_at)}</td>
                    <td class="items-cell">${items}</td>
                    <td>₱${parseFloat(t.total || 0).toFixed(2)}</td>
                    <td>${esc(t.payment_method || '-')}</td>
                    <td><button class="receipt-btn" onclick="viewReceipt('${t.id}')">Receipt</button></td>
                </tr>
            `;
        }).join('');
    }
    buildPager('posInfo', 'posPagination', total, posPage, p => { posPage = p; renderPos(); });
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

// ── Per-report summary cards (computed from the currently loaded data) ────────
// Returns the most frequent non-empty string in a list, or null.
function mode(list) {
    const counts = {};
    let best = null, bestN = 0;
    list.forEach(v => {
        if (!v) return;
        counts[v] = (counts[v] || 0) + 1;
        if (counts[v] > bestN) { bestN = counts[v]; best = v; }
    });
    return best;
}

function setMini(containerId, cards) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = cards.map(c => `
        <div class="mini-card">
            <span class="mini-label">${esc(c.label)}</span>
            <span class="mini-value">${esc(String(c.value))}</span>
            ${c.sub ? `<span class="mini-sub">${esc(c.sub)}</span>` : ''}
        </div>`).join('');
}

function renderEventsMini() {
    const d = eventsData;
    const guests = d.reduce((s, e) => s + (Number(e.pax) || 0), 0);
    const venue  = mode(d.map(e => e.venue));
    const type   = mode(d.map(e => e.type || e.event_type || e.eventtype));
    setMini('eventsMini', [
        { label: 'Total Confirmed Events', value: d.length,       sub: 'approved bookings' },
        { label: 'Total Guests',           value: guests,         sub: 'sum of pax' },
        { label: 'Most Booked Venue',      value: venue || '—',   sub: 'top venue' },
        { label: 'Most Common Event Type', value: type  || '—',   sub: 'top event type' },
    ]);
}

function renderOrdersMini() {
    const d = ordersData;
    const st = o => String(o.status || '').toLowerCase();
    const pending   = d.filter(o => st(o) === 'pending').length;
    const completed = d.filter(o => ['approved', 'sold', 'claimed', 'completed'].includes(st(o))).length;
    const items = d.reduce((s, o) => s + (Array.isArray(o.items)
        ? o.items.reduce((a, i) => a + (Number(i.qty || i.quantity) || 0), 0) : 0), 0);
    setMini('ordersMini', [
        { label: 'Total Reservations', value: d.length,   sub: 'online orders' },
        { label: 'Pending Orders',     value: pending,    sub: 'awaiting action' },
        { label: 'Completed Orders',   value: completed,  sub: 'sold / claimed' },
        { label: 'Reserved Items',     value: items,      sub: 'total quantity' },
    ]);
}

function renderPosMini() {
    const d = posData;
    let itemsSold = 0;
    const counts = {};
    d.forEach(t => {
        if (!Array.isArray(t.items)) return;
        t.items.forEach(i => {
            const q = Number(i.qty) || 0;
            itemsSold += q;
            if (i.name) counts[i.name] = (counts[i.name] || 0) + q;
        });
    });
    let best = null, bestQ = 0;
    for (const [name, q] of Object.entries(counts)) if (q > bestQ) { bestQ = q; best = name; }
    const revenue = d.reduce((s, t) => s + (parseFloat(t.total) || 0), 0);
    setMini('posMini', [
        { label: 'Total Transactions',   value: d.length,                      sub: 'POS sales' },
        { label: 'Total Items Sold',     value: itemsSold,                     sub: 'units' },
        { label: 'Best Selling Product', value: best || '—',                   sub: best ? bestQ + ' sold' : '' },
        { label: 'Total Revenue',        value: '₱' + revenue.toFixed(2),      sub: 'gross' },
    ]);
}

// ── Receipt view / reprint (Product Sales) ───────────────────────────────────
function viewReceipt(txnId) {
    const txn = posData.find(t => String(t.id) === String(txnId));
    if (!txn) return;
    document.getElementById('receiptViewBody').innerHTML =
        buildReceiptHTML(receiptDataFromTransaction(txn));
    document.getElementById('receiptViewModal').style.display = 'flex';
}
function closeReceiptModal() {
    document.getElementById('receiptViewModal').style.display = 'none';
}
function printReceipt() {
    document.body.classList.add('printing-receipt');
    window.print();
    document.body.classList.remove('printing-receipt');
}

window.openPrintModal      = openPrintModal;
window.closePrintModal     = closePrintModal;
window.printSelectAll      = printSelectAll;
window.printClearSelection = printClearSelection;
window.doPrint             = doPrint;
window.viewReceipt         = viewReceipt;
window.closeReceiptModal   = closeReceiptModal;
window.printReceipt        = printReceipt;
window.logout = adminLogout;
