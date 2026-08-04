import { supabase } from './supabaseConfig.js';
import { requireAdmin, adminLogout } from './auth.js';

// ==========================================
// GLOBAL STATE
// ==========================================
let products      = [];
let orders        = [];
let selectedOrder = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!(await requireAdmin())) return;   // block non-admins before loading data
    await loadProducts();
    await loadOrders();
    renderOrdersTable();
    renderProductsGrid();
    updateStats();
});

// ==========================================
// DATA LOADING
// ==========================================
async function loadProducts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        products = data || [];
        console.log(`Loaded ${products.length} products`);
    } catch (error) {
        console.error('Failed to load products:', error);
        alert('Could not load products. Check your connection.');
    }
}

async function loadOrders() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        orders = (data || []).map(row => ({
            ...row,
            createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : 'Unknown'
        }));
        console.log(`Loaded ${orders.length} orders`);
    } catch (error) {
        console.error('Failed to load orders:', error);
    }
}

// ==========================================
// STATS
// ==========================================
function updateStats() {
    document.getElementById('pending-count').innerText  = orders.filter(o => o.status === 'Pending').length;
    document.getElementById('approved-count').innerText = orders.filter(o => o.status === 'Approved').length;
    document.getElementById('declined-count').innerText = orders.filter(o => o.status === 'Declined').length;
    document.getElementById('total-count').innerText    = orders.length;
}

// ==========================================
// ORDERS TABLE (paginated)
// ==========================================
const ORDERS_PAGE_SIZE = 10;
let ordersPage = 1;

function renderOrdersTable() {
    renderOrders();
}

// ── Filter helpers ──────────────────────────────────────────────────────────
function orderMatchesStatus(order, status) {
    if (status === 'all') return true;
    const s = String(order.status || '');
    // "Approved" orders are shown as SOLD, so the Sold filter also matches them.
    if (status === 'Sold') return s === 'Approved' || s === 'Sold';
    return s === status;
}

function orderMatchesCategory(order, cat) {
    if (cat === 'all') return true;
    const items = order.items || [];
    return items.some(it => {
        const prod = products.find(p => p.name === it.name);
        if (cat === 'others') return !prod;                       // unknown product -> Others
        const c = prod ? String(prod.category || 'shirt').toLowerCase() : null;
        return c === cat;                                          // 'shirt' or 'accessory'
    });
}

function orderMatchesSearch(order, q) {
    if (!q) return true;
    const idShort   = ('#' + order.id.toString().slice(-6)).toLowerCase();
    const itemNames = (order.items || []).map(i => i.name).join(' ');
    const hay = [idShort, order.id, order.customer_email, itemNames]
        .map(x => String(x || '').toLowerCase()).join(' ');
    return hay.includes(q);
}

function getFilteredOrders() {
    const status = document.getElementById('status-filter').value;
    const cat    = document.getElementById('category-filter').value;
    const from   = document.getElementById('date-from').value;
    const to     = document.getElementById('date-to').value;
    const q      = document.getElementById('order-search').value.trim().toLowerCase();

    // `orders` is already loaded newest-first.
    return orders.filter(o => {
        if (!orderMatchesStatus(o, status)) return false;
        if (!orderMatchesCategory(o, cat))  return false;
        if (from && new Date(o.created_at) < new Date(from)) return false;
        if (to   && new Date(o.created_at) > new Date(to + 'T23:59:59')) return false;
        if (!orderMatchesSearch(o, q)) return false;
        return true;
    });
}

