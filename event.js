import { supabase } from './supabaseConfig.js';

// ==========================================
// GLOBAL STATE & DOM ELEMENTS
// ==========================================
let currentDate = new Date();
let selectedDate = null;
let bookingsData = {};

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

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadBookings();
    renderCalendar();
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
        alert('Could not load calendar data. Please check your connection.');
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
            } else if (pending.length > 0) {
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
function handleDayClick(dateString) {
    selectedDate = dateString;
    const dateBookings = bookingsData[dateString] || [];

    if (isDayFullyBooked(dateString, dateBookings)) {
        showBookingDetails(dateString);
    } else {
        openBookingForm(dateString);
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

cancelBtn.addEventListener('click', closeBookingModal);
closeDetailsBtn.addEventListener('click', closeDetailsModal);
closePendingBtn.addEventListener('click', closePendingModal);

window.addEventListener('click', e => {
    if (e.target === bookingModal)  closeBookingModal();
    if (e.target === detailsModal)  closeDetailsModal();
    if (e.target === pendingModal)  closePendingModal();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeBookingModal(); closeDetailsModal(); closePendingModal(); }
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

const VENUE_CAPACITIES = { 'Veranda': 100, 'Pool': 50, 'Coffee Shop': 50 };


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

    const startTime = document.getElementById('startTime').value;
    const endTime   = document.getElementById('endTime').value;

    // Time validation
    if (startTime === endTime) {
        alert('End time must be later than start time.');
        return;
    }
    if (startTime >= endTime) {
        alert('End time must be later than start time.');
        return;
    }

    // Operating hours validation
    const bookedDate   = new Date(selectedDate);
    const isWeekendDay = (bookedDate.getDay() === 0 || bookedDate.getDay() === 6);
    const openTime     = isWeekendDay ? '12:00' : '10:00';
    const closeTime    = '20:00';
    if (startTime < openTime) {
        alert(`Operating hours: ${isWeekendDay ? 'Weekends open at 12:00 PM' : 'Weekdays open at 10:00 AM'}.\nPlease choose a start time at or after ${openTime}.`);
        return;
    }
    if (endTime > closeTime) {
        alert('Operating hours end at 8:00 PM.\nPlease choose an end time at or before 8:00 PM.');
        return;
    }

    let finalEventType = eventTypeSelect.value;
    if (finalEventType === 'Other') {
        finalEventType = otherEventTypeInput.value.trim();
        if (!finalEventType) { alert('Please specify the event type!'); return; }
    }

    // Venue capacity validation
    if (!venueSelect.value) {
        alert('Please select a venue.');
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
            alert(`${venue} is already booked from ${taken}.\nPlease choose a different time or venue.`);
            return;
        }
    } catch (error) {
        console.error('Overlap check failed:', error);
    }

    // Submit booking
    try {
        const { error } = await supabase.from('event_bookings').insert({
            date:           selectedDate,
            start:          startTime,
            end:            endTime,
            type:           finalEventType,
            pax:            Number(document.getElementById('pax').value),
            venue:          venue,
            venue_capacity: venueCapacity,
            description:    document.getElementById('description').value,
            status:         'pending',
            submitted_at:   new Date().toISOString()
        });

        if (error) throw error;

        alert(`Booking Request Submitted!\n\nDate: ${selectedDate}\nTime: ${startTime} – ${endTime}\nVenue: ${venue} (${venueCapacity} pax)\n\nYour booking is pending admin approval.`);
        closeBookingModal();
        await loadBookings();
        renderCalendar();
    } catch (error) {
        console.error('Failed to submit booking:', error);
        alert('Failed to submit booking. Please try again.');
    }
});

window.handleDayClick = handleDayClick;
