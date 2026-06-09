function toggleMenu() {
    var nav = document.getElementById("nav-list");
    nav.classList.toggle("active");
}

document.querySelectorAll('a[href^="#"]:not(.btn-account)').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

const calendarDays = document.getElementById('calendarDays');
const monthYearDisplay = document.getElementById('monthYearDisplay');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

const bookingModal = document.getElementById('bookingModal');
const modalDateDisplay = document.getElementById('modalDateDisplay');
const cancelBtn = document.getElementById('cancelBtn');
const bookingForm = document.getElementById('bookingForm');

const detailsModal = document.getElementById('detailsModal');
const detailsDateDisplay = document.getElementById('detailsDateDisplay');
const bookingDetailsList = document.getElementById('bookingDetailsList');
const closeDetailsBtn = document.getElementById('closeDetailsBtn');

const pendingModal = document.getElementById('pendingModal');
const pendingDateDisplay = document.getElementById('pendingDateDisplay');
const pendingBookingDetails = document.getElementById('pendingBookingDetails');
const closePendingBtn = document.getElementById('closePendingBtn');

let currentDate = new Date();
let selectedDate = null;
let bookings = JSON.parse(localStorage.getItem('eventBookings')) || {};

function saveBookings() {
    localStorage.setItem('eventBookings', JSON.stringify(bookings));
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", 
                       "July", "August", "September", "October", "November", "December"];
    monthYearDisplay.innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    let daysHTML = "";

    for (let i = firstDayIndex; i > 0; i--) {
        daysHTML += `<div class="day inactive">${prevLastDate - i + 1}</div>`;
    }

    for (let i = 1; i <= lastDate; i++) {
        const isToday = i === new Date().getDate() && 
                       month === new Date().getMonth() && 
                       year === new Date().getFullYear();
        const todayClass = isToday ? "today" : "";
        
        const dateString = `${monthNames[month]} ${i}, ${year}`;
        const dateBookings = bookings[dateString];
        
        let bookedClass = "";
        let dayContent = `<span class="day-number">${i}</span>`;
        
        if (dateBookings && dateBookings.length > 0) {
            const approvedBookings = dateBookings.filter(b => b.status === 'approved');
            const pendingBookings = dateBookings.filter(b => b.status === 'pending');
            
            if (approvedBookings.length > 0) {
                bookedClass = "booked";
                dayContent += `<div class="booked-icon">✔</div>`;
                dayContent += `<div class="booking-time">${approvedBookings[0].start}</div>`;
            } else if (pendingBookings.length > 0) {
                bookedClass = "pending";
                dayContent += `<div class="pending-icon">⏳</div>`;
                dayContent += `<div class="pending-time">${pendingBookings[0].start}</div>`;
            }
        }

        daysHTML += `<div class="day ${todayClass} ${bookedClass}" onclick="handleDayClick('${dateString}')">${dayContent}</div>`;
    }

    const totalCells = firstDayIndex + lastDate;
    const nextDays = 42 - totalCells;
    for (let i = 1; i <= nextDays; i++) {
        daysHTML += `<div class="day inactive">${i}</div>`;
    }

    calendarDays.innerHTML = daysHTML;
}

prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

function handleDayClick(dateString) {
    selectedDate = dateString;
    
    if (bookings[dateString] && bookings[dateString].length > 0) {
        const dateBookings = bookings[dateString];
        const approvedBookings = dateBookings.filter(b => b.status === 'approved');
        const pendingBookings = dateBookings.filter(b => b.status === 'pending');
        
        if (approvedBookings.length > 0) {
            showBookingDetails(dateString, 'approved');
        } else if (pendingBookings.length > 0) {
            showPendingDetails(dateString);
        }
    } else {
        openBookingForm(dateString);
    }
}

function openBookingForm(dateString) {
    modalDateDisplay.innerText = `Date: ${dateString}`;
    bookingModal.classList.add('active');
    bookingModal.style.display = 'flex';
}

function showBookingDetails(dateString, status) {
    detailsDateDisplay.innerText = `Date: ${dateString}`;
    
    const dateBookings = bookings[dateString].filter(b => b.status === 'approved');
    
    if (dateBookings && dateBookings.length > 0) {
        let detailsHTML = '';
        
        dateBookings.forEach((booking, index) => {
            detailsHTML += `
                <div class="booking-card approved">
                    <h3>Event #${index + 1}: ${booking.type} <span class="status-badge approved">Approved</span></h3>
                    <p><strong>Time:</strong> ${booking.start} - ${booking.end}</p>
                    <p><strong>Number of Pax:</strong> ${booking.pax}</p>
                    <p><strong>Description:</strong> ${booking.description || 'No description'}</p>
                </div>
            `;
        });
        
        bookingDetailsList.innerHTML = detailsHTML;
    } else {
        bookingDetailsList.innerHTML = '<p class="no-bookings">No approved bookings for this date</p>';
    }
    
    detailsModal.classList.add('active');
    detailsModal.style.display = 'flex';
}

function showPendingDetails(dateString) {
    pendingDateDisplay.innerText = `Date: ${dateString}`;
    
    const dateBookings = bookings[dateString].filter(b => b.status === 'pending');
    
    if (dateBookings && dateBookings.length > 0) {
        let detailsHTML = '';
        
        dateBookings.forEach((booking, index) => {
            detailsHTML += `
                <div class="booking-card pending">
                    <h3>Event #${index + 1}: ${booking.type} <span class="status-badge pending">Pending</span></h3>
                    <p><strong>Time:</strong> ${booking.start} - ${booking.end}</p>
                    <p><strong>Number of Pax:</strong> ${booking.pax}</p>
                    <p><strong>Description:</strong> ${booking.description || 'No description'}</p>
                    <p><strong>Submitted:</strong> ${booking.submittedDate}</p>
                </div>
            `;
        });
        
        pendingBookingDetails.innerHTML = detailsHTML;
    }
    
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

window.addEventListener('click', (e) => {
    if (e.target === bookingModal) {
        closeBookingModal();
    }
    if (e.target === detailsModal) {
        closeDetailsModal();
    }
    if (e.target === pendingModal) {
        closePendingModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeBookingModal();
        closeDetailsModal();
        closePendingModal();
    }
});

bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const now = new Date();
    
    if (startTime >= endTime) {
        alert('⚠️ End time must be after start time!');
        return;
    }
    
    const newBooking = {
        id: Date.now(),
        start: startTime,
        end: endTime,
        type: document.getElementById('eventType').value,
        pax: document.getElementById('pax').value,
        description: document.getElementById('description').value,
        status: 'pending',
        submittedDate: now.toLocaleString()
    };

    if (!bookings[selectedDate]) {
        bookings[selectedDate] = [];
    }
    bookings[selectedDate].push(newBooking);

    saveBookings();
    renderCalendar();

    alert(`✅ Booking Request Submitted!\n\n📅 Date: ${selectedDate}\n⏰ Time: ${startTime} - ${endTime}\n\n⚠️ Your booking is pending admin approval. You will see it on the calendar once approved.`);
    
    closeBookingModal();
});
renderCalendar();