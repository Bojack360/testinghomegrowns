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

            if (approved.length > 0) {
                bookedClass = 'booked';
                dayContent += `<div class="booked-icon">&#10004;</div>`;
                dayContent += `<div class="booking-time">${approved[0].start}</div>`;
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
    if (bookingsData[dateString] && bookingsData[dateString].length > 0) {
        const approved = bookingsData[dateString].filter(b => b.status === 'approved');
        const pending  = bookingsData[dateString].filter(b => b.status === 'pending');
        if (approved.length > 0)     showBookingDetails(dateString);
        else if (pending.length > 0) showPendingDetails(dateString);
    } else {
        openBookingForm(dateString);
    }
}

// ==========================================
// MODAL FUNCTIONS
// ==========================================
function openBookingForm(dateString) {
    modalDateDisplay.innerText = `Date: ${dateString}`;
    bookingModal.classList.add('active');
    bookingModal.style.display = 'flex';
}

function showBookingDetails(dateString) {
    detailsDateDisplay.innerText = `Date: ${dateString}`;
    const approved = bookingsData[dateString].filter(b => b.status === 'approved');
    bookingDetailsList.innerHTML = approved.map((b, i) => `
        <div class="booking-card approved">
            <h3>Event #${i + 1}: ${b.type} <span class="status-badge approved">Approved</span></h3>
            <p><strong>Time:</strong> ${b.start} - ${b.end}</p>
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
            <p><strong>Time:</strong> ${b.start} - ${b.end}</p>
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
// FORM SUBMISSION
// ==========================================
bookingForm.addEventListener('submit', async e => {
    e.preventDefault();

    const startTime = document.getElementById('startTime').value;
    const endTime   = document.getElementById('endTime').value;

    if (startTime >= endTime) {
        alert('End time must be after start time!');
        return;
    }

    let finalEventType = eventTypeSelect.value;
    if (finalEventType === 'Other') {
        finalEventType = otherEventTypeInput.value.trim();
        if (!finalEventType) { alert('Please specify the event type!'); return; }
    }

    // Double-booking check
    try {
        const { data: conflicts, error } = await supabase
            .from('event_bookings')
            .select('id')
            .eq('date', selectedDate)
            .eq('start', startTime)
            .in('status', ['approved', 'pending']);

        if (error) throw error;
        if (conflicts.length > 0) {
            alert('This time slot is already booked or pending approval!\nPlease choose a different time.');
            return;
        }
    } catch (error) {
        console.error('Conflict check failed:', error);
    }

    // Submit booking
    try {
        const { error } = await supabase.from('event_bookings').insert({
            date:         selectedDate,
            start:        startTime,
            end:          endTime,
            type:         finalEventType,
            pax:          Number(document.getElementById('pax').value),
            description:  document.getElementById('description').value,
            status:       'pending',
            submitted_at: new Date().toISOString()
        });

        if (error) throw error;

        alert(`Booking Request Submitted!\n\nDate: ${selectedDate}\nTime: ${startTime} - ${endTime}\n\nYour booking is pending admin approval.`);
        closeBookingModal();
        await loadBookings();
        renderCalendar();
    } catch (error) {
        console.error('Failed to submit booking:', error);
        alert('Failed to submit booking. Please try again.');
    }
});

window.handleDayClick = handleDayClick;
