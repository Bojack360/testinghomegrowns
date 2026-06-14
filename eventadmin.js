import { supabase } from './supabaseConfig.js';

// ==========================================
// GLOBAL STATE
// ==========================================
let bookings        = [];
let selectedBooking = null;

const bookingsTableBody = document.getElementById('bookingsTableBody');
const noBookings        = document.getElementById('noBookings');
const statusFilter      = document.getElementById('statusFilter');
const dateFilter        = document.getElementById('dateFilter');
const clearFiltersBtn   = document.getElementById('clearFilters');

const pendingCountEl    = document.getElementById('pendingCount');
const approvedCountEl   = document.getElementById('approvedCount');
const rejectedCountEl   = document.getElementById('rejectedCount');
const totalCountEl      = document.getElementById('totalCount');

const detailsModal          = document.getElementById('detailsModal');
const bookingDetailsContent = document.getElementById('bookingDetailsContent');
const actionButtons         = document.getElementById('actionButtons');
const approveBtn            = document.getElementById('approveBtn');
const rejectBtn             = document.getElementById('rejectBtn');
const closeDetailsBtn       = document.getElementById('closeDetailsBtn');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadBookings();
    renderBookings();
    updateStats();
});

// ==========================================
// DATA LOADING
// ==========================================
async function loadBookings() {
    try {
        const { data, error } = await supabase
            .from('event_bookings')
            .select('*')
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        bookings = data.map(row => ({
            ...row,
            submittedAt: row.submitted_at ? new Date(row.submitted_at).toLocaleString() : 'Unknown',
            approvedAt:  row.approved_at  ? new Date(row.approved_at).toLocaleString()  : null,
            rejectedAt:  row.rejected_at  ? new Date(row.rejected_at).toLocaleString()  : null
        }));

        console.log(`Loaded ${bookings.length} bookings`);
    } catch (error) {
        console.error('Failed to load bookings:', error);
        alert('Could not load bookings. Check your connection.');
    }
}

// ==========================================
// STATS
// ==========================================
function updateStats() {
    pendingCountEl.innerText  = bookings.filter(b => b.status === 'pending').length;
    approvedCountEl.innerText = bookings.filter(b => b.status === 'approved').length;
    rejectedCountEl.innerText = bookings.filter(b => b.status === 'rejected').length;
    totalCountEl.innerText    = bookings.length;
}

