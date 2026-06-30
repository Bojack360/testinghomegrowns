export function initReveal() {
    const obs = new IntersectionObserver(
        entries => entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                obs.unobserve(e.target);
            }
        }),
        { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}
