import { supabase } from './supabaseConfig.js';
import { initReveal } from './animations.js';
import { requireAuth, initNavAuth, getUser } from './auth.js';
import { showToast } from './toast.js';

// ==========================================
// GLOBAL STATE
// ==========================================
let cart             = [];
let products         = [];
let currentUserEmail = '';
let currentUserPhone = '';

// Preview-modal state
let pmProduct = null;
let pmSize    = null;
let pmQty     = 1;

const SIZES = {
    'Mandog Shirt':       ['S', 'M', 'L', 'XL', '2XL'],
    'Mandag Shirt':       ['S', 'M', 'L', 'XL'],
    'Popoy Shirt':        ['S', 'M', 'L', 'XL'],
    'Homegrowns T-shirt': ['S', 'M', 'L', 'XL', '2XL'],
    'Migo Nico Shirt':    ['S', 'M', 'L', 'XL'],
    'Chupilading':        ['S', 'M', 'L', 'XL'],
    'Kianegi':            ['S', 'M', 'L', 'XL', '2XL'],
    'Marvino Gurobino':   ['One Size'],
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    buildProductModal();
    await loadProducts();
    renderProducts();
    renderCartItems();
    updateCartCounter();
    initNavAuth();
    const user = await getUser();
    if (user) {
        currentUserEmail = user.email || '';
        currentUserPhone = user.user_metadata?.phone || '';
    }
});

// ==========================================
// DATA LOADING
// ==========================================
async function loadProducts() {
    try {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;

        if (!data || data.length === 0) {
            console.warn('No products found in Supabase.');
            products = [];
            return;
        }

        products = data.map(row => ({
            id:             row.id,
            name:           row.name || 'Unknown Product',
            price:          Number(row.price) || 0,
            description:    row.description || '',
            image_url:      row.image_url || 'assets/images/whitetee.png',
            sizes:          Array.isArray(row.sizes) ? row.sizes : ['S', 'M', 'L', 'XL'],
            stock_quantity: Number(row.stock_quantity) || 0,
            in_stock:       row.in_stock !== false
        }));

        console.log(`Loaded ${products.length} products`);
    } catch (error) {
        console.error('Failed to load products:', error);
        showToast('Could not load products. Please check your internet connection.', 'error');
    }
}

// ==========================================
// PRODUCT RENDERING
// ==========================================
function renderProducts() {
    const grid = document.querySelector('.apatkabayo');
    if (!grid) return;

    grid.innerHTML = '';
    products.forEach((product, i) => {
        const imgSrc = product.image_url || 'assets/images/whitetee.png';

        const isOutOfStock = !product.in_stock || product.stock_quantity <= 0;

        const card = document.createElement('div');
        card.className = 'bayo-item reveal';
        card.style.transitionDelay = `${i * 0.07}s`;
        card.innerHTML = `
            <div class="product-card-dynamic">
                <div class="pc-image-wrap">
                    <img src="${imgSrc}" alt="${product.name}" onerror="this.src='assets/images/whitetee.png'">
                    ${isOutOfStock ? '<span class="pc-badge">Out of Stock</span>' : ''}
                </div>
                <div class="pc-body">
                    <h2>${product.name}</h2>
                    <h3>${product.description}</h3>
                    <h4>
                        <span class="pc-price">₱${product.price.toLocaleString()}</span>
                    </h4>
                </div>
            </div>
        `;
        card.querySelector('.product-card-dynamic').addEventListener('click', () => {
            openProductModal(product);
        });
        grid.appendChild(card);
    });

    initReveal();
}

// ==========================================
// CART LOGIC
// ==========================================
function addToCart(name, price, img, size, qty = 1) {
    const key      = `${name}__${size}`;
    const existing = cart.find(item => item.key === key);
    if (existing) existing.qty += qty;
    else cart.push({ key, name, price, img, size, qty });
    updateCartCounter();
    renderCartItems();
}

function removeFromCart(key) {
    cart = cart.filter(item => item.key !== key);
    updateCartCounter();
    renderCartItems();
}

function changeQty(key, change) {
    const item = cart.find(i => i.key === key);
    if (!item) return;
    item.qty += change;
    if (item.qty <= 0) removeFromCart(key);
    else { updateCartCounter(); renderCartItems(); }
}

