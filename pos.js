import { supabase } from './supabaseConfig.js';

let products      = [];
let cart          = {};   // { id: { product, qty } }
let selectedPayment = 'Cash';

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
    renderProducts(products);
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
                <p class="tile-price">&#8369;${parseFloat(p.price).toFixed(2)}</p>
                <p class="tile-stock ${stockClass}">${outOfStock ? 'Out of Stock' : 'Stock: ' + p.stock_quantity}</p>
            </div>
        `;
    }).join('');
}

// ── Cart ──────────────────────────────────────────────────────────────────
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock_quantity <= 0) return;
    if (cart[productId]) {
        if (cart[productId].qty >= product.stock_quantity) {
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
    if (cart[productId].qty <= 0)        { delete cart[productId]; }
    else if (cart[productId].qty > maxStock) { cart[productId].qty = maxStock; }
    renderCart();
}

function removeFromCart(productId) {
    delete cart[productId];
    renderCart();
}

function clearCart() {
    cart = {};
    renderCart();
}

function getTotal() {
    return Object.values(cart).reduce((s, { product, qty }) => s + parseFloat(product.price) * qty, 0);
}

function renderCart() {
    const el    = document.getElementById('cartItems');
    const items = Object.values(cart);

    if (items.length === 0) {
        el.innerHTML = '<p class="cart-empty">No items added yet.</p>';
        document.getElementById('cartTotal').textContent = '&#8369;0.00';
        updateChange();
        return;
    }

    el.innerHTML = items.map(({ product, qty }) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <p class="cart-item-name">${esc(product.name)}</p>
                <p class="cart-item-price">&#8369;${parseFloat(product.price).toFixed(2)} each</p>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" data-action="dec" data-id="${product.id}">&#8722;</button>
                <span class="qty-display">${qty}</span>
                <button class="qty-btn" data-action="inc" data-id="${product.id}">&#43;</button>
            </div>
            <div class="cart-item-subtotal">
                <p>&#8369;${(parseFloat(product.price) * qty).toFixed(2)}</p>
                <button class="remove-btn" data-action="remove" data-id="${product.id}">&#10005;</button>
            </div>
        </div>
    `).join('');

    document.getElementById('cartTotal').textContent = '&#8369;' + getTotal().toFixed(2);
    updateChange();
}

// ── Payment ───────────────────────────────────────────────────────────────
function updateChange() {
    if (selectedPayment !== 'Cash') {
        document.getElementById('changeAmount').textContent = '&#8369;0.00';
        return;
    }
    const cash   = parseFloat(document.getElementById('cashReceived').value) || 0;
    const change = Math.max(0, cash - getTotal());
    document.getElementById('changeAmount').textContent = '&#8369;' + change.toFixed(2);
}

// ── Process Sale ──────────────────────────────────────────────────────────
async function processSale() {
    const items = Object.values(cart);
    if (items.length === 0) { alert('Cart is empty.'); return; }

    const total = getTotal();

    if (selectedPayment === 'Cash') {
        const cash = parseFloat(document.getElementById('cashReceived').value) || 0;
        if (cash < total) { alert('Cash received is less than the total amount.'); return; }
    }

    const cash   = selectedPayment === 'Cash' ? (parseFloat(document.getElementById('cashReceived').value) || 0) : null;
    const change = selectedPayment === 'Cash' ? Math.max(0, cash - total) : null;

    const txnItems = items.map(({ product, qty }) => ({
        product_id: product.id,
        name:       product.name,
        price:      parseFloat(product.price),
        qty,
        subtotal:   parseFloat(product.price) * qty
    }));

    document.getElementById('processBtn').disabled = true;
    document.getElementById('processBtn').textContent = 'Processing...';

    try {
        // Deduct stock
        for (const { product, qty } of items) {
            const current  = products.find(p => p.id === product.id);
            const newStock = Math.max(0, current.stock_quantity - qty);
            await supabase.from('products').update({ stock_quantity: newStock }).eq('id', product.id);
        }

        // Insert transaction
        const { error } = await supabase.from('pos_transactions').insert({
            items:          txnItems,
            total,
            payment_method: selectedPayment,
            cash_received:  cash,
            change_amount:  change,
            created_at:     new Date().toISOString()
        });
        if (error) throw error;

        showReceipt(txnItems, total, selectedPayment, cash, change);
        await loadProducts();
        clearCart();

    } catch (err) {
        alert('Error processing sale: ' + err.message);
    } finally {
        document.getElementById('processBtn').disabled = false;
        document.getElementById('processBtn').textContent = 'Process Sale';
    }
}

function showReceipt(items, total, paymentMethod, cash, change) {
    const date = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('receiptBody').innerHTML = `
        <div class="receipt">
            <p class="receipt-date">${date}</p>
            <div class="receipt-items">
                ${items.map(i => `
                    <div class="receipt-row">
                        <span>${esc(i.name)} &times; ${i.qty}</span>
                        <span>&#8369;${i.subtotal.toFixed(2)}</span>
                    </div>`).join('')}
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-row total"><span>Total</span><span>&#8369;${total.toFixed(2)}</span></div>
            <div class="receipt-row"><span>Payment</span><span>${esc(paymentMethod)}</span></div>
            ${paymentMethod === 'Cash' ? `
            <div class="receipt-row"><span>Cash</span><span>&#8369;${parseFloat(cash).toFixed(2)}</span></div>
            <div class="receipt-row"><span>Change</span><span>&#8369;${parseFloat(change).toFixed(2)}</span></div>` : ''}
        </div>
    `;
    const modal = document.getElementById('receiptModal');
    modal.style.display = 'flex';
    modal.classList.add('active');
}

// ── Events (delegation) ───────────────────────────────────────────────────
function setupEvents() {
    // Product tile clicks
    document.getElementById('productsGrid').addEventListener('click', e => {
        const tile = e.target.closest('.product-tile');
        if (tile && !tile.classList.contains('out-of-stock')) addToCart(tile.dataset.id);
    });

    // Cart actions
    document.getElementById('cartItems').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'inc')    changeQty(id, 1);
        if (btn.dataset.action === 'dec')    changeQty(id, -1);
        if (btn.dataset.action === 'remove') removeFromCart(id);
    });

    // Clear cart
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);

    // Payment method
    document.getElementById('paymentBtns').addEventListener('click', e => {
        const btn = e.target.closest('.pay-btn');
        if (!btn) return;
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPayment = btn.dataset.method;
        document.getElementById('cashSection').style.display = selectedPayment === 'Cash' ? 'block' : 'none';
        updateChange();
    });

    // Cash input
    document.getElementById('cashReceived').addEventListener('input', updateChange);

    // Process sale
    document.getElementById('processBtn').addEventListener('click', processSale);

    // New transaction
    document.getElementById('newTxnBtn').addEventListener('click', () => {
        const modal = document.getElementById('receiptModal');
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.getElementById('cashReceived').value = '';
        updateChange();
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        renderProducts(products.filter(p => p.name.toLowerCase().includes(q)));
    });
}

function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.logout = () => { window.location.href = 'index.html'; };
