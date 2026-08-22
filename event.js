import { supabase } from './supabaseConfig.js';
import { initReveal } from './animations.js';
import { requireAuth, initNavAuth, getUser } from './auth.js';
import { showToast } from './toast.js';

// ==========================================
// GLOBAL STATE & DOM ELEMENTS
// ==========================================
let currentDate = new Date();
let selectedDate = null;
let bookingsData = {};
let currentUser  = null;

// ── Reschedule state ──────────────────────────────────────────────────────────
// The existing booking currently being rescheduled (null when not rescheduling),
// the new date picked from the calendar, and a guard against double submission.
let reschedulingBooking = null;
let rescheduleNewDate   = null;
let isReschedulingBusy  = false;

const calendarDays      = document.getElementById('calendarDays');
const monthYearDisplay  = document.getElementById('monthYearDisplay');
const prevMonthBtn      = document.getElementById('prevMonth');
const nextMonthBtn      = document.getElementById('nextMonth');

const bookingModal      = document.getElementById('bookingModal');
const modalDateDisplay  = document.getElementById('modalDateDisplay');
const cancelBtn         = document.getElementById('cancelBtn');
const bookingForm       = document.getElementById('bookingForm');

const detailsModal      = document.getElementById('detailsModal');
const detailsDateDisplay  = document.getElementById('detailsDateDisplay');
const bookingDetailsList  = document.getElementById('bookingDetailsList');
const closeDetailsBtn   = document.getElementById('closeDetailsBtn');

const pendingModal      = document.getElementById('pendingModal');
const pendingDateDisplay  = document.getElementById('pendingDateDisplay');
const pendingBookingDetails = document.getElementById('pendingBookingDetails');
const closePendingBtn   = document.getElementById('closePendingBtn');

const pastEventModal      = document.getElementById('pastEventModal');
const pastEventTitle      = document.getElementById('pastEventTitle');
const pastEventDateDisplay = document.getElementById('pastEventDateDisplay');
const pastEventList       = document.getElementById('pastEventList');
const closePastEventBtn   = document.getElementById('closePastEventBtn');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getUser();
    await loadBookings();
    renderCalendar();
    await loadMyBookings();
    initReveal();
    await initNavAuth();
    addMyBookingsNavButton();   // header button lives beside the profile/log-out
});

// ==========================================
// DATA LOADING
// ==========================================
async function loadBookings() {
    try {
        const { data, error } = await supabase
            .from('event_bookings')
            .select('*')
            .in('status', ['approved', 'pending']);

        if (error) throw error;

        bookingsData = {};
        data.forEach(row => {
            const dateKey = row.date;
            if (!bookingsData[dateKey]) bookingsData[dateKey] = [];
            bookingsData[dateKey].push({
                ...row,
                submittedAt: row.submitted_at ? new Date(row.submitted_at).toLocaleString() : 'Unknown'
            });
        });

        console.log(`Loaded bookings for ${Object.keys(bookingsData).length} dates`);
    } catch (error) {
        console.error('Failed to load bookings:', error);
        showToast('Could not load calendar data. Please check your connection.', 'error');
    }
}

// ==========================================
// BOOKING HELPERS
// ==========================================
function isTimeOverlap(s1, e1, s2, e2) {
    return s1 < e2 && e1 > s2;
}


function isVenueFullyBooked(dateString, bookings, venue) {
    const approved = bookings.filter(b => b.status === 'approved' && b.venue === venue && b.start && b.end);
    if (approved.length === 0) return false;

    const date      = new Date(dateString);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const openTime  = isWeekend ? '12:00' : '10:00';
    const closeTime = '20:00';

    const sorted = approved
        .map(b => ({ start: b.start, end: b.end }))
        .sort((a, b) => a.start.localeCompare(b.start));

    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        if (sorted[i].start <= last.end) {
            if (sorted[i].end > last.end) last.end = sorted[i].end;
        } else {
            merged.push({ ...sorted[i] });
        }
    }

    return merged.length === 1 && merged[0].start <= openTime && merged[0].end >= closeTime;
}

function isDayFullyBooked(dateString, bookings) {
    return ['Veranda', 'Pool', 'Coffee Shop'].every(v => isVenueFullyBooked(dateString, bookings, v));
}

// ==========================================
// CALENDAR RENDERING
// ==========================================
function renderCalendar() {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    monthYearDisplay.innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate      = new Date(year, month + 1, 0).getDate();
    const prevLastDate  = new Date(year, month, 0).getDate();

    let daysHTML = '';

    for (let i = firstDayIndex; i > 0; i--) {
        daysHTML += `<div class="day inactive">${prevLastDate - i + 1}</div>`;
    }

    for (let i = 1; i <= lastDate; i++) {
        const isToday = i === new Date().getDate() &&
                        month === new Date().getMonth() &&
                        year === new Date().getFullYear();
        const todayClass  = isToday ? 'today' : '';
        const dateString  = `${monthNames[month]} ${i}, ${year}`;
        const dateBookings = bookingsData[dateString];

        let bookedClass = '';
        let dayContent  = `<span class="day-number">${i}</span>`;

        if (dateBookings && dateBookings.length > 0) {
            const approved = dateBookings.filter(b => b.status === 'approved');
            const pending  = dateBookings.filter(b => b.status === 'pending');

            if (isDayFullyBooked(dateString, dateBookings)) {
                bookedClass = 'booked';
                dayContent += `<div class="booked-icon">&#10004;</div>`;
                dayContent += `<div class="booking-time">Full</div>`;
            } else if (approved.length > 0) {
                const slots = approved
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map(b => `<div class="cal-slot"><span class="cal-slot-time">${b.start}–${b.end}</span><span class="cal-slot-venue">${b.venue || ''}</span></div>`)
                    .join('');
                dayContent += `<div class="cal-slot-list">${slots}</div>`;
            } else if (pending.length > 0 && currentUser) {
                bookedClass = 'pending';
                dayContent += `<div class="pending-icon">&#9203;</div>`;
                dayContent += `<div class="pending-time">${pending[0].start}</div>`;
            }
        }

        daysHTML += `<div class="day ${todayClass} ${bookedClass}" onclick="handleDayClick('${dateString}')">${dayContent}</div>`;
    }

    const totalCells = firstDayIndex + lastDate;
    const nextDays   = 42 - totalCells;
    for (let i = 1; i <= nextDays; i++) {
        daysHTML += `<div class="day inactive">${i}</div>`;
    }

    calendarDays.innerHTML = daysHTML;
}