// ==========================================
// TABLE RENDERING
// ==========================================
function renderBookings() {
    const statusValue = statusFilter.value;
    const dateValue   = dateFilter.value;

    let filtered = [...bookings];
    if (statusValue !== 'all') filtered = filtered.filter(b => b.status === statusValue);
    if (dateValue)             filtered = filtered.filter(b => (b.date || '').startsWith(dateValue));

    bookingsTableBody.innerHTML = '';

    if (filtered.length === 0) {
        noBookings.style.display = 'block';
        return;
    }
    noBookings.style.display = 'none';

    filtered.forEach(booking => {
        const statusText = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${booking.id.toString().slice(-6).toUpperCase()}</td>
            <td>${booking.date || 'N/A'}</td>
            <td>${booking.start || ''} - ${booking.end || ''}</td>
            <td>${booking.type || 'N/A'}</td>
            <td>${booking.pax || '-'}</td>
            <td><span class="status-badge ${booking.status}">${statusText}</span></td>
            <td>${booking.submittedAt}</td>
            <td>
                <button class="action-btn btn-view" onclick="viewBooking('${booking.id}')">View</button>
                ${booking.status === 'pending' ? `
                    <button class="action-btn btn-approve" onclick="approveBooking('${booking.id}')">&#10003;</button>
                    <button class="action-btn btn-reject"  onclick="rejectBooking('${booking.id}')">&#10007;</button>
                ` : ''}
                <button class="action-btn btn-delete" onclick="deleteBooking('${booking.id}')">&#128465;</button>
            </td>
        `;
        bookingsTableBody.appendChild(row);
    });
}

// ==========================================
// VIEW DETAILS
// ==========================================
function viewBooking(bookingId) {
    const booking = bookings.find(b => String(b.id) === String(bookingId));
    if (!booking) return;

    selectedBooking = booking;
    const statusText = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);

    bookingDetailsContent.innerHTML = `
        <div class="detail-row"><label>Booking ID:</label><span>#${booking.id.toString().slice(-6).toUpperCase()}</span></div>
        <div class="detail-row"><label>Date:</label><span>${booking.date || 'N/A'}</span></div>
        <div class="detail-row"><label>Time:</label><span>${booking.start || ''} - ${booking.end || ''}</span></div>
        <div class="detail-row"><label>Event Type:</label><span>${booking.type || 'N/A'}</span></div>
        <div class="detail-row"><label>Number of Pax:</label><span>${booking.pax || '-'}</span></div>
        <div class="detail-row"><label>Description:</label><span>${booking.description || 'No description'}</span></div>
        <div class="detail-row"><label>Status:</label><span class="status-badge ${booking.status}">${statusText}</span></div>
        <div class="detail-row"><label>Submitted:</label><span>${booking.submittedAt}</span></div>
        ${booking.approvedAt ? `<div class="detail-row"><label>Approved At:</label><span>${booking.approvedAt}</span></div>` : ''}
        ${booking.rejectedAt ? `
            <div class="detail-row"><label>Rejected At:</label><span>${booking.rejectedAt}</span></div>
            <div class="detail-row"><label>Rejection Reason:</label><span>${booking.rejection_reason || 'No reason provided'}</span></div>
        ` : ''}
    `;

    if (booking.status === 'pending') {
        actionButtons.style.display = 'flex';
        actionButtons.innerHTML = `
            <button type="button" class="btn btn-approve" onclick="approveBooking('${booking.id}')">Approve</button>
            <button type="button" class="btn btn-reject"  onclick="rejectBooking('${booking.id}')">Reject</button>
            <button type="button" class="btn btn-cancel"  onclick="closeDetailsModal()">Close</button>
        `;
    } else {
        actionButtons.style.display = 'flex';
        actionButtons.innerHTML = `
            <button type="button" class="btn btn-revert" onclick="revertBooking('${booking.id}')">&#8617; Revert to Pending</button>
            <button type="button" class="btn btn-cancel" onclick="closeDetailsModal()">Close</button>
        `;
    }

    detailsModal.style.display = 'flex';
}

// ==========================================
// ACTIONS
// ==========================================
async function approveBooking(bookingId) {
    if (!confirm('Approve this booking?')) return;
    try {
        const { error } = await supabase
            .from('event_bookings')
            .update({ status: 'approved', approved_at: new Date().toISOString() })
            .eq('id', bookingId);
        if (error) throw error;
        alert('Booking approved!');
        closeDetailsModal();
        await loadBookings(); renderBookings(); updateStats();
    } catch (error) {
        console.error('Failed to approve:', error);
        alert('Failed to approve booking. Please try again.');
    }
}

async function rejectBooking(bookingId) {
    const reason = prompt('Enter reason for rejection (optional):');
    try {
        const { error } = await supabase
            .from('event_bookings')
            .update({
                status:           'rejected',
                rejected_at:      new Date().toISOString(),
                rejection_reason: reason || 'No reason provided'
            })
            .eq('id', bookingId);
        if (error) throw error;
        alert('Booking rejected!');
        closeDetailsModal();
        await loadBookings(); renderBookings(); updateStats();
    } catch (error) {
        console.error('Failed to reject:', error);
        alert('Failed to reject booking. Please try again.');
    }
}

async function deleteBooking(bookingId) {
    if (!confirm('Delete this booking permanently?')) return;
    try {
        const { error } = await supabase.from('event_bookings').delete().eq('id', bookingId);
        if (error) throw error;
        alert('Booking deleted!');
        await loadBookings(); renderBookings(); updateStats();
    } catch (error) {
        console.error('Failed to delete:', error);
        alert('Failed to delete booking. Please try again.');
    }
}

async function revertBooking(bookingId) {
    if (!confirm('Revert this booking to Pending?')) return;
    try {
        const { error } = await supabase
            .from('event_bookings')
            .update({
                status:           'pending',
                approved_at:      null,
                rejected_at:      null,
                rejection_reason: null,
                reverted_at:      new Date().toISOString()
            })
            .eq('id', bookingId);
        if (error) throw error;
        alert('Booking reverted to Pending!');
        closeDetailsModal();
        await loadBookings(); renderBookings(); updateStats();
    } catch (error) {
        console.error('Failed to revert:', error);
        alert('Failed to revert booking. Please try again.');
    }
}

// ==========================================
// MODAL & FILTERS
// ==========================================
function closeDetailsModal() {
    detailsModal.style.display = 'none';
    selectedBooking = null;
}

statusFilter.addEventListener('change', renderBookings);
dateFilter.addEventListener('change', renderBookings);
clearFiltersBtn.addEventListener('click', () => {
    statusFilter.value = 'all';
    dateFilter.value   = '';
    renderBookings();
});
closeDetailsBtn.addEventListener('click', closeDetailsModal);
window.addEventListener('click', e => { if (e.target === detailsModal) closeDetailsModal(); });
approveBtn.addEventListener('click', () => { if (selectedBooking) approveBooking(selectedBooking.id); });
rejectBtn.addEventListener('click',  () => { if (selectedBooking) rejectBooking(selectedBooking.id);  });

// ==========================================
// EXPOSE TO GLOBAL SCOPE
// ==========================================
window.viewBooking    = viewBooking;
window.approveBooking = approveBooking;
window.rejectBooking  = rejectBooking;
window.deleteBooking  = deleteBooking;
window.revertBooking  = revertBooking;
window.closeDetailsModal = closeDetailsModal;
window.logout = () => { window.location.href = 'login.html'; };
