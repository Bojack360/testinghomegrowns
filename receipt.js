// ============================================================
// Shared POS receipt module — used by pos.js and reports.js so
// the receipt layout stays identical everywhere.
// ============================================================

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Receipt number, e.g. HG-20260807-153012-482
export function generateReceiptNo(date = new Date()) {
    const p = n => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`
                + `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
    const rand = Math.floor(Math.random() * 900 + 100);
    return `HG-${stamp}-${rand}`;
}

const peso = n => '₱' + (Number(n) || 0).toFixed(2);

// data: { receiptNo, dateStr, cashier, payment, items:[{name, qty, price, subtotal}],
//         subtotal, discount, discountLabel, total }
export function buildReceiptHTML(data) {
    const items = (data.items || []).map(i => {
        const unit = i.price != null ? Number(i.price) : (Number(i.subtotal) / Math.max(1, Number(i.qty)));
        const line = i.subtotal != null ? Number(i.subtotal) : unit * Number(i.qty);
        return `
            <div class="rc-item">
                <div class="rc-item-name">${esc(i.name)}</div>
                <div class="rc-item-line">
                    <span>${Number(i.qty)} &times; ${peso(unit)}</span>
                    <span>${peso(line)}</span>
                </div>
            </div>`;
    }).join('');

    const showDisc = Number(data.discount) > 0;

    return `
        <div class="receipt" id="printableReceipt">
            <div class="rc-head">
                <img src="assets/images/Logo.png" alt="The Homegrowns" class="rc-logo">
                <div class="rc-brand">THE HOMEGROWNS</div>
                <div class="rc-title">Official Sales Receipt</div>
            </div>

            <div class="rc-meta">
                <div><span>Receipt No:</span><span>${esc(data.receiptNo)}</span></div>
                <div><span>Date:</span><span>${esc(data.dateStr)}</span></div>
                <div><span>Cashier:</span><span>${esc(data.cashier || 'Admin')}</span></div>
                <div><span>Payment:</span><span>${esc(data.payment || 'Cash')}</span></div>
            </div>

            <div class="rc-divider"></div>

            <div class="rc-col-head">
                <span>Item</span><span>Amount</span>
            </div>
            <div class="rc-items">${items}</div>

            <div class="rc-divider"></div>

            ${showDisc ? `
            <div class="rc-row"><span>Subtotal</span><span>${peso(data.subtotal)}</span></div>
            <div class="rc-row"><span>${esc(data.discountLabel || 'Discount')}</span><span>-${peso(data.discount)}</span></div>
            ` : ''}
            <div class="rc-row rc-total"><span>TOTAL</span><span>${peso(data.total)}</span></div>

            <div class="rc-divider"></div>
            <div class="rc-thanks">Thank you for your purchase!</div>
        </div>`;
}

// Reconstruct receipt data from a stored pos_transactions row (for the Reports re-view).
// Discount is inferred from the difference between item subtotals and the stored total.
export function receiptDataFromTransaction(txn) {
    const items = Array.isArray(txn.items) ? txn.items : [];
    const subtotal = items.reduce((s, i) => s + (Number(i.subtotal) || Number(i.price) * Number(i.qty) || 0), 0);
    const total = Number(txn.total) || 0;
    const discount = Math.max(0, Math.round((subtotal - total) * 100) / 100);
    return {
        receiptNo: txn.receipt_number || '—',
        dateStr: txn.created_at
            ? new Date(txn.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
            : '—',
        cashier: txn.cashier || 'Admin',
        payment: txn.payment_method || 'Cash',
        items,
        subtotal,
        discount,
        discountLabel: 'Discount',
        total,
    };
}
