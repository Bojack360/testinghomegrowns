import { supabase } from './supabaseConfig.js';

let products       = [];
let cart           = {};
let activeCategory = 'merchandise';
let discountType   = 'pct';
let discountValue  = 0;

// ── Coffee Menu (hardcoded) ────────────────────────────────────────────────
const COFFEE_MENU = [
    {
        subcategory: 'Specialty Coffee',
        items: [
            { id: 'sc_espresso',     name: 'Espresso',            price: 80  },
            { id: 'sc_bonbon',       name: 'Bonbon',              price: 100 },
            { id: 'sc_americano',    name: 'Americano',           price: 110 },
            { id: 'sc_latte',        name: 'Latte',               price: 120 },
            { id: 'sc_spanish',      name: 'Spanish Latte',       price: 140 },
            { id: 'sc_choco',        name: 'Choco Latte',         price: 150 },
            { id: 'sc_caramel',      name: 'Caramel Latte',       price: 150 },
            { id: 'sc_strawbs',      name: 'Strawbs Latte',       price: 160 },
            { id: 'sc_pb_latte',     name: 'Peanut Butter Latte', price: 160 },
            { id: 'sc_dirty_matcha', name: 'Dirty Matcha',        price: 170 },
            { id: 'sc_biscoff',      name: 'Biscoff Latte',       price: 170 },
            { id: 'sc_pb_mocha',     name: 'PB Mocha Latte',      price: 180 },
        ]
    },
    {
        subcategory: 'Non-Coffee',
        items: [
            { id: 'nc_chocs',          name: 'Chocs Lang',        price: 120 },
            { id: 'nc_blueberry',      name: 'Blueberry Lang',    price: 120 },
            { id: 'nc_strawbs',        name: 'Strawbs Lang',      price: 130 },
            { id: 'nc_matcha',         name: 'Matcha Lang',       price: 150 },
            { id: 'nc_matcha_chocs',   name: 'Matcha Chocs',      price: 160 },
            { id: 'nc_matcha_bb',      name: 'Matcha BB',         price: 160 },
            { id: 'nc_matcha_strawbs', name: 'Matcha Strawbs',    price: 170 },
            { id: 'nc_biscoff_bb',     name: 'Biscoff BB',        price: 170 },
            { id: 'nc_biscoff_matcha', name: 'Biscoff Matcha',    price: 170 },
            { id: 'nc_biscoff_strawbs',name: 'Biscoff Strawbs',   price: 170 },
            { id: 'nc_biscoff_chocs',  name: 'Biscoff Chocs',     price: 170 },
            { id: 'nc_biscoff_caramel',name: 'Biscoff Caramel',   price: 170 },
            { id: 'nc_pb_bb',          name: 'Peanut Butter BB',  price: 170 },
        ]
    },
    {
        subcategory: 'Munchies',
        items: [
            { id: 'mn_ham',       name: 'Ham & Cheese',              price: 150 },
            { id: 'mn_cheesy',    name: 'Cheesy Babe & Yolk Stack',  price: 180 },
            { id: 'mn_butchers',  name: "Butcher's Cut",             price: 220 },
            { id: 'mn_pb_hazel',  name: 'PB Hazelnut Sandwich',      price: 100 },
            { id: 'mn_bb_pie',    name: 'BB Custard Pie',            price: 120 },
            { id: 'mn_egg_pie',   name: 'Egg Pie',                   price: 100 },
            { id: 'mn_cookies',   name: 'Cookies',                   price: 50  },
        ]
    },
    {
        subcategory: 'Alternative',
        items: [
            { id: 'sc_oatmilk', name: 'Oatmilk Alternative', price: 40 },
        ]
    }
];

const coffeeItemsMap = {};
COFFEE_MENU.forEach(section =>
    section.items.forEach(item => { coffeeItemsMap[item.id] = item; })
);

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    setupEvents();
});

// ── Products ──────────────────────────────────────────────────────────────
async function loadProducts() {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) { console.error(error); return; }
    products = data || [];
    applyFilters();
}

function applyFilters() {
    const q = (document.getElementById('searchInput').value || '').toLowerCase();
    if (activeCategory === 'coffee') {
        renderCoffeeMenu(q);
        return;
    }
    let filtered = products.filter(p => {
        const cat = (p.category || '').toLowerCase();
        return cat !== 'coffee' && cat !== 'drinks';
    });
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    renderProducts(filtered);
}

function renderCoffeeMenu(q = '') {
    const grid = document.getElementById('productsGrid');
    let html = '';
    for (const section of COFFEE_MENU) {
        const filtered = q
            ? section.items.filter(i => i.name.toLowerCase().includes(q))
            : section.items;
        if (filtered.length === 0) continue;
        html += `<div class="menu-section-header">${section.subcategory}</div>`;
        html += filtered.map(item => `
            <div class="product-tile coffee-tile" data-id="${item.id}">
                <p class="tile-name">${esc(item.name)}</p>
                <p class="tile-price">&#8369;${item.price.toFixed(2)}</p>
            </div>
        `).join('');
    }
    grid.innerHTML = html || '<p class="loading-msg">No items found.</p>';
}

