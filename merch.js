import { supabase } from './supabaseConfig.js';
import { initReveal } from './animations.js';

// ==========================================
// GLOBAL STATE
// ==========================================
let cart        = [];
let currentItem = null;
let currentSize = null;
let products    = [];

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
    await loadProducts();
    renderProducts();
    renderCartItems();
    updateCartCounter();
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
        alert('Could not load products. Please check your internet connection.');
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
                <img src="${imgSrc}" alt="${product.name}" onerror="this.src='assets/images/whitetee.png'">
                <h2>${product.name}</h2>
                <h3>${product.description}</h3>
                <h4>₱${product.price.toLocaleString()}
                    <button class="${btnClass}"
                            data-name="${product.name}"
                            data-price="${product.price}"
                            data-img="${imgSrc}"
                            ${disabled}>${btnText}</button>
                </h4>
            </div>
        `;
        grid.appendChild(card);
    });

    attachAddToCartListeners();
    initReveal();
}

function attachAddToCartListeners() {
    document.querySelectorAll('.balhin').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
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

    document.getElementById('sm-img').src             = img;
    document.getElementById('sm-name').textContent    = name;
    document.getElementById('sm-price').textContent   = formatPrice(price);
    document.getElementById('sm-chips').innerHTML     = sizes.map((size, i) => `
        <div onclick="selectSize('${size}', this)" style="
            background: ${i === 0 ? 'rgba(243,156,18,0.15)' : 'rgba(255,255,255,0.06)'};
            border: 1.5px solid ${i === 0 ? '#f39c12' : 'rgba(255,255,255,0.18)'};
            border-radius: 7px; padding: 7px 16px;
            font-size: 0.82rem; font-weight: 700; cursor: pointer;
            color: ${i === 0 ? '#f39c12' : '#aaa'};">${size}</div>
    `).join('');

    document.getElementById('sizeModal').style.display = 'block';
}

function selectSize(size, el) {
    currentSize = size;
    document.querySelectorAll('#sm-chips div').forEach(btn => {
        Object.assign(btn.style, { borderColor: 'rgba(255,255,255,0.18)', color: '#aaa', background: 'rgba(255,255,255,0.06)' });
    });
    Object.assign(el.style, { borderColor: '#f39c12', color: '#f39c12', background: 'rgba(243,156,18,0.15)' });
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
function addToCart(name, price, img, size) {
    const key      = `${name}__${size}`;
    const existing = cart.find(item => item.key === key);
    if (existing) existing.qty++;
    else cart.push({ key, name, price, img, size, qty: 1 });
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
        container.innerHTML = '<p style="text-align:center; color:#ccc; padding:18px 0;">Your cart is empty.</p>';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.img}" alt="${item.name}">
            <div class="item-details">
                <h4>${item.name}</h4>
                <p style="color:#aaa; font-size:0.75rem; margin:2px 0 4px;">Size: <strong style="color:#f39c12;">${item.size}</strong></p>
                <p>₱${(item.price * item.qty).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px; margin:0 10px;">
                <div style="display:flex; align-items:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px; overflow:hidden; height:40px;">
                    <button onclick="changeQty('${item.key}', -1)" style="width:44px; height:100%; background:transparent; border:none; color:rgba(255,255,255,0.8); font-size:1.3rem; cursor:pointer;">&#8722;</button>
                    <div style="width:1px; height:20px; background:rgba(255,255,255,0.15);"></div>
                    <span style="min-width:40px; text-align:center; font-weight:600; color:white;">${item.qty}</span>
                    <div style="width:1px; height:20px; background:rgba(255,255,255,0.15);"></div>
                    <button onclick="changeQty('${item.key}', 1)" style="width:44px; height:100%; background:transparent; border:none; color:rgba(255,255,255,0.8); font-size:1.3rem; cursor:pointer;">+</button>
                </div>
            </div>
            <button class="remove-btn" onclick="removeFromCart('${item.key}')">Remove</button>
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
    if (cart.length === 0) { alert('Your cart is empty!'); return; }

    const phone = document.getElementById('custPhone').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const desc  = document.getElementById('custDesc').value.trim();

    if (!phone) { alert('Please enter your phone number.'); return; }

    const itemLines = cart.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${item.name} <span style="color:#aaa; font-size:0.8rem;">(${item.size}) &times; ${item.qty}</span></span>
            <span style="color:#f39c12; font-weight:700;">₱${(item.price * item.qty).toLocaleString()}</span>
        </div>
    `).join('');

    document.getElementById('summary').innerHTML = `
        ${phone ? `<div style="margin-bottom:4px;"><strong>Phone:</strong> ${phone}</div>` : ''}
        ${email ? `<div style="margin-bottom:4px;"><strong>Email:</strong> ${email}</div>` : ''}
        ${desc  ? `<div style="margin-bottom:10px;"><strong>Pickup Info:</strong> ${desc}</div>` : ''}
        <hr style="border:none; border-top:1px solid #444; margin:10px 0;">
        ${itemLines}
        <hr style="border:none; border-top:1px solid #444; margin:10px 0;">
        <div style="display:flex; justify-content:space-between; font-weight:700;">
            <span>Total Payment at Pickup</span>
            <span style="color:#f39c12;">₱${getTotalPrice().toLocaleString()}</span>
        </div>
        <p style="margin-top:12px; font-size:0.78rem; color:#6ee8a0;">Pay cash when you pick up at the cafe.</p>
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
            customer_email: document.getElementById('custEmail').value.trim(),
            customer_phone: document.getElementById('custPhone').value.trim(),
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
        ['custEmail', 'custPhone', 'custDesc'].forEach(id => {
            document.getElementById(id).value = '';
        });

        await loadProducts();
        renderProducts();
    } catch (error) {
        console.error('Order failed:', error);
        alert('Something went wrong. Please try again.');
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
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.82rem;">
            <span style="color:#ccc;">${item.name} (${item.size}) &times; ${item.qty}</span>
            <span style="color:white; font-weight:700;">₱${(item.price * item.qty).toLocaleString()}</span>
        </div>
    `).join('');

    popup.innerHTML = `
        <div class="cartclass" style="max-width:440px; margin:5% auto; text-align:center;">
            <div style="width:70px; height:70px; border-radius:50%; background:rgba(46,204,113,0.12); border:2px solid #2ecc71; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style="color:#f39c12; letter-spacing:2px; margin:0 0 8px;">Order Confirmed!</h2>
            <p style="color:#aaa; font-size:0.85rem; margin:0 0 16px;">Your pre-order is reserved.<br>CASH ONLY.</p>
            <div style="text-align:left; background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:20px;">
                ${itemRows}
                <hr style="border:none; border-top:1px solid #444; margin:8px 0;">
                <div style="display:flex; justify-content:space-between; font-weight:700;">
                    <span>Total Payment at Pickup</span>
                    <span style="color:#f39c12;">₱${total.toLocaleString()}</span>
                </div>
            </div>
            <button class="confirm" onclick="closeSuccess()" style="width:100%; padding:13px; font-size:1rem;">Done</button>
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
        <div class="cartclass" style="max-width:360px; margin:8% auto; padding:28px; animation:slideDown 0.28s ease-out; pointer-events:auto;">
            <div class="cartheader">
                <h2 style="margin:0; font-size:1.15rem;">Select Size</h2>
                <span class="close" onclick="closeSizeModal()" style="cursor:pointer;">&times;</span>
            </div>
            <div style="text-align:center; padding:12px 0;">
                <img id="sm-img" src="" alt="" style="width:100px; height:100px; object-fit:contain; background:rgba(255,255,255,0.06); border-radius:10px; padding:8px; display:block; margin:0 auto 10px;">
                <div id="sm-name"  style="font-weight:800; font-size:1rem; color:white; margin-bottom:4px;"></div>
                <div id="sm-price" style="color:#f39c12; font-weight:900; font-size:1rem; margin-bottom:18px;"></div>
                <div id="sm-chips" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-bottom:22px;"></div>
            </div>
            <div class="cartfooter" style="margin-top:0; display:flex; justify-content:center; gap:10px;">
                <button class="cancel"  onclick="closeSizeModal()" style="padding:8px 16px !important; font-size:13px !important; min-width:80px;">Cancel</button>
                <button class="confirm" onclick="confirmSize()"    style="padding:8px 16px !important; font-size:13px !important; min-width:100px;">Add To Cart</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeSizeModal(); });
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
window.toggleMenu        = () => {
    document.getElementById('nav-list').classList.toggle('active');
};

