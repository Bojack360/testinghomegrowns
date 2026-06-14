import { supabase } from './supabaseConfig.js';

// ── State ─────────────────────────────────────────────────────────────────
let posts           = [];
let reactionOptions = [];
let allReactions    = [];
let viewingPostId   = null;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadAll();
    setupPreviewListeners();
});

// ── Data ──────────────────────────────────────────────────────────────────
async function loadAll() {
    const [{ data: p }, { data: opts }, { data: reacts }] = await Promise.all([
        supabase.from('newsfeed_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('newsfeed_reaction_options').select('*').order('created_at', { ascending: true }),
        supabase.from('newsfeed_reactions').select('*')
    ]);

    posts           = p     || [];
    reactionOptions = opts  || [];
    allReactions    = reacts || [];

    renderStats();
    renderTable();
    renderStickers();
}

// ── Stats ─────────────────────────────────────────────────────────────────
function renderStats() {
    document.getElementById('statPosts').textContent     = posts.length;
    document.getElementById('statReactions').textContent = allReactions.length;
    document.getElementById('statStickers').textContent  = reactionOptions.length;
}

// ── Posts Table ───────────────────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('postsTableBody');
    const noMsg = document.getElementById('noPostsMsg');

    if (posts.length === 0) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        return;
    }
    noMsg.style.display = 'none';

    tbody.innerHTML = posts.map(post => {
        const reactionCount = allReactions.filter(r => r.post_id === post.id).length;
        const date          = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const caption       = esc(post.caption || '');
        const shortCaption  = caption.length > 60 ? caption.slice(0, 60) + '…' : caption;
        const mediaType     = post.media_type || 'none';

        let thumbHtml = `<div class="post-thumb-placeholder">—</div>`;
        if (post.media_url && mediaType !== 'none') {
            if (mediaType === 'video') {
                thumbHtml = `<div class="post-thumb-placeholder" title="Video">▶</div>`;
            } else {
                thumbHtml = `<img class="post-thumb" src="${esc(post.media_url)}" alt="thumb" onerror="this.outerHTML='<div class=post-thumb-placeholder>?</div>'">`;
            }
        }

        const badgeClass = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : 'none';
        const badgeText  = mediaType === 'none' ? 'text only' : mediaType;

        return `
            <tr>
                <td>${thumbHtml}</td>
                <td><span class="caption-cell" title="${caption}">${shortCaption || '<em>no caption</em>'}</span></td>
                <td><span class="media-badge ${badgeClass}">${badgeText}</span></td>
                <td>${reactionCount}</td>
                <td>${date}</td>
                <td>
                    <button class="action-btn btn-view" onclick="viewPost('${post.id}')">View</button>
                    <button class="action-btn btn-del" onclick="confirmDeletePost('${post.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ── Stickers Grid ─────────────────────────────────────────────────────────
function renderStickers() {
    const grid = document.getElementById('stickersGrid');
    if (reactionOptions.length === 0) {
        grid.innerHTML = '<p class="no-stickers">No stickers yet. Add some above!</p>';
        return;
    }
    grid.innerHTML = reactionOptions.map(opt => `
        <div class="sticker-card">
            <img src="${esc(opt.media_url)}" alt="${esc(opt.label || 'sticker')}" onerror="this.style.opacity='0.2'">
            <p class="sticker-label" title="${esc(opt.label || '')}">${esc(opt.label || 'Sticker')}</p>
            <button class="sticker-del" onclick="deleteSticker('${opt.id}')">Remove</button>
        </div>
    `).join('');
}

// ── Add Post Modal ────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById('newCaption').value  = '';
    const fileInput = document.getElementById('newMediaFile');
    fileInput.value = '';
    document.getElementById('fileUploadText').textContent = 'Choose image or video…';
    document.getElementById('mediaPreview').innerHTML     = '';
    document.querySelector('.file-upload-label').classList.remove('has-file');
    showOverlay('addModal');
}
window.openAddModal = openAddModal;

function closeAddModal() { hideOverlay('addModal'); }
window.closeAddModal = closeAddModal;

function setupPreviewListeners() {
    // Post file picker
    document.getElementById('newMediaFile').addEventListener('change', e => {
        const file  = e.target.files[0];
        const label = document.querySelector('.file-upload-label');
        const preview = document.getElementById('mediaPreview');

        if (!file) {
            label.classList.remove('has-file');
            document.getElementById('fileUploadText').textContent = 'Choose image or video…';
            preview.innerHTML = '';
            return;
        }

        label.classList.add('has-file');
        document.getElementById('fileUploadText').textContent = file.name;

        const objectUrl = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
            preview.innerHTML = `<video src="${objectUrl}" controls style="max-width:100%;max-height:220px;border-radius:8px;"></video>`;
        } else {
            preview.innerHTML = `<img src="${objectUrl}" alt="preview" style="max-width:100%;max-height:220px;border-radius:8px;">`;
        }
    });

    // Sticker URL preview
    document.getElementById('stickerUrl').addEventListener('input', e => {
        const url = e.target.value.trim();
        document.getElementById('stickerPreview').innerHTML = url
            ? `<img src="${esc(url)}" alt="preview" style="max-width:120px;max-height:120px;border-radius:8px;" onerror="this.style.display='none'">`
            : '';
    });
}

async function submitPost() {
    const caption = document.getElementById('newCaption').value.trim();
    const file    = document.getElementById('newMediaFile').files[0];

    if (!caption && !file) {
        alert('Please add a caption or select a media file.');
        return;
    }

    let mediaUrl  = null;
    let mediaType = 'none';

    if (file) {
        const ext  = file.name.split('.').pop().toLowerCase();
        const path = `posts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('newsfeed-media')
            .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
            alert('Upload failed: ' + uploadError.message);
            return;
        }

        const { data: urlData } = supabase.storage.from('newsfeed-media').getPublicUrl(path);
        mediaUrl  = urlData.publicUrl;
        mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    }

    const { error } = await supabase.from('newsfeed_posts').insert({
        caption,
        media_type: mediaType,
        media_url:  mediaUrl,
        created_at: new Date().toISOString()
    });

    if (error) { alert('Error publishing post: ' + error.message); return; }

    closeAddModal();
    await loadAll();
}
window.submitPost = submitPost;

