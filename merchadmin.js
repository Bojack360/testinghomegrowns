import { supabase } from './supabaseConfig.js';

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
// ORDERS TABLE
// ==========================================
function renderOrdersTable() {
    renderFilteredOrders(orders);
}

function renderFilteredOrders(filteredOrders) {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No orders found</td></tr>';
        return;
    }

    filteredOrders.forEach(order => {
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
}

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

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${imgSrc}" alt="${product.name}" onerror="this.src='assets/images/whitetee.png'">
            <h3>${product.name}</h3>
            <p class="price">₱${Number(product.price).toLocaleString()}</p>
            <p class="stock">Stock: ${product.stock_quantity}</p>
            <div class="product-actions">
                <button class="btn-delete" onclick="deleteProduct('${product.id}')">Delete</button>
            </div>
        `;
        grid.appendChild(card);
    });
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
    ['new-product-name','new-product-price','new-product-sizes','new-product-desc']
        .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('new-product-img-file').value = '';
    document.getElementById('file-name-display').textContent = 'No file chosen';
    document.getElementById('product-img-preview').src = '';
    document.getElementById('img-preview-row').style.display = 'none';
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
    const sizesStr    = document.getElementById('new-product-sizes').value.trim();
    const description = document.getElementById('new-product-desc').value.trim();
    const fileInput   = document.getElementById('new-product-img-file');
    const file        = fileInput.files[0];

    if (!name || !price) {
        alert('Please fill in at least the product name and price.');
        return;
    }

    const sizes = sizesStr
        ? sizesStr.split(',').map(s => s.trim()).filter(s => s)
        : ['S', 'M', 'L', 'XL'];

    let image_url = 'assets/images/whitetee.png';

    if (file) {
        image_url = await readFileAsDataURL(file);
    }

    try {
        const { error } = await supabase.from('products').insert({
            name,
            price,
            image_url,
            sizes,
            description:    description || '',
            stock_quantity: 50,
            in_stock:       true,
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
// FILTERS
// ==========================================
function clearFilters() {
    document.getElementById('status-filter').value = 'all';
    document.getElementById('date-filter').value   = '';
    renderOrdersTable();
}

document.addEventListener('DOMContentLoaded', () => {
    const statusFilter = document.getElementById('status-filter');
    const dateFilter   = document.getElementById('date-filter');

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            const status   = statusFilter.value;
            const filtered = status === 'all' ? orders : orders.filter(o => o.status === status);
            renderFilteredOrders(filtered);
        });
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', () => {
            if (!dateFilter.value) { renderOrdersTable(); return; }
            const filtered = orders.filter(o => o.createdAt.startsWith(dateFilter.value));
            renderFilteredOrders(filtered);
        });
    }
});

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
window.openAddProductModal  = openAddProductModal;
window.closeAddProductModal = closeAddProductModal;
window.addNewProduct        = addNewProduct;
window.previewProductImage  = previewProductImage;
window.clearFilters        = clearFilters;
window.logout = () => { window.location.href = 'login.html'; };

