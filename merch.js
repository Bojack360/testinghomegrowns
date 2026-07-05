import { supabase } from './supabaseConfig.js';
import { initReveal } from './animations.js';
import { requireAuth, initNavAuth, getUser } from './auth.js';
import { showToast } from './toast.js';

// ==========================================
// GLOBAL STATE
// ==========================================
let cart             = [];
let currentItem      = null;
let currentSize      = null;
let products         = [];
let currentUserEmail = '';
let currentUserPhone = '';

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
    buildSizeModal();
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
        const btnText  = isOutOfStock ? 'OUT OF STOCK' : 'Add To Cart';
        const btnClass = isOutOfStock ? 'balhin1' : 'balhin';
        const disabled = isOutOfStock ? 'disabled' : '';

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
                        <button class="${btnClass}"
                                data-name="${product.name}"
                                data-price="${product.price}"
                                data-img="${imgSrc}"
                                ${disabled}>${btnText}</button>
                    </h4>
                </div>
            </div>
        `;
        card.querySelector('.product-card-dynamic').addEventListener('click', e => {
            if (e.target.closest('.balhin, .balhin1')) return;
            openProductModal(product);
        });
        grid.appendChild(card);
    });

    attachAddToCartListeners();
    initReveal();
}

function attachAddToCartListeners() {
    document.querySelectorAll('.balhin').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const user = await requireAuth();
            if (!user) return;
            openSizeModal(btn.dataset.name, btn.dataset.price, btn.dataset.img);
        });
    });
}

// ==========================================
// SIZE MODAL
// ==========================================
function openSizeModal(name, price, img) {
    currentItem = { name, price: Number(price), img };
    const sizes = SIZES[name] || ['S', 'M', 'L', 'XL'];
    currentSize = sizes[0];

    document.getElementById('sm-img').src           = img;
    document.getElementById('sm-name').textContent  = name;
    document.getElementById('sm-price').textContent = formatPrice(price);
    document.getElementById('sm-chips').innerHTML   = sizes.map((size, i) => `
        <div class="size-chip${i === 0 ? ' active' : ''}" onclick="selectSize('${size}', this)">${size}</div>
    `).join('');

    document.getElementById('sizeModal').style.display = 'block';
}

function selectSize(size, el) {
    currentSize = size;
    document.querySelectorAll('#sm-chips .size-chip').forEach(chip => chip.classList.remove('active'));
    el.classList.add('active');
}

function closeSizeModal() {
    document.getElementById('sizeModal').style.display = 'none';
    currentItem = null;
}

function confirmSize() {
    if (!currentItem) return;
    addToCart(currentItem.name, currentItem.price, currentItem.img, currentSize);
    closeSizeModal();
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
// SIZE MODAL BUILDER
// ==========================================
function buildSizeModal() {
    const modal = document.createElement('div');
    modal.id        = 'sizeModal';
    modal.className = 'shoppingcart';
    modal.style.cssText = 'z-index:3000; pointer-events:none;';

    modal.innerHTML = `
        <div class="cartclass size-modal-card">
            <div class="cartheader">
                <h2 style="font-size:1.15rem;">Select Size</h2>
                <span class="close" onclick="closeSizeModal()">&times;</span>
            </div>
            <img id="sm-img" class="size-modal-img" src="" alt="">
            <div id="sm-name"  class="size-modal-name"></div>
            <div id="sm-price" class="size-modal-price"></div>
            <div class="size-modal-label">Select a Size</div>
            <div id="sm-chips" class="size-chips"></div>
            <div class="cartfooter" style="justify-content:center; margin-top:24px;">
                <button class="cancel"  onclick="closeSizeModal()">Cancel</button>
                <button class="confirm" onclick="confirmSize()">Add To Cart</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeSizeModal(); });
}

// ==========================================
// PRODUCT DETAIL MODAL
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
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeProductModal(); });
}

function openProductModal(product) {
    const isOutOfStock = !product.in_stock || product.stock_quantity <= 0;

    document.getElementById('pm-img').src          = product.image_url || 'assets/images/whitetee.png';
    document.getElementById('pm-name').textContent  = product.name;
    document.getElementById('pm-price').textContent = formatPrice(product.price);
    document.getElementById('pm-desc').textContent  = product.description || '';

    const stockBadge = document.getElementById('pm-stock');
    stockBadge.textContent = isOutOfStock ? 'Out of Stock' : 'In Stock';
    stockBadge.className   = `pm-stock-badge ${isOutOfStock ? 'out-of-stock' : 'in-stock'}`;

    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

// ==========================================
// EXPOSE TO GLOBAL SCOPE
// ==========================================
window.closeSizeModal    = closeSizeModal;
window.confirmSize       = confirmSize;
window.selectSize        = selectSize;
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

