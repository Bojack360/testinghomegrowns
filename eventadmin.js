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
const completedCountEl  = document.getElementById('completedCount');
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
    renderAdminCalendar();
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
    pendingCountEl.innerText   = bookings.filter(b => b.status === 'pending').length;
    approvedCountEl.innerText  = bookings.filter(b => b.status === 'approved').length;
    rejectedCountEl.innerText  = bookings.filter(b => b.status === 'rejected').length;
    completedCountEl.innerText = bookings.filter(b => b.status === 'completed').length;
    totalCountEl.innerText     = bookings.length;
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
            <td>${booking.start || ''} – ${booking.end || ''}</td>
            <td>${booking.type || 'N/A'}</td>
            <td>${booking.pax || '-'}</td>
            <td>${booking.venue ? `${booking.venue}<br><small style="color:#aaa;">${booking.venue_capacity ? booking.venue_capacity + ' pax max' : ''}</small>` : '-'}</td>
            <td><span class="status-badge ${booking.status}">${statusText}</span></td>
            <td>${booking.submittedAt}</td>
            <td>
                <button class="action-btn btn-view" onclick="viewBooking('${booking.id}')">View</button>
                ${booking.status === 'pending' ? `
                    <button class="action-btn btn-approve" onclick="approveBooking('${booking.id}')">&#10003;</button>
                    <button class="action-btn btn-reject"  onclick="rejectBooking('${booking.id}')">&#10007;</button>
                ` : ''}
                ${booking.status === 'approved' ? `
                    <button class="action-btn btn-complete" onclick="completeBooking('${booking.id}')">&#10003; Done</button>
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
        <div class="detail-row"><label>Time:</label><span>${booking.start || ''} – ${booking.end || ''}</span></div>
        <div class="detail-row"><label>Event Type:</label><span>${booking.type || 'N/A'}</span></div>
        <div class="detail-row"><label>Number of Pax:</label><span>${booking.pax || '-'}</span></div>
        <div class="detail-row"><label>Venue:</label><span>${booking.venue || 'N/A'}</span></div>
        <div class="detail-row"><label>Venue Capacity:</label><span>${booking.venue_capacity ? booking.venue_capacity + ' pax' : 'N/A'}</span></div>
        <div class="detail-row"><label>Requests:</label><span>${booking.description || 'None'}</span></div>
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
    } else if (booking.status === 'approved') {
        actionButtons.style.display = 'flex';
        actionButtons.innerHTML = `
            <button type="button" class="btn btn-done"   onclick="completeBooking('${booking.id}')">&#10003; Mark as Done</button>
            <button type="button" class="btn btn-revert" onclick="revertBooking('${booking.id}')">&#8617; Revert to Pending</button>
            <button type="button" class="btn btn-cancel" onclick="closeDetailsModal()">Close</button>
        `;
    } else {
        actionButtons.style.display = 'flex';
        actionButtons.innerHTML = `
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
        await loadBookings(); renderBookings(); updateStats(); renderAdminCalendar();
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
        await loadBookings(); renderBookings(); updateStats(); renderAdminCalendar();
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
        await loadBookings(); renderBookings(); updateStats(); renderAdminCalendar();
    } catch (error) {
        console.error('Failed to delete:', error);
        alert('Failed to delete booking. Please try again.');
    }
}