prevMonthBtn.addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    await loadBookings();
    renderCalendar();
});

nextMonthBtn.addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    await loadBookings();
    renderCalendar();
});

// ==========================================
// DAY CLICK HANDLER
// ==========================================
// Date-based comparison using the local date (both normalized to local midnight),
// so timezone/UTC differences never make "today" look like a past date.
function isPastDate(dateString) {
    const d = new Date(dateString);   // "August 5, 2026" parses as local midnight
    if (isNaN(d)) return false;
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
}

function statusLabel(s) {
    const map = { approved: 'Approved', completed: 'Completed', pending: 'Pending' };
    return map[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown');
}

async function handleDayClick(dateString) {
    const user = await requireAuth();
    if (!user) return;

    // Reschedule mode: the calendar is being used to pick a NEW date for an
    // existing booking. Past dates keep their read-only history behavior but
    // can NOT be chosen as the new event date.
    if (reschedulingBooking) {
        if (isPastDate(dateString)) {
            showToast('Past dates cannot be selected for rescheduling. Please select a current or future event date.', 'error', 5000);
            showPastEvent(dateString);
            return;
        }
        openRescheduleForm(dateString);
        return;
    }

    selectedDate = dateString;

    // Past dates stay clickable/selectable, but open the read-only history modal
    // instead of the new-booking flow.
    if (isPastDate(dateString)) {
        showPastEvent(dateString);
        return;
    }

    const dateBookings = bookingsData[dateString] || [];

    if (isDayFullyBooked(dateString, dateBookings)) {
        showBookingDetails(dateString);
    } else {
        openBookingForm(dateString);
    }
}

// Read-only "Event History" modal for past dates. Fetches the existing bookings
// for that date (any real status) and displays them; shows a friendly empty
// message when none exist. Never creates or modifies bookings.
async function showPastEvent(dateString) {
    pastEventTitle.innerText     = 'Event History';
    pastEventDateDisplay.innerText = dateString;
    pastEventList.innerHTML = '<p class="no-bookings">Loading…</p>';
    pastEventModal.classList.add('active');
    pastEventModal.style.display = 'flex';

    try {
        const { data, error } = await supabase
            .from('event_bookings')
            .select('*')
            .eq('date', dateString)
            .in('status', ['approved', 'completed', 'pending']);
        if (error) throw error;

        const events = (data || []).sort((a, b) => (a.start || '').localeCompare(b.start || ''));

        if (events.length === 0) {
            pastEventTitle.innerText = 'No Event Recorded';
            pastEventList.innerHTML = '<div class="pending-info"><p>No event was recorded for this date.</p></div>';
            return;
        }

        pastEventList.innerHTML = events.map((b, i) => `
            <div class="booking-card ${b.status}">
                <h3>Event #${i + 1}: ${b.type || 'Event'} <span class="status-badge ${b.status}">${statusLabel(b.status)}</span></h3>
                <p><strong>Event Date:</strong> ${dateString}</p>
                <p><strong>Time:</strong> ${b.start || '—'} – ${b.end || '—'}</p>
                <p><strong>Venue:</strong> ${b.venue || '—'}</p>
                <p><strong>Capacity:</strong> ${b.venue_capacity ? b.venue_capacity + ' pax' : '—'}</p>
                <p><strong>Number of Pax:</strong> ${b.pax || '—'}</p>
                <p><strong>Status:</strong> ${statusLabel(b.status)}</p>
                <p><strong>Description:</strong> ${b.description || 'No description'}</p>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load past events:', err);
        pastEventList.innerHTML = '<div class="pending-info"><p>Could not load event history. Please try again.</p></div>';
    }
}

// ==========================================
// MODAL FUNCTIONS
// ==========================================
function openBookingForm(dateString) {
    modalDateDisplay.innerText = `Date: ${dateString}`;

    // Show existing taken slots
    const dateBookings = bookingsData[dateString] || [];
    const taken        = dateBookings.filter(b => b.status === 'approved' || b.status === 'pending');
    const slotsInfo    = document.getElementById('bookedSlotsInfo');
    const slotsList    = document.getElementById('bookedSlotsList');

    if (taken.length > 0) {
        slotsList.innerHTML = taken
            .sort((a, b) => a.start.localeCompare(b.start))
            .map(b => `<span class="booked-slot-tag ${b.status}">${b.start} – ${b.end}${b.venue ? ' · ' + b.venue : ''}</span>`)
            .join('');
        slotsInfo.style.display = 'block';
    } else {
        slotsInfo.style.display = 'none';
    }

    // Disable venues whose entire operating hours are already taken
    const fullyBookedVenues = new Set(
        ['Veranda', 'Pool', 'Coffee Shop'].filter(v => isVenueFullyBooked(dateString, dateBookings, v))
    );
    updateVenueOptions(fullyBookedVenues);

    const date      = new Date(dateString);
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    const startMin  = isWeekend ? '12:00' : '10:00';

    const startInput = document.getElementById('startTime');
    const endInput   = document.getElementById('endTime');
    startInput.min = startMin;
    startInput.max = '20:00';
    endInput.min   = startMin;
    endInput.max   = '20:00';

    // A freshly opened booking form has no venue selected yet, so show the
    // generic deposit notice until the user picks a venue.
    venueSelect.value = '';
    hideVenueError();
    document.getElementById('venueMaxPaxInfo').style.display = 'none';
    updateDepositDisclaimer();

    bookingModal.classList.add('active');
    bookingModal.style.display = 'flex';
}

function showBookingDetails(dateString) {
    detailsDateDisplay.innerText = `Date: ${dateString}`;
    const approved = bookingsData[dateString].filter(b => b.status === 'approved');
    bookingDetailsList.innerHTML = approved.map((b, i) => `
        <div class="booking-card approved">
            <h3>Event #${i + 1}: ${b.type} <span class="status-badge approved">Reserved</span></h3>
            <p><strong>Time:</strong> ${b.start} – ${b.end}</p>
            <p><strong>Venue:</strong> ${b.venue || '—'}</p>
            <p><strong>Capacity:</strong> ${b.venue_capacity ? b.venue_capacity + ' pax' : '—'}</p>
            <p><strong>Number of Pax:</strong> ${b.pax}</p>
            <p><strong>Description:</strong> ${b.description || 'No description'}</p>
        </div>
    `).join('') || '<p class="no-bookings">No approved bookings for this date</p>';
    detailsModal.classList.add('active');
    detailsModal.style.display = 'flex';
}

function showPendingDetails(dateString) {
    pendingDateDisplay.innerText = `Date: ${dateString}`;
    const pending = bookingsData[dateString].filter(b => b.status === 'pending');
    pendingBookingDetails.innerHTML = pending.map((b, i) => `
        <div class="booking-card pending">
            <h3>Event #${i + 1}: ${b.type} <span class="status-badge pending">Pending</span></h3>
            <p><strong>Time:</strong> ${b.start} – ${b.end}</p>
            <p><strong>Venue:</strong> ${b.venue || '—'}</p>
            <p><strong>Capacity:</strong> ${b.venue_capacity ? b.venue_capacity + ' pax' : '—'}</p>
            <p><strong>Number of Pax:</strong> ${b.pax}</p>
            <p><strong>Description:</strong> ${b.description || 'No description'}</p>
            <p><strong>Submitted:</strong> ${b.submittedAt}</p>
        </div>
    `).join('');
    pendingModal.classList.add('active');
    pendingModal.style.display = 'flex';
}

function closeBookingModal() {
    bookingModal.classList.remove('active');
    bookingModal.style.display = 'none';
    bookingForm.reset();
}
function closeDetailsModal() {
    detailsModal.classList.remove('active');
    detailsModal.style.display = 'none';
}
function closePendingModal() {
    pendingModal.classList.remove('active');
    pendingModal.style.display = 'none';
}
function closePastEventModal() {
    pastEventModal.classList.remove('active');
    pastEventModal.style.display = 'none';
}

cancelBtn.addEventListener('click', closeBookingModal);
document.getElementById('closeBookingBtn').addEventListener('click', closeBookingModal);
closeDetailsBtn.addEventListener('click', closeDetailsModal);
closePendingBtn.addEventListener('click', closePendingModal);
closePastEventBtn.addEventListener('click', closePastEventModal);

window.addEventListener('click', e => {
    if (e.target === bookingModal)   closeBookingModal();
    if (e.target === detailsModal)   closeDetailsModal();
    if (e.target === pendingModal)   closePendingModal();
    if (e.target === pastEventModal) closePastEventModal();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeBookingModal(); closeDetailsModal(); closePendingModal(); closePastEventModal(); }
});

// ==========================================
// OTHER EVENT TYPE TOGGLE
// ==========================================
const eventTypeSelect      = document.getElementById('eventType');
const otherEventTypeGroup  = document.getElementById('otherEventTypeGroup');
const otherEventTypeInput  = document.getElementById('otherEventType');

eventTypeSelect.addEventListener('change', () => {
    const isOther = eventTypeSelect.value === 'Other';
    otherEventTypeGroup.style.display = isOther ? 'block' : 'none';
    otherEventTypeInput.required = isOther;
    if (!isOther) otherEventTypeInput.value = '';
});

// ==========================================
// VENUE CAPACITY VALIDATION
// ==========================================
const venueSelect       = document.getElementById('venue');
const paxInput          = document.getElementById('pax');
const venueCapacityMsg  = document.getElementById('venueCapacityMsg');

const VENUE_CAPACITIES = { 'Veranda - 100 pax': 100, 'Pool - 50 pax': 50, 'Coffee Shop - 50 pax': 50 };

// Single source of truth for venue pricing. The required deposit is always
// derived as VENUE_FEE × DEPOSIT_RATE, so it stays correct if fees change.
const VENUE_FEES = { 'Veranda - 100 pax': 2400, 'Coffee Shop - 50 pax': 2000, 'Pool - 50 pax': 2000 };
const DEPOSIT_RATE = 0.5;

const peso = n => '₱' + Number(n).toLocaleString('en-PH');

// Updates the deposit disclaimer to reflect the currently selected venue.
function updateDepositDisclaimer() {
    const el = document.getElementById('depositDisclaimer');
    if (!el) return;
    const fee = VENUE_FEES[venueSelect.value];
    if (!fee) {
        el.innerHTML = '&#9888; A 50% deposit of the selected venue fee is required. '
                     + 'Please pay at the caf&eacute; to secure and approve your booking.';
        return;
    }
    const deposit = fee * DEPOSIT_RATE;
    el.innerHTML = `&#9888; 50% deposit required: ${peso(deposit)} of the ${peso(fee)} venue fee. `
                 + 'Please pay at the caf&eacute; to secure and approve your booking.';
}


function updateVenueOptions(unavailable = new Set()) {
    const current = venueSelect.value;
    venueSelect.innerHTML =
        '<option value="" disabled>Select Venue</option>' +
        Object.entries(VENUE_CAPACITIES).map(([name, cap]) => {
            const booked = unavailable.has(name);
            return `<option value="${name}" data-capacity="${cap}"${booked ? ' disabled' : ''}>${name}${booked ? ' (Booked)' : ''}</option>`;
        }).join('');

    if (current && !unavailable.has(current)) {
        venueSelect.value = current;
    } else {
        venueSelect.value = '';
        hideVenueError();
    }
    updateDepositDisclaimer();
}

function validateVenueCapacity() {
    const venue    = venueSelect.value;
    const pax      = parseInt(paxInput.value);
    if (!venue || !pax || pax <= 0) { hideVenueError(); return true; }
    const capacity = VENUE_CAPACITIES[venue];
    if (pax > capacity) {
        showVenueError(`Selected venue only accommodates up to ${capacity} pax.`);
        return false;
    }
    hideVenueError();
    return true;
}

function showVenueError(msg) {
    venueCapacityMsg.textContent     = msg;
    venueCapacityMsg.style.display   = 'block';
    paxInput.style.borderColor       = '#e74c3c';
    venueSelect.style.borderColor    = '#e74c3c';
}

function hideVenueError() {
    venueCapacityMsg.style.display   = 'none';
    paxInput.style.borderColor       = '';
    venueSelect.style.borderColor    = '';
}

venueSelect.addEventListener('change', () => {
    validateVenueCapacity();
    updateDepositDisclaimer();
    const info = document.getElementById('venueMaxPaxInfo');
    if (venueSelect.value) {
        info.textContent = `This venue can accommodate up to ${VENUE_CAPACITIES[venueSelect.value]} pax.`;
        info.style.display = 'block';
    } else {
        info.style.display = 'none';
    }
});
paxInput.addEventListener('input',  validateVenueCapacity);

function getUnavailableVenues(dateString, startTime, endTime) {
    const dateBookings = bookingsData[dateString] || [];
    const taken        = new Set();
    dateBookings
        .filter(b => b.status === 'approved' && b.venue && b.start && b.end)
        .forEach(b => { if (isTimeOverlap(startTime, endTime, b.start, b.end)) taken.add(b.venue); });
    return taken;
}

function refreshVenueAvailability() {
    const start        = document.getElementById('startTime').value;
    const end          = document.getElementById('endTime').value;
    const dateBookings = bookingsData[selectedDate] || [];

    // Always start with venues that are fully booked for the whole day
    const unavailable = new Set(
        ['Veranda', 'Pool', 'Coffee Shop'].filter(v => isVenueFullyBooked(selectedDate, dateBookings, v))
    );

    // Also disable venues that conflict with the chosen time range
    if (start && end && start < end) {
        getUnavailableVenues(selectedDate, start, end).forEach(v => unavailable.add(v));
    }

    updateVenueOptions(unavailable);
}
document.getElementById('startTime').addEventListener('change', refreshVenueAvailability);
document.getElementById('endTime').addEventListener('change',   refreshVenueAvailability);

// ==========================================
// FORM SUBMISSION
// ==========================================
bookingForm.addEventListener('submit', async e => {
    e.preventDefault();

    // Safety check: never allow creating a NEW booking on a past date, even if
    // the form was somehow opened for one.
    if (isPastDate(selectedDate)) {
        showToast('Past dates cannot be booked. Please select a current or future event date.', 'error', 5000);
        return;
    }

    const startTime = document.getElementById('startTime').value;
    const endTime   = document.getElementById('endTime').value;

    // Time validation
    if (startTime === endTime || startTime >= endTime) {
        showToast('End time must be later than start time.', 'warning');
        return;
    }

    // Operating hours validation
    const bookedDate   = new Date(selectedDate);
    const isWeekendDay = (bookedDate.getDay() === 0 || bookedDate.getDay() === 6);
    const openTime     = isWeekendDay ? '12:00' : '10:00';
    const closeTime    = '20:00';
    if (startTime < openTime) {
        showToast(`Opens at ${isWeekendDay ? '12:00 PM (weekends)' : '10:00 AM (weekdays)'}. Please pick a later start time.`, 'warning');
        return;
    }
    if (endTime > closeTime) {
        showToast('Operating hours end at 8:00 PM. Please choose an earlier end time.', 'warning');
        return;
    }

    let finalEventType = eventTypeSelect.value;
    if (finalEventType === 'Other') {
        finalEventType = otherEventTypeInput.value.trim();
        if (!finalEventType) { showToast('Please specify the event type.', 'warning'); return; }
    }

    // Venue capacity validation
    if (!venueSelect.value) {
        showToast('Please select a venue.', 'warning');
        venueSelect.focus();
        return;
    }
    if (!validateVenueCapacity()) return;

    const venue         = venueSelect.value;
    const venueCapacity = VENUE_CAPACITIES[venue];

    // Overlap check — same venue + overlapping time is a conflict
    try {
        const { data: existing, error } = await supabase
            .from('event_bookings')
            .select('start, end, venue')
            .eq('date', selectedDate)
            .eq('venue', venue)
            .in('status', ['approved', 'pending']);

        if (error) throw error;

        const overlapping = existing.filter(b => isTimeOverlap(startTime, endTime, b.start, b.end));
        if (overlapping.length > 0) {
            const taken = overlapping.map(b => `${b.start} – ${b.end}`).join(', ');
            showToast(`${venue} is already booked (${taken}). Please choose a different time or venue.`, 'error', 4500);
            return;
        }
    } catch (error) {
        console.error('Overlap check failed:', error);
    }

    // Submit booking
    try {
        const user = await getUser();

        // FINAL past-date guard — immediately before the insert, validating the
        // exact date value that is about to be written to the database.
        if (isPastDate(selectedDate)) {
            showToast('Past dates cannot be booked. Please select a current or future event date.', 'error', 5000);
            return;
        }

        const { error } = await supabase.from('event_bookings').insert({
            date:           selectedDate,
            start:          startTime,
            end:            endTime,
            type:           finalEventType,
            pax:            Number(document.getElementById('pax').value),
            venue:          venue,
            venue_capacity: venueCapacity,
            description:    document.getElementById('description').value,
            customer_email: user?.email || '',
            status:         'pending',
            submitted_at:   new Date().toISOString()
        });

        if (error) throw error;

        closeBookingModal();
        showToast(`Booking submitted for ${selectedDate}, ${startTime}–${endTime} at ${venue}. Pending admin approval.`, 'success', 5000);
        await loadBookings();
        renderCalendar();
        await loadMyBookings();
    } catch (error) {
        console.error('Failed to submit booking:', error);
        showToast('Failed to submit booking. Please try again.', 'error');
    }
});

// ==========================================
// MY BOOKINGS  +  RESCHEDULING
// ==========================================
const myBookingsModal    = document.getElementById('myBookingsModal');
const myBookingsList      = document.getElementById('myBookingsList');
const noMyBookings        = document.getElementById('noMyBookings');

const rescheduleBanner       = document.getElementById('rescheduleBanner');
const rescheduleBannerText   = document.getElementById('rescheduleBannerText');
const rescheduleModal        = document.getElementById('rescheduleModal');
const rescheduleForm         = document.getElementById('rescheduleForm');
const rescheduleCurrent      = document.getElementById('rescheduleCurrent');
const rescheduleNewDateDisplay = document.getElementById('rescheduleNewDateDisplay');
const rescheduleStart        = document.getElementById('rescheduleStart');
const rescheduleEnd          = document.getElementById('rescheduleEnd');
const rescheduleVenue        = document.getElementById('rescheduleVenue');
const rescheduleVenueInfo    = document.getElementById('rescheduleVenueInfo');
const rescheduleVenueError   = document.getElementById('rescheduleVenueError');
const rescheduleConfirmModal = document.getElementById('rescheduleConfirmModal');
const rescheduleConfirmBody  = document.getElementById('rescheduleConfirmBody');
const confirmRescheduleBtn   = document.getElementById('confirmRescheduleBtn');

// The logged-in user's own bookings (all statuses, for display + eligibility).
let myBookings = [];

function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// A booking is reschedulable only when it belongs to this user, is still active
// (pending/approved — not rejected/cancelled or completed), and its event date
// has not already passed.
function canReschedule(b) {
    if (!currentUser || !b) return false;
    if (b.customer_email !== currentUser.email) return false;
    if (b.status !== 'pending' && b.status !== 'approved') return false;
    if (!b.date || isPastDate(b.date)) return false;
    return true;
}

// ── LOAD + RENDER MY BOOKINGS ────────────────────────────────────────────────
async function loadMyBookings() {
    if (!currentUser) {
        myBookings = [];
        renderMyBookings();
        return;
    }
    try {
        const { data, error } = await supabase
            .from('event_bookings')
            .select('*')
            .eq('customer_email', currentUser.email);
        if (error) throw error;
        myBookings = data || [];
    } catch (err) {
        console.error('Failed to load your bookings:', err);
        myBookings = [];
    }
    renderMyBookings();
}

function renderMyBookings() {
    // Upcoming/active first (by soonest date), then the rest.
    const sorted = [...myBookings].sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0;
        const tb = b.date ? new Date(b.date).getTime() : 0;
        return tb - ta;
    });

    if (sorted.length === 0) {
        myBookingsList.innerHTML = '';
        noMyBookings.style.display = 'block';
        return;
    }
    noMyBookings.style.display = 'none';

    myBookingsList.innerHTML = sorted.map(b => {
        const eligible = canReschedule(b);
        return `
        <div class="booking-card ${escHtml(b.status)}">
            <h3>${escHtml(b.type || 'Event')} <span class="status-badge ${escHtml(b.status)}">${statusLabel(b.status)}</span></h3>
            <p><strong>Date:</strong> ${escHtml(b.date || '—')}</p>
            <p><strong>Time:</strong> ${escHtml(b.start || '—')} – ${escHtml(b.end || '—')}</p>
            <p><strong>Venue:</strong> ${escHtml(b.venue || '—')}</p>
            <p><strong>Number of Pax:</strong> ${escHtml(b.pax || '—')}</p>
            ${eligible ? `<div class="my-booking-actions">
                <button class="btn-reschedule" onclick="startReschedule('${escHtml(b.id)}')">Reschedule</button>
            </div>` : ''}
        </div>`;
    }).join('');
}

// ── OPEN / CLOSE MY BOOKINGS MODAL ───────────────────────────────────────────
async function openMyBookingsModal() {
    // Always refresh from the existing retrieval logic so the list is current.
    await loadMyBookings();
    myBookingsModal.classList.add('active');
    myBookingsModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';   // lock background scroll
}

function closeMyBookingsModal() {
    myBookingsModal.classList.remove('active');
    myBookingsModal.style.display = 'none';
    document.body.style.overflow = '';
}

// Adds a "My Bookings" button to the header, between the profile circle and the
// Log-out link (both injected by initNavAuth for signed-in users). Guests, who
// only see a "Log-in" link, don't get the button.
function addMyBookingsNavButton() {
    const logoutAnchor = document.getElementById('nav-logout');
    if (!logoutAnchor) return;
    if (document.getElementById('nav-my-bookings')) return;

    const logoutLi = logoutAnchor.closest('li');   // the <li>, not the <a>
    const li = document.createElement('li');
    li.innerHTML = '<a href="#" id="nav-my-bookings" class="btn-account">My Bookings</a>';
    logoutLi.parentNode.insertBefore(li, logoutLi);
    document.getElementById('nav-my-bookings').addEventListener('click', e => {
        e.preventDefault();
        openMyBookingsModal();
    });
}

// ── ENTER / EXIT RESCHEDULE MODE ─────────────────────────────────────────────
function startReschedule(bookingId) {
    const booking = myBookings.find(b => String(b.id) === String(bookingId));
    // Re-verify eligibility (ownership + status + not past) before entering mode.
    if (!booking || !canReschedule(booking)) {
        showToast('This booking can no longer be rescheduled.', 'error');
        return;
    }

    // Close the My Bookings modal so the reschedule banner and calendar (used to
    // pick the new date) are visible — avoids confusing stacked overlays.
    closeMyBookingsModal();

    reschedulingBooking = booking;
    rescheduleNewDate   = null;

    rescheduleBannerText.innerHTML =
        `<strong>Rescheduling:</strong> ${escHtml(booking.type || 'Event')} — currently ` +
        `${escHtml(booking.date)}, ${escHtml(booking.start)}–${escHtml(booking.end)} at ${escHtml(booking.venue)}. ` +
        `Click a new date on the calendar below.`;
    rescheduleBanner.style.display = 'flex';

    showToast('Select a new date on the calendar for your rescheduled event.', 'info', 4000);
    document.querySelector('.calendar-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function exitRescheduleMode() {
    reschedulingBooking = null;
    rescheduleNewDate   = null;
    rescheduleBanner.style.display = 'none';
}

// ── OPEN RESCHEDULE FORM (after a valid new date is picked) ───────────────────
function openRescheduleForm(dateString) {
    const b = reschedulingBooking;
    if (!b) return;

    rescheduleNewDate = dateString;

    rescheduleCurrent.innerHTML = `
        <h4>Current Booking</h4>
        <p><strong>Event:</strong> ${escHtml(b.type || 'Event')}</p>
        <p><strong>Date:</strong> ${escHtml(b.date)}</p>
        <p><strong>Time:</strong> ${escHtml(b.start)} – ${escHtml(b.end)}</p>
        <p><strong>Venue:</strong> ${escHtml(b.venue)}</p>
        <p><strong>Number of Pax:</strong> ${escHtml(b.pax)}</p>`;

    rescheduleNewDateDisplay.innerText = `New Date: ${dateString}`;

    // Prefill new time with the current time as a sensible default.
    rescheduleStart.value = b.start || '';
    rescheduleEnd.value   = b.end || '';

    const date      = new Date(dateString);
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    const startMin  = isWeekend ? '12:00' : '10:00';
    rescheduleStart.min = startMin; rescheduleStart.max = '20:00';
    rescheduleEnd.min   = startMin; rescheduleEnd.max   = '20:00';

    hideRescheduleVenueError();
    // On first open, default the venue to the booking's current venue (ignore any
    // stale value left in the select from a previous reschedule).
    refreshRescheduleVenues(b.venue);

    rescheduleModal.classList.add('active');
    rescheduleModal.style.display = 'flex';
}

// ── RESCHEDULE AVAILABILITY (UI) ─────────────────────────────────────────────
// Same approach as the new-booking calendar, but the booking being rescheduled
// is excluded so it never conflicts with itself.
function computeRescheduleUnavailable(dateString, start, end, excludeId) {
    const dayBookings = (bookingsData[dateString] || []).filter(b => String(b.id) !== String(excludeId));
    const unavailable = new Set(
        ['Veranda', 'Pool', 'Coffee Shop'].filter(v => isVenueFullyBooked(dateString, dayBookings, v))
    );
    if (start && end && start < end) {
        dayBookings
            .filter(b => b.status === 'approved' && b.venue && b.start && b.end)
            .forEach(b => { if (isTimeOverlap(start, end, b.start, b.end)) unavailable.add(b.venue); });
    }
    return unavailable;
}

function refreshRescheduleVenues(preferred) {
    const b = reschedulingBooking;
    if (!b) return;
    const start = rescheduleStart.value;
    const end   = rescheduleEnd.value;

    // Existing taken slots on the new date (excluding this booking).
    const otherBookings = (bookingsData[rescheduleNewDate] || [])
        .filter(x => String(x.id) !== String(b.id) && (x.status === 'approved' || x.status === 'pending'));
    const slotsInfo = document.getElementById('rescheduleBookedSlotsInfo');
    const slotsList = document.getElementById('rescheduleBookedSlotsList');
    if (otherBookings.length > 0) {
        slotsList.innerHTML = otherBookings
            .sort((x, y) => (x.start || '').localeCompare(y.start || ''))
            .map(x => `<span class="booked-slot-tag ${x.status}">${escHtml(x.start)} – ${escHtml(x.end)}${x.venue ? ' · ' + escHtml(x.venue) : ''}</span>`)
            .join('');
        slotsInfo.style.display = 'block';
    } else {
        slotsInfo.style.display = 'none';
    }

    const unavailable = computeRescheduleUnavailable(rescheduleNewDate, start, end, b.id);
    // `preferred` (the booking's venue) wins on first open; otherwise keep the
    // user's current selection across time-driven refreshes.
    const current = preferred !== undefined ? preferred : (rescheduleVenue.value || b.venue);

    rescheduleVenue.innerHTML =
        '<option value="" disabled>Select Venue</option>' +
        Object.entries(VENUE_CAPACITIES).map(([name, cap]) => {
            const booked = unavailable.has(name);
            return `<option value="${name}" data-capacity="${cap}"${booked ? ' disabled' : ''}>${name}${booked ? ' (Booked)' : ''}</option>`;
        }).join('');

    if (current && VENUE_CAPACITIES[current] && !unavailable.has(current)) {
        rescheduleVenue.value = current;
    } else {
        rescheduleVenue.value = '';
    }
    updateRescheduleVenueInfo();
}

function updateRescheduleVenueInfo() {
    if (rescheduleVenue.value) {
        rescheduleVenueInfo.textContent = `This venue can accommodate up to ${VENUE_CAPACITIES[rescheduleVenue.value]} pax.`;
        rescheduleVenueInfo.style.display = 'block';
    } else {
        rescheduleVenueInfo.style.display = 'none';
    }
}

function showRescheduleVenueError(msg) {
    rescheduleVenueError.textContent   = msg;
    rescheduleVenueError.style.display = 'block';
    rescheduleVenue.style.borderColor  = '#e74c3c';
}
function hideRescheduleVenueError() {
    rescheduleVenueError.style.display = 'none';
    rescheduleVenue.style.borderColor  = '';
}

// Wrap so the change Event is not passed as the `preferred` argument.
rescheduleStart.addEventListener('change', () => refreshRescheduleVenues());
rescheduleEnd.addEventListener('change',   () => refreshRescheduleVenues());
rescheduleVenue.addEventListener('change', () => { hideRescheduleVenueError(); updateRescheduleVenueInfo(); });

// ── RESCHEDULE VALIDATION ────────────────────────────────────────────────────
// Synchronous rules. Returns an error string, or null when valid.
function validateRescheduleSync(newDate, start, end, venue) {
    const b = reschedulingBooking;
    if (!b) return 'No booking selected for rescheduling.';

    // Independent past-date guard against the exact date being saved.
    if (isPastDate(newDate)) {
        return 'Past dates cannot be selected for rescheduling. Please select a current or future event date.';
    }
    if (!start || !end) return 'Please choose a start and end time.';
    if (start >= end)   return 'End time must be later than start time.';

    const date      = new Date(newDate);
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    const openTime  = isWeekend ? '12:00' : '10:00';
    if (start < openTime) return `Opens at ${isWeekend ? '12:00 PM (weekends)' : '10:00 AM (weekdays)'}. Please pick a later start time.`;
    if (end > '20:00')    return 'Operating hours end at 8:00 PM. Please choose an earlier end time.';

    if (!venue) return 'Please select a venue.';
    const capacity = VENUE_CAPACITIES[venue];
    if (capacity && Number(b.pax) > capacity) {
        return `Selected venue only accommodates up to ${capacity} pax (your booking is for ${b.pax}).`;
    }

    // Same-schedule guard — nothing to change.
    if (newDate === b.date && start === b.start && end === b.end && venue === b.venue) {
        return 'same-schedule';
    }
    return null;
}

// Final availability check against the live database, excluding this booking.
async function checkRescheduleAvailabilityDB(newDate, start, end, venue, excludeId) {
    try {
        const { data, error } = await supabase
            .from('event_bookings')
            .select('id, start, end, venue, status')
            .eq('date', newDate)
            .eq('venue', venue)
            .in('status', ['approved', 'pending']);
        if (error) throw error;

        const conflicts = (data || []).filter(x =>
            String(x.id) !== String(excludeId) && isTimeOverlap(start, end, x.start, x.end));
        if (conflicts.length > 0) {
            const taken = conflicts.map(x => `${x.start} – ${x.end}`).join(', ');
            return { available: false, message: `The selected schedule is no longer available. ${venue} is booked (${taken}) on ${newDate}. Please choose another date, time, or venue.` };
        }
        return { available: true };
    } catch (err) {
        console.error('Reschedule availability check failed:', err);
        // Mirror the new-booking flow: don't hard-block on a check error.
        return { available: true };
    }
}

// ── STEP 1: user confirms the new schedule in the form ───────────────────────
rescheduleForm.addEventListener('submit', async e => {
    e.preventDefault();
    const b = reschedulingBooking;
    if (!b) return;

    const newDate = rescheduleNewDate;
    const start   = rescheduleStart.value;
    const end     = rescheduleEnd.value;
    const venue   = rescheduleVenue.value;

    const err = validateRescheduleSync(newDate, start, end, venue);
    if (err === 'same-schedule') {
        showToast('You are already scheduled for this date and time.', 'warning', 4000);
        return;
    }
    if (err) {
        if (/venue/i.test(err)) showRescheduleVenueError(err);
        showToast(err, 'warning', 4500);
        return;
    }

    const avail = await checkRescheduleAvailabilityDB(newDate, start, end, venue, b.id);
    if (!avail.available) {
        showToast(avail.message, 'error', 5000);
        refreshRescheduleVenues();
        return;
    }

    showRescheduleConfirm(newDate, start, end, venue);
});

// ── STEP 2: Current vs New confirmation modal ────────────────────────────────
function showRescheduleConfirm(newDate, start, end, venue) {
    const b = reschedulingBooking;
    rescheduleConfirmBody.innerHTML = `
        <div class="schedule-compare current">
            <h4>Current Schedule</h4>
            <p>${escHtml(b.date)}</p>
            <p>${escHtml(b.start)} – ${escHtml(b.end)}</p>
            <p>${escHtml(b.venue)}</p>
        </div>
        <div class="schedule-compare new">
            <h4>New Schedule</h4>
            <p>${escHtml(newDate)}</p>
            <p>${escHtml(start)} – ${escHtml(end)}</p>
            <p>${escHtml(venue)}</p>
        </div>`;
    rescheduleConfirmModal.classList.add('active');
    rescheduleConfirmModal.style.display = 'flex';
}

// ── STEP 3: commit the reschedule to the database ────────────────────────────
async function doReschedule() {
    if (isReschedulingBusy) return;      // guard against rapid double-clicks
    const b = reschedulingBooking;
    if (!b) return;

    const newDate = rescheduleNewDate;
    const start   = rescheduleStart.value;
    const end     = rescheduleEnd.value;
    const venue   = rescheduleVenue.value;

    // Re-validate immediately before the update (independent of the calendar UI).
    const err = validateRescheduleSync(newDate, start, end, venue);
    if (err && err !== 'same-schedule') {
        showToast(err, 'error', 5000);
        return;
    }
    if (err === 'same-schedule') {
        showToast('You are already scheduled for this date and time.', 'warning', 4000);
        return;
    }

    isReschedulingBusy = true;
    confirmRescheduleBtn.disabled = true;
    const originalLabel = confirmRescheduleBtn.textContent;
    confirmRescheduleBtn.textContent = 'Rescheduling…';

    try {
        // Final availability re-check (race condition), excluding this booking.
        const avail = await checkRescheduleAvailabilityDB(newDate, start, end, venue, b.id);
        if (!avail.available) {
            showToast(avail.message, 'error', 5000);
            return;
        }

        // Update ONLY the schedule fields. The .eq('customer_email') clause plus
        // .select() ensures we only ever update THIS user's own booking and can
        // detect when nothing was updated (wrong owner / already gone).
        const { data, error } = await supabase
            .from('event_bookings')
            .update({
                date:           newDate,
                start:          start,
                end:            end,
                venue:          venue,
                venue_capacity: VENUE_CAPACITIES[venue] ?? b.venue_capacity ?? null
            })
            .eq('id', b.id)
            .eq('customer_email', currentUser.email)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            showToast('Unable to reschedule your event. Please try again.', 'error', 5000);
            return;
        }

        closeRescheduleConfirmModal();
        closeRescheduleModal();
        exitRescheduleMode();
        showToast('Your event has been successfully rescheduled.', 'success', 5000);

        await loadBookings();
        renderCalendar();
        // Reopen My Bookings with the refreshed data so the user sees the update.
        await openMyBookingsModal();
    } catch (err2) {
        console.error('Failed to reschedule:', err2);
        showToast('Unable to reschedule your event. Please try again.', 'error', 5000);
    } finally {
        isReschedulingBusy = false;
        confirmRescheduleBtn.disabled = false;
        confirmRescheduleBtn.textContent = originalLabel;
    }
}

// ── RESCHEDULE MODAL CONTROLS ────────────────────────────────────────────────
function closeRescheduleModal() {
    rescheduleModal.classList.remove('active');
    rescheduleModal.style.display = 'none';
    rescheduleForm.reset();
    hideRescheduleVenueError();
}
function closeRescheduleConfirmModal() {
    rescheduleConfirmModal.classList.remove('active');
    rescheduleConfirmModal.style.display = 'none';
}

document.getElementById('closeRescheduleBtn').addEventListener('click', closeRescheduleModal);
document.getElementById('cancelRescheduleBtn').addEventListener('click', closeRescheduleModal);
document.getElementById('cancelRescheduleConfirmBtn').addEventListener('click', closeRescheduleConfirmModal);
document.getElementById('cancelRescheduleModeBtn').addEventListener('click', () => {
    exitRescheduleMode();
    showToast('Rescheduling cancelled. Your booking is unchanged.', 'info', 3500);
    openMyBookingsModal();   // return to My Bookings after cancelling
});
confirmRescheduleBtn.addEventListener('click', doReschedule);

// My Bookings modal: close via ×, backdrop click, or ESC.
document.getElementById('closeMyBookingsBtn').addEventListener('click', closeMyBookingsModal);

window.addEventListener('click', e => {
    if (e.target === rescheduleModal)        closeRescheduleModal();
    if (e.target === rescheduleConfirmModal) closeRescheduleConfirmModal();
    if (e.target === myBookingsModal)        closeMyBookingsModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeRescheduleModal(); closeRescheduleConfirmModal(); closeMyBookingsModal(); }
});

window.startReschedule = startReschedule;
window.handleDayClick = handleDayClick;
window.toggleMenu = () => { document.getElementById('nav-list').classList.toggle('active'); };