// ── Add Sticker Modal ─────────────────────────────────────────────────────
function openStickerModal() {
    document.getElementById('stickerLabel').value = '';
    document.getElementById('stickerUrl').value   = '';
    document.getElementById('stickerPreview').innerHTML = '';
    showOverlay('stickerModal');
}
window.openStickerModal = openStickerModal;

function closeStickerModal() { hideOverlay('stickerModal'); }
window.closeStickerModal = closeStickerModal;

async function submitSticker() {
    const label    = document.getElementById('stickerLabel').value.trim();
    const mediaUrl = document.getElementById('stickerUrl').value.trim();

    if (!mediaUrl) { alert('Please enter a GIF or image URL.'); return; }

    const { error } = await supabase.from('newsfeed_reaction_options').insert({
        label:      label || null,
        media_url:  mediaUrl,
        created_at: new Date().toISOString()
    });

    if (error) { alert('Error adding sticker: ' + error.message); return; }

    closeStickerModal();
    await loadAll();
}
window.submitSticker = submitSticker;

async function deleteSticker(optionId) {
    if (!confirm('Remove this reaction sticker? Existing reactions using it will also be deleted.')) return;

    const { error } = await supabase.from('newsfeed_reaction_options').delete().eq('id', optionId);
    if (error) { alert('Error deleting sticker: ' + error.message); return; }
    await loadAll();
}
window.deleteSticker = deleteSticker;

// ── View Post Modal ───────────────────────────────────────────────────────
function viewPost(postId) {
    viewingPostId = postId;
    const post    = posts.find(p => p.id === postId);
    if (!post) return;

    const countMap = {};
    allReactions.filter(r => r.post_id === postId).forEach(r => {
        countMap[r.option_id] = (countMap[r.option_id] || 0) + 1;
    });

    let mediaHtml = '';
    if (post.media_url && post.media_type !== 'none') {
        if (post.media_type === 'video') {
            mediaHtml = `<div class="view-post-media"><video src="${esc(post.media_url)}" controls></video></div>`;
        } else {
            mediaHtml = `<div class="view-post-media"><img src="${esc(post.media_url)}" alt="post media" onerror="this.style.display='none'"></div>`;
        }
    }

    const reactionsHtml = reactionOptions.length === 0
        ? '<p style="color:#666;font-size:0.85rem;">No stickers defined yet.</p>'
        : reactionOptions.map(opt => {
            const count = countMap[opt.id] || 0;
            return `
                <div class="view-reaction-item">
                    <img src="${esc(opt.media_url)}" alt="${esc(opt.label || '')}">
                    <span>${esc(opt.label || 'Sticker')}</span>
                    <strong>× ${count}</strong>
                </div>
            `;
        }).join('');

    const date = new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    document.getElementById('viewModalBody').innerHTML = `
        ${mediaHtml}
        <p class="view-post-caption">${esc(post.caption || '')}</p>
        <p style="color:#888;font-size:0.82rem;margin-bottom:16px;">Posted ${date}</p>
        <p class="view-label">Reactions</p>
        <div class="view-reaction-grid">${reactionsHtml}</div>
    `;

    document.getElementById('deletePostBtn').onclick = () => confirmDeletePost(postId);
    showOverlay('viewModal');
}
window.viewPost = viewPost;

function closeViewModal() { hideOverlay('viewModal'); viewingPostId = null; }
window.closeViewModal = closeViewModal;

async function confirmDeletePost(postId) {
    if (!confirm('Permanently delete this post? All reactions will also be removed.')) return;
    const { error } = await supabase.from('newsfeed_posts').delete().eq('id', postId);
    if (error) { alert('Error deleting post: ' + error.message); return; }
    closeViewModal();
    await loadAll();
}
window.confirmDeletePost = confirmDeletePost;

// ── Auth ──────────────────────────────────────────────────────────────────
function logout() { window.location.href = 'index.html'; }
window.logout = logout;

// ── Helpers ───────────────────────────────────────────────────────────────
function showOverlay(id) {
    const el = document.getElementById(id);
    el.style.display = 'flex';
    requestAnimationFrame(() => el.classList.add('active'));
}

function hideOverlay(id) {
    const el = document.getElementById(id);
    el.classList.remove('active');
    el.style.display = 'none';
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
