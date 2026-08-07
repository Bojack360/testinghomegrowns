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

// ── Card carousel (lightweight, no dependencies). One component reused by
//    every ".drink-carousel" on the page (Drinks and Munchies). ──
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.drink-carousel').forEach(initCarousel);
    });

    function initCarousel(root) {
        const track = root.querySelector('.carousel-track');
        if (!track) return;
        const total    = track.children.length;
        const prev     = root.querySelector('.carousel-arrow.prev');
        const next     = root.querySelector('.carousel-arrow.next');
        // Dots live just outside the carousel, within the same section.
        const dotsWrap = (root.parentElement || document).querySelector('.carousel-dots');
        let index = 0;

        function perView() {
            const w = window.innerWidth;
            return w >= 900 ? 3 : w >= 600 ? 2 : 1;
        }
        function maxIndex() { return Math.max(0, total - perView()); }

        function buildDots(n) {
            dotsWrap.innerHTML = '';
            for (let i = 0; i < n; i++) {
                const b = document.createElement('button');
                b.className = 'carousel-dot';
                b.type = 'button';
                b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                b.addEventListener('click', (function (target) {
                    return function () { index = target; update(); };
                })(i));
                dotsWrap.appendChild(b);
            }
        }

        function update() {
            const pv  = perView();
            const max = maxIndex();
            index = Math.max(0, Math.min(index, max));
            track.style.transform = 'translateX(-' + (index * (100 / pv)) + '%)';
            const positions = max + 1;
            if (dotsWrap.children.length !== positions) buildDots(positions);
            for (let i = 0; i < dotsWrap.children.length; i++) {
                dotsWrap.children[i].classList.toggle('active', i === index);
            }
            prev.classList.toggle('disabled', index === 0);
            next.classList.toggle('disabled', index === max);
        }

        prev.addEventListener('click', function () { if (index > 0) { index--; update(); } });
        next.addEventListener('click', function () { if (index < maxIndex()) { index++; update(); } });

        // Swipe support on touch devices
        const vp = track.parentElement;
        let startX = null;
        vp.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
        vp.addEventListener('touchend', function (e) {
            if (startX === null) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 40) {
                if (dx < 0 && index < maxIndex()) index++;
                else if (dx > 0 && index > 0) index--;
                update();
            }
            startX = null;
        }, { passive: true });

        let rt;
        window.addEventListener('resize', function () {
            clearTimeout(rt);
            rt = setTimeout(update, 150);
        });

        update();
    }
})();