function renderProducts(list) {
    const grid = document.getElementById('productsGrid');
    if (list.length === 0) {
        grid.innerHTML = '<p class="loading-msg">No products found.</p>';
        return;
    }
    grid.innerHTML = list.map(p => {
        const outOfStock = p.stock_quantity <= 0;
        const stockClass = p.stock_quantity <= 5 && p.stock_quantity > 0 ? 'low' : '';
        return `
            <div class="product-tile${outOfStock ? ' out-of-stock' : ''}" data-id="${p.id}">
                <img src="${esc(p.image_url || '')}" alt="${esc(p.name)}"
                     onerror="this.src='assets/images/Logo.png'">
                <p class="tile-name">${esc(p.name)}</p>
                <p class="tile-price">₱${parseFloat(p.price).toFixed(2)}</p>
                <p class="tile-stock ${stockClass}">${outOfStock ? 'Out of Stock' : 'Stock: ' + p.stock_quantity}</p>
            </div>
        `;
    }).join('');
}

// ── Cart ──────────────────────────────────────────────────────────────────
function addToCart(productId) {
    const product = coffeeItemsMap[productId] || products.find(p => p.id === productId);
    if (!product) return;
    if (!coffeeItemsMap[productId] && product.stock_quantity <= 0) return;
    if (cart[productId]) {
        if (!coffeeItemsMap[productId] && cart[productId].qty >= product.stock_quantity) {
            alert('Maximum available stock reached.');
            return;
        }
        cart[productId].qty++;
    } else {
        cart[productId] = { product, qty: 1 };
    }
    renderCart();
}

function changeQty(productId, delta) {
    if (!cart[productId]) return;
    cart[productId].qty += delta;
    const maxStock = cart[productId].product.stock_quantity;
    if (cart[productId].qty <= 0)             { delete cart[productId]; }
    else if (cart[productId].qty > maxStock)  { cart[productId].qty = maxStock; }
    renderCart();
}

function removeFromCart(productId) {
    delete cart[productId];
    renderCart();
}

function clearCart() {
    cart = {};
    discountValue = 0;
    const inp = document.getElementById('discountInput');
    if (inp) inp.value = '';
    renderCart();
}

function getSubtotal() {
    return Object.values(cart).reduce((s, { product, qty }) => s + parseFloat(product.price) * qty, 0);
}

function getDiscountAmount(subtotal) {
    if (discountValue <= 0) return 0;
    if (discountType === 'pct')   return subtotal * (Math.min(discountValue, 100) / 100);
    return Math.min(discountValue, subtotal);
}

function getTotal() {
    const sub = getSubtotal();
    return Math.max(0, sub - getDiscountAmount(sub));
}

