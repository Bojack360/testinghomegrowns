export function initReveal() {
    const isInViewport = el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    };

    const obs = new IntersectionObserver(
        entries => entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                obs.unobserve(e.target);
            }
        }),
        { threshold: 0.1 }
    );

    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
        // Elements already in the initial viewport aren't guaranteed an
        // IntersectionObserver callback in every browser — reveal them
        // immediately instead of risking a permanently invisible element.
        if (isInViewport(el)) {
            el.classList.add('visible');
        } else {
            obs.observe(el);
        }
    });
}