function renderOrders() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    const filtered = getFilteredOrders();
    const total    = filtered.length;
    const pages    = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
    if (ordersPage > pages) ordersPage = pages;
    if (ordersPage < 1) ordersPage = 1;

    const startIdx = (ordersPage - 1) * ORDERS_PAGE_SIZE;
    const pageRows = filtered.slice(startIdx, startIdx + ORDERS_PAGE_SIZE);

    tbody.innerHTML = '';

    if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No orders found</td></tr>';
        renderOrdersPagination(0, 1, 0, 0);
        return;
    }

    pageRows.forEach(order => {
        const statusClass = order.status.toLowerCase();
        const firstItem   = (order.items && order.items[0]) || {};
        const row         = document.createElement('tr');

        row.innerHTML = `
            <td>#${order.id.toString().slice(-6).toUpperCase()}</td>
            <td>${order.createdAt}</td>
            <td>${order.customer_email || 'N/A'}</td>
            <td>${firstItem.name || 'Multiple Items'}</td>
            <td>${firstItem.size || '-'}</td>
            <td>${firstItem.qty  || '-'}</td>
            <td>₱${Number(order.total).toLocaleString()}</td>
            <td><span class="status-badge ${statusClass}">${order.status === 'Approved' ? 'SOLD' : order.status}</span></td>
            <td>
                <button class="action-btn btn-view" onclick="viewOrder('${order.id}')">View</button>
                ${order.status === 'Pending' ? `
                    <button class="action-btn btn-approve" onclick="approveOrderById('${order.id}')">&#10003;</button>
                    <button class="action-btn btn-decline" onclick="declineOrderById('${order.id}')">&#10007;</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });

    renderOrdersPagination(total, pages, startIdx, pageRows.length);
}

function renderOrdersPagination(total, pages, startIdx, shown) {
    const info = document.getElementById('ordersInfo');
    const pag  = document.getElementById('ordersPagination');
    if (!info || !pag) return;

    info.textContent = total === 0
        ? 'Showing 0 records'
        : `Showing ${startIdx + 1}–${startIdx + shown} of ${total} records`;

    pag.innerHTML = '';
    if (pages <= 1) return;

    const btn = (label, page, { disabled = false, active = false } = {}) => {
        const b = document.createElement('button');
        b.className = 'page-btn' + (active ? ' active' : '');
        b.innerHTML = label;
        b.disabled = disabled;
        if (!disabled && !active) b.addEventListener('click', () => { ordersPage = page; renderOrders(); });
        return b;
    };

    pag.appendChild(btn('&laquo;', 1, { disabled: ordersPage === 1 }));
    pag.appendChild(btn('&lsaquo;', ordersPage - 1, { disabled: ordersPage === 1 }));

    let start = Math.max(1, ordersPage - 2);
    let end   = Math.min(pages, start + 4);
    start = Math.max(1, end - 4);
    for (let p = start; p <= end; p++) {
        pag.appendChild(btn(String(p), p, { active: p === ordersPage }));
    }

    pag.appendChild(btn('&rsaquo;', ordersPage + 1, { disabled: ordersPage === pages }));
    pag.appendChild(btn('&raquo;', pages, { disabled: ordersPage === pages }));
}

// New filter selection resets to page 1.
function applyOrderFilters() {
    ordersPage = 1;
    renderOrders();
}

function clearFilters() {
    document.getElementById('status-filter').value   = 'all';
    document.getElementById('category-filter').value = 'all';
    document.getElementById('date-from').value       = '';
    document.getElementById('date-to').value         = '';
    document.getElementById('order-search').value    = '';
    applyOrderFilters();
}

document.addEventListener('DOMContentLoaded', () => {
    const ids = ['status-filter', 'category-filter', 'date-from', 'date-to'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyOrderFilters);
    });
    const search = document.getElementById('order-search');
    if (search) search.addEventListener('input', applyOrderFilters);
});

// ==========================================
// PRODUCTS GRID
// ==========================================
function renderProductsGrid() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#ccc; grid-column:1/-1;">No products found</p>';
        return;
    }

    products.forEach(product => {
        const imgSrc = product.image_url || 'assets/images/whitetee.png';
        const stock  = Number(product.stock_quantity) || 0;
        const stockClass = stock <= 0 ? 'stock-out' : (stock <= 5 ? 'stock-low' : '');
        const category = (product.category || 'shirt').toLowerCase();

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${imgSrc}" alt="${product.name}" onerror="this.src='assets/images/whitetee.png'">
            <h3>${product.name}</h3>
            <p class="price">₱${Number(product.price).toLocaleString()}</p>
            <div class="cat-control">
                <span class="cat-label">Category:</span>
                <select class="cat-select" onchange="setCategory('${product.id}', this.value)">
                    <option value="shirt"${category === 'shirt' ? ' selected' : ''}>Shirt</option>
                    <option value="accessory"${category === 'accessory' ? ' selected' : ''}>Accessory</option>
                </select>
            </div>
            <div class="stock-control">
                <span class="stock-label ${stockClass}">Stock: ${stock}${stock <= 0 ? ' (Out)' : ''}</span>
                <div class="stock-stepper">
                    <button type="button" title="Remove one" onclick="adjustStock('${product.id}', -1)">&#8722;</button>
                    <input type="text" inputmode="numeric" value="${stock}"
                           onchange="setStock('${product.id}', this.value)"
                           onkeydown="if(event.key==='Enter') this.blur()">
                    <button type="button" title="Add one" onclick="adjustStock('${product.id}', 1)">+</button>
                </div>
            </div>
            <div class="product-actions">
                <button class="btn-delete" onclick="deleteProduct('${product.id}')">Delete</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ==========================================
// CATEGORY MANAGEMENT
// ==========================================
async function setCategory(productId, category) {
    const p = products.find(pr => String(pr.id) === String(productId));
    if (p) p.category = category;   // optimistic

    try {
        const { error } = await supabase
            .from('products')
            .update({ category })
            .eq('id', productId);
        if (error) throw error;
    } catch (error) {
        console.error('Failed to update category:', error);
        alert('Failed to update category. Reloading.');
        await loadProducts();
        renderProductsGrid();
    }
}

// ==========================================
// STOCK MANAGEMENT
// ==========================================
async function updateStock(productId, newStock) {
    newStock = Math.max(0, Math.floor(Number(newStock) || 0));

    // Optimistic update: reflect the change locally + in the UI right away
    // so rapid +/- clicks accumulate correctly instead of racing.
    const p = products.find(pr => String(pr.id) === String(productId));
    if (p) { p.stock_quantity = newStock; p.in_stock = newStock > 0; }
    renderProductsGrid();

    try {
        const { error } = await supabase
            .from('products')
            .update({ stock_quantity: newStock, in_stock: newStock > 0 })
            .eq('id', productId);
        if (error) throw error;
    } catch (error) {
        console.error('Failed to update stock:', error);
        alert('Failed to update stock. Reloading current stock.');
        await loadProducts();   // pull the real value back on failure
        renderProductsGrid();
    }
}

function adjustStock(productId, delta) {
    const p = products.find(pr => String(pr.id) === String(productId));
    if (!p) return;
    updateStock(productId, (Number(p.stock_quantity) || 0) + delta);
}

function setStock(productId, value) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) { renderProductsGrid(); return; }
    updateStock(productId, n);
}