function renderCart() {
    const el    = document.getElementById('cartItems');
    const items = Object.values(cart);

    if (items.length === 0) {
        el.innerHTML = '<p class="cart-empty">No items added yet.</p>';
        document.getElementById('cartTotal').textContent = '₱0.00';
        return;
    }

    el.innerHTML = items.map(({ product, qty }) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <p class="cart-item-name">${esc(product.name)}</p>
                <p class="cart-item-price">₱${parseFloat(product.price).toFixed(2)} each</p>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" data-action="dec" data-id="${product.id}">&#8722;</button>
                <span class="qty-display">${qty}</span>
                <button class="qty-btn" data-action="inc" data-id="${product.id}">&#43;</button>
            </div>
            <div class="cart-item-subtotal">
                <p>₱${(parseFloat(product.price) * qty).toFixed(2)}</p>
                <button class="remove-btn" data-action="remove" data-id="${product.id}">&#10005;</button>
            </div>
        </div>
    `).join('');

    const sub  = getSubtotal();
    const disc = getDiscountAmount(sub);
    const total = Math.max(0, sub - disc);

    document.getElementById('cartTotal').textContent = '₱' + total.toFixed(2);

    const subtotalRow  = document.getElementById('subtotalRow');
    const discountLine = document.getElementById('discountLine');
    if (disc > 0) {
        subtotalRow.style.display  = 'flex';
        discountLine.style.display = 'flex';
        document.getElementById('subtotalAmount').textContent  = '₱' + sub.toFixed(2);
        document.getElementById('discountAmount').textContent  = '-₱' + disc.toFixed(2);
    } else {
        subtotalRow.style.display  = 'none';
        discountLine.style.display = 'none';
    }
}

// ── Process Sale ──────────────────────────────────────────────────────────
async function processSale() {
    const items = Object.values(cart);
    if (items.length === 0) { alert('Cart is empty.'); return; }

    const sub      = getSubtotal();
    const disc     = getDiscountAmount(sub);
    const total    = Math.max(0, sub - disc);
    const txnItems = items.map(({ product, qty }) => ({
        product_id: product.id,
        name:       product.name,
        price:      parseFloat(product.price),
        qty,
        subtotal:   parseFloat(product.price) * qty
    }));

    document.getElementById('processBtn').disabled    = true;
    document.getElementById('processBtn').textContent = 'Processing...';

    try {
        for (const { product, qty } of items) {
            if (coffeeItemsMap[product.id]) continue;
            const current  = products.find(p => p.id === product.id);
            const newStock = Math.max(0, current.stock_quantity - qty);
            await supabase.from('products').update({ stock_quantity: newStock }).eq('id', product.id);
        }

        const { error } = await supabase.from('pos_transactions').insert({
            items:    txnItems,
            total,
            discount: disc > 0 ? { type: discountType, value: discountValue, amount: disc } : null,
            created_at: new Date().toISOString()
        });
        if (error) throw error;

        showReceipt(txnItems, sub, disc, total);
        await loadProducts();
        clearCart();

    } catch (err) {
        alert('Error processing sale: ' + err.message);
    } finally {
        document.getElementById('processBtn').disabled    = false;
        document.getElementById('processBtn').textContent = 'Process Sale';
    }
}

function showReceipt(items, subtotal, disc, total) {
    const date = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const discLabel = discountType === 'pct'
        ? `Discount (${discountValue}%)`
        : `Discount`;
    document.getElementById('receiptBody').innerHTML = `
        <div class="receipt">
            <p class="receipt-date">${date}</p>
            <div class="receipt-items">
                ${items.map(i => `
                    <div class="receipt-row">
                        <span>${esc(i.name)} &times; ${i.qty}</span>
                        <span>₱${i.subtotal.toFixed(2)}</span>
                    </div>`).join('')}
            </div>
            <div class="receipt-divider"></div>
            ${disc > 0 ? `
            <div class="receipt-row">
                <span>Subtotal</span>
                <span>₱${subtotal.toFixed(2)}</span>
            </div>
            <div class="receipt-row" style="color:#2ecc71;">
                <span>${discLabel}</span>
                <span>-₱${disc.toFixed(2)}</span>
            </div>` : ''}
            <div class="receipt-row total">
                <span>Total</span>
                <span>₱${total.toFixed(2)}</span>
            </div>
        </div>
    `;
    const modal = document.getElementById('receiptModal');
    modal.style.display = 'flex';
    modal.classList.add('active');
}

// ── Event delegation ──────────────────────────────────────────────────────
function setupEvents() {
    document.getElementById('productsGrid').addEventListener('click', e => {
        const tile = e.target.closest('.product-tile');
        if (tile && !tile.classList.contains('out-of-stock')) addToCart(tile.dataset.id);
    });

    document.getElementById('cartItems').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'inc')    changeQty(id, 1);
        if (btn.dataset.action === 'dec')    changeQty(id, -1);
        if (btn.dataset.action === 'remove') removeFromCart(id);
    });

    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
    document.getElementById('processBtn').addEventListener('click', processSale);

    document.getElementById('newTxnBtn').addEventListener('click', () => {
        const modal = document.getElementById('receiptModal');
        modal.style.display = 'none';
        modal.classList.remove('active');
        discountType  = 'pct';
        discountValue = 0;
        document.getElementById('discountInput').value = '';
        document.getElementById('discTypePct').classList.add('active');
        document.getElementById('discTypeFixed').classList.remove('active');
    });

    document.getElementById('searchInput').addEventListener('input', applyFilters);

    document.getElementById('discountInput').addEventListener('input', e => {
        discountValue = parseFloat(e.target.value) || 0;
        renderCart();
    });

    document.getElementById('discTypePct').addEventListener('click', () => {
        discountType = 'pct';
        document.getElementById('discTypePct').classList.add('active');
        document.getElementById('discTypeFixed').classList.remove('active');
        renderCart();
    });

    document.getElementById('discTypeFixed').addEventListener('click', () => {
        discountType = 'fixed';
        document.getElementById('discTypeFixed').classList.add('active');
        document.getElementById('discTypePct').classList.remove('active');
        renderCart();
    });

    document.querySelector('.category-tabs').addEventListener('click', e => {
        const btn = e.target.closest('.cat-btn');
        if (!btn) return;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.cat;

        const discSection = document.getElementById('discountSection');
        if (activeCategory === 'coffee') {
            discSection.style.display = 'flex';
        } else {
            discSection.style.display = 'none';
            discountValue = 0;
            document.getElementById('discountInput').value = '';
            document.getElementById('discTypePct').classList.add('active');
            document.getElementById('discTypeFixed').classList.remove('active');
            discountType = 'pct';
            renderCart();
        }

        applyFilters();
    });
}

function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.logout = () => { window.location.href = 'index.html'; };