function getTotalItems() { return cart.reduce((sum, item) => sum + item.qty, 0); }
function getTotalPrice() { return cart.reduce((sum, item) => sum + item.price * item.qty, 0); }
function updateCartCounter() {
    const counter = document.getElementById('countercart');
    if (counter) counter.textContent = getTotalItems();
}
function formatPrice(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    const totalEl   = document.getElementById('cartTotal');
    if (!container) return;
    if (totalEl) totalEl.textContent = '₱' + getTotalPrice().toLocaleString('en-PH', { minimumFractionDigits: 2 });

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <p>Your cart is empty.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.img}" alt="${item.name}">
            <div class="item-details">
                <h4>${item.name}</h4>
                <span class="item-size-badge">Size: ${item.size}</span>
                <p class="item-price">₱${(item.price * item.qty).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
            </div>
            <div class="qty-stepper">
                <button onclick="changeQty('${item.key}', -1)">&#8722;</button>
                <div class="qty-divider"></div>
                <span>${item.qty}</span>
                <div class="qty-divider"></div>
                <button onclick="changeQty('${item.key}', 1)">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.key}')" title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    `).join('');
}

function shoppingCart() {
    const modal = document.getElementById('cartcart');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

// ==========================================
// CHECKOUT
// ==========================================
function showConfirmation() {
    if (cart.length === 0) { showToast('Your cart is empty!', 'warning'); return; }

    const phone = currentUserPhone;
    const email = currentUserEmail;
    const desc  = document.getElementById('custDesc').value.trim();

    if (!phone) { showToast('No phone number on your account. Please update your profile.', 'warning'); return; }

    const itemLines = cart.map(item => `
        <div class="summary-item-row">
            <span class="item-name">${item.name} <span class="item-meta">(${item.size}) &times; ${item.qty}</span></span>
            <span class="item-amount">₱${(item.price * item.qty).toLocaleString()}</span>
        </div>
    `).join('');

    document.getElementById('summary').innerHTML = `
        ${phone ? `<div class="summary-row"><span class="summary-label">Phone</span><span class="summary-value">${phone}</span></div>` : ''}
        ${email ? `<div class="summary-row"><span class="summary-label">Email</span><span class="summary-value">${email}</span></div>` : ''}
        ${desc  ? `<div class="summary-row"><span class="summary-label">Pickup Info</span><span class="summary-value">${desc}</span></div>` : ''}
        <hr class="summary-divider">
        ${itemLines}
        <hr class="summary-divider">
        <div class="summary-total-row">
            <span>Total Payment at Pickup</span>
            <span class="summary-total-amount">₱${getTotalPrice().toLocaleString()}</span>
        </div>
        <p class="summary-note">Pay cash when you pick up at the cafe.</p>
    `;

    document.getElementById('cartcart').style.display    = 'none';
    document.getElementById('confirmModal').style.display = 'block';
}

function closeConfirmation() {
    document.getElementById('confirmModal').style.display = 'none';
    document.getElementById('cartcart').style.display     = 'block';
}

async function finalizeOrder() {
    document.getElementById('confirmModal').style.display = 'none';

    try {
        // Deduct stock for each item
        for (const item of cart) {
            const product = products.find(p => p.name === item.name);
            if (product && product.id) {
                const newStock = Math.max(0, product.stock_quantity - item.qty);
                const { error } = await supabase
                    .from('products')
                    .update({ stock_quantity: newStock })
                    .eq('id', product.id);
                if (error) console.error('Stock update error:', error);
                product.stock_quantity = newStock;
            }
        }

        // Save order
        const { error } = await supabase.from('orders').insert({
            customer_email: currentUserEmail,
            customer_phone: currentUserPhone,
            pickup_desc:    document.getElementById('custDesc').value.trim(),
            items:          cart.map(i => ({ name: i.name, size: i.size, qty: i.qty, price: i.price })),
            total:          getTotalPrice(),
            status:         'Pending',
            created_at:     new Date().toISOString()
        });

        if (error) throw error;

        showSuccessPopup();

        cart = [];
        updateCartCounter();
        renderCartItems();
        document.getElementById('custDesc').value = '';

        await loadProducts();
        renderProducts();
    } catch (error) {
        console.error('Order failed:', error);
        showToast('Something went wrong. Please try again.', 'error');
        document.getElementById('confirmModal').style.display = 'block';
    }
}

function showSuccessPopup() {
    const snapshot  = [...cart];
    const total     = getTotalPrice();
    const popup     = document.createElement('div');
    popup.id        = 'successOverlay';
    popup.className = 'shoppingcart';
    popup.style.cssText = 'display:block; z-index:4000;';

    const itemRows = snapshot.map(item => `
        <div class="summary-item-row">
            <span class="item-name">${item.name} <span class="item-meta">&times; ${item.qty}</span></span>
            <span class="item-amount">₱${(item.price * item.qty).toLocaleString()}</span>
        </div>
    `).join('');

    popup.innerHTML = `
        <div class="cartclass success-card">
            <div class="success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6ee8a0" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 class="success-title">Order Confirmed!</h2>
            <p class="success-sub">Your pre-order is reserved.<br>CASH ONLY.</p>
            <div class="success-summary">
                ${itemRows}
                <hr class="summary-divider">
                <div class="summary-total-row">
                    <span>Total Payment at Pickup</span>
                    <span class="summary-total-amount">₱${total.toLocaleString()}</span>
                </div>
            </div>
            <button class="confirm" onclick="closeSuccess()" style="width:100%;">Done</button>
        </div>
    `;
    document.body.appendChild(popup);
}

function closeSuccess() {
    document.getElementById('successOverlay')?.remove();
}

// ==========================================
// PRODUCT DETAIL MODAL (with size / qty / add-to-cart)
// ==========================================
function buildProductModal() {
    const overlay = document.createElement('div');
    overlay.id        = 'productModal';
    overlay.className = 'product-modal-overlay';

    overlay.innerHTML = `
        <div class="product-modal">
            <span class="product-modal-close" onclick="closeProductModal()">&times;</span>
            <div class="product-modal-image">
                <img id="pm-img" src="" alt="">
            </div>
            <div class="product-modal-info">
                <div class="pm-category">Merchandise</div>
                <h2 class="pm-name" id="pm-name"></h2>
                <div class="pm-price" id="pm-price"></div>
                <div class="pm-stock-badge" id="pm-stock"></div>
                <p class="pm-desc" id="pm-desc"></p>

                <div class="pm-buy" id="pm-buy">
                    <div class="pm-section-label">Select a Size</div>
                    <div class="pm-sizes" id="pm-sizes"></div>
                    <div class="pm-actions">
                        <div class="qty-stepper pm-qty">
                            <button type="button" onclick="pmChangeQty(-1)">&#8722;</button>
                            <div class="qty-divider"></div>
                            <span id="pm-qty">1</span>
                            <div class="qty-divider"></div>
                            <button type="button" onclick="pmChangeQty(1)">+</button>
                        </div>
                        <button class="pm-add-btn" id="pm-add-btn" onclick="pmAddToCart()">Add to Cart</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeProductModal(); });
}

function openProductModal(product) {
    const isOutOfStock = !product.in_stock || product.stock_quantity <= 0;

    pmProduct = product;
    pmQty     = 1;

    document.getElementById('pm-img').src           = product.image_url || 'assets/images/whitetee.png';
    document.getElementById('pm-name').textContent  = product.name;
    document.getElementById('pm-price').textContent = formatPrice(product.price);
    document.getElementById('pm-desc').textContent  = product.description || '';
    document.getElementById('pm-qty').textContent   = '1';

    const stockBadge = document.getElementById('pm-stock');
    stockBadge.textContent = isOutOfStock ? 'Out of Stock' : 'In Stock';
    stockBadge.className   = `pm-stock-badge ${isOutOfStock ? 'out-of-stock' : 'in-stock'}`;

    const buySection = document.getElementById('pm-buy');
    const sizes = (Array.isArray(product.sizes) && product.sizes.length)
        ? product.sizes
        : (SIZES[product.name] || ['S', 'M', 'L', 'XL']);
    pmSize = sizes[0];

    document.getElementById('pm-sizes').innerHTML = sizes.map((size, i) =>
        `<div class="size-chip${i === 0 ? ' active' : ''}" onclick="pmSelectSize('${size}', this)">${size}</div>`
    ).join('');

    // Hide the buy controls entirely when the item is out of stock
    buySection.style.display = isOutOfStock ? 'none' : 'block';

    document.getElementById('productModal').classList.add('active');
}

function pmSelectSize(size, el) {
    pmSize = size;
    document.querySelectorAll('#pm-sizes .size-chip').forEach(chip => chip.classList.remove('active'));
    el.classList.add('active');
}

function pmChangeQty(change) {
    pmQty = Math.max(1, pmQty + change);
    document.getElementById('pm-qty').textContent = pmQty;
}

async function pmAddToCart() {
    if (!pmProduct) return;
    const user = await requireAuth();
    if (!user) return;

    const img = pmProduct.image_url || 'assets/images/whitetee.png';
    addToCart(pmProduct.name, pmProduct.price, img, pmSize, pmQty);
    closeProductModal();
    showToast(`Added ${pmQty} × ${pmProduct.name} (${pmSize}) to cart.`, 'success');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

// ==========================================
// EXPOSE TO GLOBAL SCOPE
// ==========================================
window.pmSelectSize      = pmSelectSize;
window.pmChangeQty       = pmChangeQty;
window.pmAddToCart       = pmAddToCart;
window.shoppingCart      = shoppingCart;
window.showConfirmation  = showConfirmation;
window.closeConfirmation = closeConfirmation;
window.finalizeOrder     = finalizeOrder;
window.removeFromCart    = removeFromCart;
window.changeQty         = changeQty;
window.closeSuccess      = closeSuccess;
window.closeProductModal = closeProductModal;
window.toggleMenu        = () => {
    document.getElementById('nav-list').classList.toggle('active');
};