// ==========================================
// ORDER MODAL
// ==========================================
function viewOrder(orderId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    selectedOrder = order;

    document.getElementById('modal-order-id').textContent       = `#${order.id.toString().slice(-6).toUpperCase()}`;
    document.getElementById('modal-date-submitted').textContent = order.createdAt;
    document.getElementById('modal-email').textContent          = order.customer_email || 'N/A';
    document.getElementById('modal-phone').textContent          = order.customer_phone || 'N/A';
    document.getElementById('modal-desc').textContent           = order.pickup_desc    || 'N/A';
    document.getElementById('modal-total').textContent          = `₱${Number(order.total).toLocaleString()}`;
    document.getElementById('modal-status').textContent         = order.status === 'Approved' ? 'SOLD' : order.status;
    document.getElementById('modal-status').className           = `detail-value status-badge ${order.status.toLowerCase()}`;
    document.getElementById('modal-date-claim').textContent     = order.date_to_claim  || 'Not set';

    const itemsHtml = (order.items || []).map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; padding:8px; background:rgba(255,255,255,0.05); border-radius:6px;">
            <div><strong>${item.name}</strong> (${item.size}) &times; ${item.qty}</div>
            <div style="color:#f39c12; font-weight:bold;">₱${(item.price * item.qty).toLocaleString()}</div>
        </div>
    `).join('');
    document.getElementById('modal-items').innerHTML = itemsHtml || '<p>No items</p>';

    const modalActions = document.querySelector('#orderModal .modal-actions');
    if (modalActions) {
        let buttons = order.status === 'Pending'
            ? `<button class="btn-approve" onclick="updateOrderStatus('${order.id}', 'Approved')">&#10003; Approve</button>
               <button class="btn-decline" onclick="updateOrderStatus('${order.id}', 'Declined')">&#10007; Decline</button>`
            : `<button class="btn-revert"  onclick="revertOrder('${order.id}')">&#8617; Revert to Pending</button>`;
        buttons += `<button class="btn-confirm" onclick="closeModal()">Close</button>`;
        modalActions.innerHTML = buttons;
    }

    document.getElementById('orderModal').style.display = 'flex';
}

async function approveOrderById(orderId) {
    if (!confirm('Approve this order?')) return;
    await updateOrderStatus(orderId, 'Approved');
}

async function declineOrderById(orderId) {
    if (!confirm('Decline this order?')) return;
    await updateOrderStatus(orderId, 'Declined');
}

async function approveOrder() {
    if (selectedOrder) await updateOrderStatus(selectedOrder.id, 'Approved');
}

async function declineOrder() {
    if (selectedOrder) await updateOrderStatus(selectedOrder.id, 'Declined');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);
        if (error) throw error;
        alert(`Order ${newStatus} successfully!`);
        closeModal();
        await loadOrders();
        renderOrdersTable();
        updateStats();
    } catch (error) {
        console.error('Failed to update order:', error);
        alert('Failed to update order. Please try again.');
    }
}

