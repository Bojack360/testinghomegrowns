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

// Scroll reveal
(function () {
    const obs = new IntersectionObserver(
        entries => entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        }),
        { threshold: 0.1 }
    );
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
    });
})();