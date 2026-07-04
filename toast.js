let container = null;

function getContainer() {
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

const ICONS = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity="0.15" fill="currentColor" stroke="none"/><polyline points="7 12.5 10.5 16 17 8"/></svg>',
    error:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity="0.15" fill="currentColor" stroke="none"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity="0.15" fill="currentColor" stroke="none"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.3" r="1" fill="currentColor" stroke="none"/></svg>',
    info:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity="0.15" fill="currentColor" stroke="none"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.7" r="1" fill="currentColor" stroke="none"/></svg>',
};

export function showToast(message, type = 'info', duration = 3500) {
    const c = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
        <span class="toast-msg"></span>
    `;
    toast.querySelector('.toast-msg').textContent = message;
    c.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => toast.classList.add('toast-show'));

    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}
