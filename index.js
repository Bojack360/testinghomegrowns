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