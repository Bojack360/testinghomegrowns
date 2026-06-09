const SIZES = {
    'Mandog Shirt': ['S', 'M', 'L', 'XL', '2XL'],
    'Mandag Shirt': ['S', 'M', 'L', 'XL'],
    'Popoy Shirt': ['S', 'M', 'L', 'XL'],
    'Homegrowns T-shirt': ['S', 'M', 'L', 'XL', '2XL'],
    'Migo Nico Shirt': ['S', 'M', 'L', 'XL'],
    'Chupilading': ['S', 'M', 'L', 'XL'],
    'Kianegi': ['S', 'M', 'L', 'XL', '2XL'],
    'Marvino Gurobino': ['One Size'],
};

let cart = [];  
let currentItem = null; 
let currentSize = null;


function formatPrice(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function getTotalItems() {
    return cart.reduce((total, item) => total + item.qty, 0);
}

function getTotalPrice() {
    return cart.reduce((total, item) => total + item.price * item.qty, 0);
}

function openSizeModal(name, price, img) {
    currentItem = { name, price: Number(price), img };

    const sizes = SIZES[name] || ['S', 'M', 'L', 'XL'];
    currentSize = sizes[0]; 
    document.getElementById('sm-img').src = img;
    document.getElementById('sm-name').textContent = name;
    document.getElementById('sm-price').textContent = formatPrice(price);

    document.getElementById('sm-chips').innerHTML = sizes.map((size, index) => `
        <div onclick="selectSize('${size}', this)" style="
            background: ${index === 0 ? 'rgba(243,156,18,0.15)' : 'rgba(255,255,255,0.06)'};
            border: 1.5px solid ${index === 0 ? '#f39c12' : 'rgba(255,255,255,0.18)'};
            border-radius: 7px; padding: 7px 16px;
            font-size: 0.82rem; font-weight: 700; cursor: pointer;
            color: ${index === 0 ? '#f39c12' : '#aaa'};
        ">${size}</div>
    `).join('');

    document.getElementById('sizeModal').style.display = 'block';
}

function selectSize(size, clickedButton) {
    currentSize = size;

    document.querySelectorAll('#sm-chips div').forEach(btn => {
        btn.style.borderColor = 'rgba(255,255,255,0.18)';
        btn.style.color = '#aaa';
        btn.style.background = 'rgba(255,255,255,0.06)';
    });

    clickedButton.style.borderColor = '#f39c12';
    clickedButton.style.color = '#f39c12';
    clickedButton.style.background = 'rgba(243,156,18,0.15)';
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

function addToCart(name, price, img, size) {
    const key = name + '__' + size;
    const existing = cart.find(item => item.key === key);

    if (existing) {
        existing.qty++;
    } else {
        cart.push({ key, name, price, img, size, qty: 1 });
    }

    updateCartCounter();
    renderCartItems();
}

function removeFromCart(key) {
    cart = cart.filter(item => item.key !== key);
    updateCartCounter();
    renderCartItems();
}

function changeQty(key, change) {
    const item = cart.find(item => item.key === key);
    if (!item) return;

    item.qty += change;

    if (item.qty <= 0) {
        removeFromCart(key);
    } else {
        updateCartCounter();
        renderCartItems();
    }
}

function updateCartCounter() {
    const counter = document.getElementById('countercart');
    if (counter) counter.textContent = getTotalItems();
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    if (!container) return;

    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = formatPrice(getTotalPrice());

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#ccc; padding:18px 0;">Your cart is empty.</p>';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.img}" alt="${item.name}">
            <div class="item-details">
                <h4>${item.name}</h4>
                <p style="color:#aaa; font-size:0.75rem; margin:2px 0 4px; font-weight:400;">
                    Size: <strong style="color:#f39c12;">${item.size}</strong>
                </p>
                <p>${formatPrice(item.price * item.qty)}</p>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px; margin:0 10px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px; margin:0 10px;">
                <div style="display:flex; align-items:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px; overflow:hidden; height:40px;">
                    <button onclick="changeQty('${item.key}', -1)" style="width:44px; height:100%; background:transparent; border:none; color:rgba(255,255,255,0.8); font-size:1.3rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">−</button>
                    <div style="width:1px; height:20px; background:rgba(255,255,255,0.15);"></div>
                    <span style="min-width:40px; text-align:center; font-weight:600; font-size:0.95rem; color:white; display:flex; align-items:center; justify-content:center;">${item.qty}</span>
                    <div style="width:1px; height:20px; background:rgba(255,255,255,0.15);"></div>
                    <button onclick="changeQty('${item.key}', 1)" style="width:44px; height:100%; background:transparent; border:none; color:rgba(255,255,255,0.8); font-size:1.3rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">+</button>
                </div>
            </div>
            </div>
            <button class="remove-btn" onclick="removeFromCart('${item.key}')">Remove</button>
        </div>
    `).join('');
}


function shoppingCart() {
    const modal = document.getElementById('cartcart');
    const isOpen = modal.style.display === 'block';
    modal.style.display = isOpen ? 'none' : 'block';
}


function showConfirmation() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    const phone = document.getElementById('custPhone').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const desc = document.getElementById('custDesc').value.trim();

    if (!phone) {
        alert('Please enter your phone number before checking out.');
        return;
    }

    const itemLines = cart.map(item =>
        `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${item.name} <span style="color:#aaa; font-size:0.8rem;">(${item.size}) × ${item.qty}</span></span>
            <span style="color:#f39c12; font-weight:700;">${formatPrice(item.price * item.qty)}</span>
         </div>`
    ).join('');

    document.getElementById('summary').innerHTML = `
        ${phone ? `<div style="margin-bottom:4px;"><strong>Phone:</strong> ${phone}</div>` : ''}
        ${email ? `<div style="margin-bottom:4px;"><strong>Email:</strong> ${email}</div>` : ''}
        ${desc ? `<div style="margin-bottom:10px;"><strong>Pickup Info:</strong> ${desc}</div>` : ''}
        <hr style="border:none; border-top:1px solid #444; margin:10px 0;">
        ${itemLines}
        <hr style="border:none; border-top:1px solid #444; margin:10px 0;">
        <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1rem;">
            <span>Total Payment at Pickup</span>
            <span style="color:#f39c12;">${formatPrice(getTotalPrice())}</span>
        </div>
        <p style="margin-top:12px; font-size:0.78rem; color:#6ee8a0;">
            Pay cash when you pick up at the cafe.
        </p>
    `;

    document.getElementById('cartcart').style.display = 'none';
    document.getElementById('confirmModal').style.display = 'block';
}

function closeConfirmation() {
    document.getElementById('confirmModal').style.display = 'none';
    document.getElementById('cartcart').style.display = 'block';
}


function finalizeOrder() {
    document.getElementById('confirmModal').style.display = 'none';

    const order = {
        id: '#ORD-' + Date.now().toString().slice(-6),
        dateSubmitted: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        email: document.getElementById('custEmail').value.trim(),
        phone: document.getElementById('custPhone').value.trim(),
        pickupDesc: document.getElementById('custDesc').value.trim(),
        items: [...cart],
        total: getTotalPrice(),
        status: 'Pending',
        dateToClaim: null
    };

    const existingOrders = JSON.parse(localStorage.getItem('homegrowns_orders') || '[]');
    existingOrders.push(order);
    localStorage.setItem('homegrowns_orders', JSON.stringify(existingOrders));

    const popup = document.createElement('div');
    popup.id = 'successOverlay';
    popup.className = 'shoppingcart';
    popup.style.cssText = 'display:block; z-index:4000;';

    const itemRows = cart.map(item =>
        `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.82rem;">
            <span style="color:#ccc;">${item.name} (${item.size}) × ${item.qty}</span>
            <span style="color:white; font-weight:700;">${formatPrice(item.price * item.qty)}</span>
         </div>`
    ).join('');

    popup.innerHTML = `
        <div class="cartclass" style="max-width:440px; margin:5% auto; text-align:center;">

            <div style="width:70px; height:70px; border-radius:50%; background:rgba(46,204,113,0.12); border:2px solid #2ecc71; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>

            <h2 style="color:#f39c12; letter-spacing:2px; margin:0 0 8px;">Order Confirmed!</h2>
            <p style="color:#aaa; font-size:0.85rem; margin:0 0 16px;">
                Your pre-order is reserved.<br>CASH ONLY.
            </p>

            <div style="text-align:left; background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:20px;">
                ${itemRows}
                <hr style="border:none; border-top:1px solid #444; margin:8px 0;">
                <div style="display:flex; justify-content:space-between; font-weight:700;">
                    <span>Total Payment at Pickup</span>
                    <span style="color:#f39c12;">${formatPrice(getTotalPrice())}</span>
                </div>
            </div>

            <button class="confirm" onclick="closeSuccess()" style="width:100%; padding:13px; font-size:1rem;">
                Done
            </button>
        </div>
    `;

    document.body.appendChild(popup);

    cart = [];
    updateCartCounter();
    renderCartItems();
    ['custEmail', 'custPhone', 'custDesc'].forEach(id => {
        document.getElementById(id).value = '';
    });
}

function closeSuccess() {
    document.getElementById('successOverlay').remove();
}

function buildSizeModal() {
    const modal = document.createElement('div');
    modal.id = 'sizeModal';
    modal.className = 'shoppingcart';
    modal.style.zIndex = '3000';

    modal.innerHTML = `
        <div class="cartclass" style="max-width:360px; margin:8% auto; padding:28px; animation:slideDown 0.28s ease-out;">
            <div class="cartheader">
                <h2 style="margin:0; font-size:1.15rem;">Select Size</h2>
                <span class="close" onclick="closeSizeModal()">&times;</span>
            </div>
            <div style="text-align:center; padding:12px 0;">
                <img id="sm-img" src="" alt="" style="width:100px; height:100px; object-fit:contain; background:rgba(255,255,255,0.06); border-radius:10px; padding:8px; display:block; margin:0 auto 10px;">
                <div id="sm-name" style="font-weight:800; font-size:1rem; color:white; margin-bottom:4px;"></div>
                <div id="sm-price" style="color:#f39c12; font-weight:900; font-size:1rem; margin-bottom:18px;"></div>
                <div id="sm-chips" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-bottom:22px;"></div>
            </div>
            <div class="cartfooter" style="margin-top:0;">
                <button class="cancel" onclick="closeSizeModal()">Cancel</button>
                <button class="confirm" onclick="confirmSize()">Add To Cart</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeSizeModal(); });
}
document.addEventListener('DOMContentLoaded', () => {
    buildSizeModal();

    document.querySelectorAll('.balhin').forEach(button => {
        button.addEventListener('click', function (e) {
            e.stopPropagation();
            openSizeModal(this.dataset.name, this.dataset.price, this.dataset.img);
        });
    });

    renderCartItems();
    updateCartCounter();
});

const outstock = document.getElementById("outofstock");

outstock.addEventListener("click", function(event){
    event.preventDefault();
    event.stopPropagation();
});