async function revertOrder(orderId) {
    if (!confirm('Revert this order to Pending?')) return;
    try {
        const { error } = await supabase
            .from('orders')
            .update({
                status:      'Pending',
                updated_at:  new Date().toISOString(),
                reverted_at: new Date().toISOString()
            })
            .eq('id', orderId);
        if (error) throw error;
        alert('Order reverted to Pending!');
        closeModal();
        await loadOrders();
        renderOrdersTable();
        updateStats();
    } catch (error) {
        console.error('Failed to revert order:', error);
        alert('Failed to revert order. Please try again.');
    }
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
    selectedOrder = null;
}

// ==========================================
// PRODUCT ACTIONS
// ==========================================
async function deleteProduct(productId) {
    if (!confirm('Delete this product permanently?')) return;
    try {
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if (error) throw error;
        alert('Product deleted!');
        await loadProducts();
        renderProductsGrid();
    } catch (error) {
        console.error('Failed to delete product:', error);
        alert('Failed to delete product.');
    }
}

function openAddProductModal() {
    document.getElementById('addProductModal').style.display = 'flex';
}

function closeAddProductModal() {
    document.getElementById('addProductModal').style.display = 'none';
    ['new-product-name','new-product-price','new-product-stock','new-product-sizes','new-product-desc']
        .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('new-product-category').value = 'shirt';
    document.getElementById('sizes-input-row').style.display = '';   // restore sizes field
    document.getElementById('new-product-img-file').value = '';
    document.getElementById('file-name-display').textContent = 'No file chosen';
    document.getElementById('product-img-preview').src = '';
    document.getElementById('img-preview-row').style.display = 'none';
}

// When the admin picks a category in the Add-Product form, hide the "Available
// Sizes" field for accessories (they don't use sizes).
function onCategoryChange() {
    const isAccessory = document.getElementById('new-product-category').value === 'accessory';
    document.getElementById('sizes-input-row').style.display = isAccessory ? 'none' : '';
}

function previewProductImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('file-name-display').textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('product-img-preview').src = e.target.result;
        document.getElementById('img-preview-row').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

async function addNewProduct() {
    const name        = document.getElementById('new-product-name').value.trim();
    const price       = Number(document.getElementById('new-product-price').value);
    const category    = document.getElementById('new-product-category').value;
    const stockInput  = document.getElementById('new-product-stock').value.trim();
    const sizesStr    = document.getElementById('new-product-sizes').value.trim();
    const description = document.getElementById('new-product-desc').value.trim();
    const fileInput   = document.getElementById('new-product-img-file');
    const file        = fileInput.files[0];

    if (!name || !price) {
        alert('Please fill in at least the product name and price.');
        return;
    }

    const stock = stockInput === '' ? 50 : Math.max(0, Math.floor(Number(stockInput) || 0));

    // Accessories have no sizes; shirts use the entered sizes (default S–XL).
    const sizes = category === 'accessory'
        ? []
        : (sizesStr ? sizesStr.split(',').map(s => s.trim()).filter(s => s) : ['S', 'M', 'L', 'XL']);

    let image_url = 'assets/images/whitetee.png';

    if (file) {
        image_url = await readFileAsDataURL(file);
    }

    try {
        const { error } = await supabase.from('products').insert({
            name,
            price,
            category,
            image_url,
            sizes,
            description:    description || '',
            stock_quantity: stock,
            in_stock:       stock > 0,
            created_at:     new Date().toISOString()
        });
        if (error) throw error;
        alert('Product added successfully!');
        closeAddProductModal();
        await loadProducts();
        renderProductsGrid();
    } catch (error) {
        console.error('Failed to add product:', error);
        alert('Failed to add product. Please try again.');
    }
}

// ==========================================
// EXPOSE TO GLOBAL SCOPE
// ==========================================
window.viewOrder           = viewOrder;
window.approveOrder        = approveOrder;
window.declineOrder        = declineOrder;
window.approveOrderById    = approveOrderById;
window.declineOrderById    = declineOrderById;
window.updateOrderStatus   = updateOrderStatus;
window.revertOrder         = revertOrder;
window.closeModal          = closeModal;
window.deleteProduct       = deleteProduct;
window.adjustStock         = adjustStock;
window.setStock            = setStock;
window.setCategory         = setCategory;
window.onCategoryChange    = onCategoryChange;
window.openAddProductModal  = openAddProductModal;
window.closeAddProductModal = closeAddProductModal;
window.addNewProduct        = addNewProduct;
window.previewProductImage  = previewProductImage;
window.clearFilters         = clearFilters;
window.logout = adminLogout;