async function completeBooking(bookingId) {
    if (!confirm('Mark this booking as Done?\nThe time slot and venue will become available again for new bookings.')) return;
    try {
        const { error } = await supabase
            .from('event_bookings')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', bookingId);
        if (error) throw error;
        alert('Booking marked as completed. The slot is now available again.');
        closeDetailsModal();
        await loadBookings(); renderBookings(); updateStats(); renderAdminCalendar();
    } catch (error) {
        console.error('Failed to complete booking:', error);
        alert('Failed to update booking. Please try again.');
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
        await loadBookings(); renderBookings(); updateStats(); renderAdminCalendar();
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
// ADMIN CALENDAR
// ==========================================
let adminCurrentDate = new Date();
const VENUES = ['Veranda', 'Pool', 'Coffee Shop'];

function isVenueFullyBookedAdmin(dateString, dayBookings, venue) {
    const approved = dayBookings.filter(b => b.status === 'approved' && b.venue === venue && b.start && b.end);
    if (approved.length === 0) return false;
    const date = new Date(dateString);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const openTime  = isWeekend ? '12:00' : '10:00';
    const sorted = approved.map(b => ({ start: b.start, end: b.end })).sort((a, b) => a.start.localeCompare(b.start));
    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        if (sorted[i].start <= last.end) { if (sorted[i].end > last.end) last.end = sorted[i].end; }
        else { merged.push({ ...sorted[i] }); }
    }
    return merged.length === 1 && merged[0].start <= openTime && merged[0].end >= '20:00';
}

function isDayFullyBookedAdmin(dateString, dayBookings) {
    return VENUES.every(v => isVenueFullyBookedAdmin(dateString, dayBookings, v));
}

function buildAdminCalendarData() {
    const data = {};
    bookings.forEach(b => {
        if (!b.date) return;
        if (!data[b.date]) data[b.date] = [];
        data[b.date].push(b);
    });
    return data;
}

function renderAdminCalendar() {
    const adminCalDays   = document.getElementById('adminCalendarDays');
    const adminMonthDisp = document.getElementById('adminMonthYearDisplay');
    if (!adminCalDays || !adminMonthDisp) return;

    const year  = adminCurrentDate.getFullYear();
    const month = adminCurrentDate.getMonth();
    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    adminMonthDisp.innerText = `${monthNames[month]} ${year}`;

    const calData      = buildAdminCalendarData();
    const firstDayIdx  = new Date(year, month, 1).getDay();
    const lastDate     = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    let html = '';

    for (let i = firstDayIdx; i > 0; i--) {
        html += `<div class="admin-day inactive">${prevLastDate - i + 1}</div>`;
    }

    for (let i = 1; i <= lastDate; i++) {
        const isToday = i === new Date().getDate() &&
                        month === new Date().getMonth() &&
                        year  === new Date().getFullYear();
        const dateString  = `${monthNames[month]} ${i}, ${year}`;
        const dayBookings = calData[dateString] || [];

        let extraClass = isToday ? 'today' : '';
        let content    = `<span class="admin-day-number">${i}</span>`;

        if (dayBookings.length > 0) {
            const approved = dayBookings.filter(b => b.status === 'approved');
            const pending  = dayBookings.filter(b => b.status === 'pending');

            if (isDayFullyBookedAdmin(dateString, dayBookings)) {
                extraClass += ' booked';
                content += `<div class="admin-booked-icon">&#10004;</div>`;
                content += `<div class="admin-booking-label">Full</div>`;
            } else if (approved.length > 0) {
                const slots = approved
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map(b => `<div class="admin-cal-slot"><span class="admin-cal-slot-time">${b.start}–${b.end}</span><span class="admin-cal-slot-venue">${b.venue || ''}</span></div>`)
                    .join('');
                content += `<div class="admin-cal-slot-list">${slots}</div>`;
            } else if (pending.length > 0) {
                extraClass += ' has-pending';
                content += `<div class="admin-pending-icon">&#9203;</div>`;
            }
        }

        const clickable = dayBookings.length > 0 ? `onclick="handleAdminDayClick('${dateString}')"` : '';
        html += `<div class="admin-day ${extraClass}" ${clickable}>${content}</div>`;
    }

    const nextDays = 42 - (firstDayIdx + lastDate);
    for (let i = 1; i <= nextDays; i++) {
        html += `<div class="admin-day inactive">${i}</div>`;
    }

    adminCalDays.innerHTML = html;
}

function handleAdminDayClick(dateString) {
    const calData     = buildAdminCalendarData();
    const dayBookings = calData[dateString] || [];
    if (dayBookings.length === 0) return;

    const modal    = document.getElementById('adminDayModal');
    const dateDisp = document.getElementById('adminDayModalDate');
    const listEl   = document.getElementById('adminDayBookingsList');

    dateDisp.innerText = dateString;

    listEl.innerHTML = dayBookings
        .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
        .map(b => {
            const statusText = b.status.charAt(0).toUpperCase() + b.status.slice(1);
            return `
                <div class="admin-day-booking-card">
                    <div class="admin-day-booking-info">
                        <span class="status-badge ${b.status}">${statusText}</span>
                        <span class="admin-day-time">${b.start || '?'} – ${b.end || '?'}</span>
                        <span class="admin-day-venue">${b.venue || 'No venue'}</span>
                        <span class="admin-day-type">${b.type || 'N/A'} · ${b.pax || '-'} pax</span>
                    </div>
                    <button class="action-btn btn-view" onclick="closeAdminDayModal(); viewBooking('${b.id}')">View</button>
                </div>`;
        }).join('');

    modal.style.display = 'flex';
}

function closeAdminDayModal() {
    document.getElementById('adminDayModal').style.display = 'none';
}

document.getElementById('adminPrevMonth').addEventListener('click', () => {
    adminCurrentDate.setMonth(adminCurrentDate.getMonth() - 1);
    renderAdminCalendar();
});
document.getElementById('adminNextMonth').addEventListener('click', () => {
    adminCurrentDate.setMonth(adminCurrentDate.getMonth() + 1);
    renderAdminCalendar();
});
window.addEventListener('click', e => {
    if (e.target === document.getElementById('adminDayModal')) closeAdminDayModal();
});

// ==========================================
// ADMIN CREATE BOOKING
// ==========================================
function openAdminBookingModal() {
    document.getElementById('adminBookingModal').style.display = 'flex';
    document.getElementById('adminBookingForm').reset();
    document.getElementById('ab-other-group').style.display = 'none';
}

function closeAdminBookingModal() {
    document.getElementById('adminBookingModal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const abType = document.getElementById('ab-type');
    if (abType) {
        abType.addEventListener('change', () => {
            document.getElementById('ab-other-group').style.display =
                abType.value === 'Other' ? 'block' : 'none';
        });
    }

    const form = document.getElementById('adminBookingForm');
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();

            const dateVal  = document.getElementById('ab-date').value;
            const start    = document.getElementById('ab-start').value;
            const end      = document.getElementById('ab-end').value;
            const typeVal  = document.getElementById('ab-type').value;
            const otherVal = document.getElementById('ab-other-type').value.trim();
            const venueEl  = document.getElementById('ab-venue');
            const venue    = venueEl.value;
            const capacity = venueEl.selectedOptions[0]?.dataset.capacity || null;
            const pax      = document.getElementById('ab-pax').value;
            const desc     = document.getElementById('ab-desc').value.trim();

            if (!dateVal || !start || !end || !typeVal || !venue || !pax) {
                alert('Please fill in all required fields.');
                return;
            }
            if (end <= start) {
                alert('End time must be after start time.');
                return;
            }

            const dateObj    = new Date(dateVal);
            const monthNames = ['January','February','March','April','May','June',
                                'July','August','September','October','November','December'];
            const dateString = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
            const eventType  = typeVal === 'Other' ? (otherVal || 'Other') : typeVal;

            try {
                const { error } = await supabase.from('event_bookings').insert({
                    date:             dateString,
                    start,
                    end,
                    type:             eventType,
                    venue,
                    venue_capacity:   capacity ? Number(capacity) : null,
                    pax:              Number(pax),
                    description:      desc || '',
                    status:           'approved',
                    submitted_at:     new Date().toISOString(),
                    approved_at:      new Date().toISOString()
                });
                if (error) throw error;
                alert('Booking created and approved!');
                closeAdminBookingModal();
                await loadBookings(); renderBookings(); updateStats(); renderAdminCalendar();
            } catch (err) {
                console.error('Failed to create booking:', err);
                alert('Failed to create booking. Please try again.');
            }
        });
    }

    window.addEventListener('click', e => {
        if (e.target === document.getElementById('adminBookingModal')) closeAdminBookingModal();
    });
});

// ==========================================
// EXPOSE TO GLOBAL SCOPE
// ==========================================
window.viewBooking       = viewBooking;
window.approveBooking    = approveBooking;
window.rejectBooking     = rejectBooking;
window.completeBooking   = completeBooking;
window.deleteBooking     = deleteBooking;
window.revertBooking     = revertBooking;
window.closeDetailsModal  = closeDetailsModal;
window.handleAdminDayClick   = handleAdminDayClick;
window.closeAdminDayModal    = closeAdminDayModal;
window.openAdminBookingModal  = openAdminBookingModal;
window.closeAdminBookingModal = closeAdminBookingModal;
window.logout = () => { window.location.href = 'login.html'; };
