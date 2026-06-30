import { supabase } from './supabaseConfig.js';
import { initReveal } from './animations.js';

// ── State ─────────────────────────────────────────────────────────────────
let posts           = [];
let reactionOptions = [];
let reactionCounts  = {};
let activePostId    = null;

const picker      = document.getElementById('reactionPicker');
const pickerInner = document.getElementById('pickerInner');

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadAll();
    setupDelegation();
    setupPickerDismiss();
});

// ── Load ──────────────────────────────────────────────────────────────────
async function loadAll() {
    const [{ data: p }, { data: opts }, { data: reacts }] = await Promise.all([
        supabase.from('newsfeed_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('newsfeed_reaction_options').select('*').order('created_at', { ascending: true }),
        supabase.from('newsfeed_reactions').select('*')
    ]);

    posts           = p    || [];
    reactionOptions = opts || [];

    reactionCounts = {};
    (reacts || []).forEach(r => {
        if (!reactionCounts[r.post_id]) reactionCounts[r.post_id] = {};
        reactionCounts[r.post_id][r.option_id] = (reactionCounts[r.post_id][r.option_id] || 0) + 1;
    });

    renderFeed();
}

// ── Render ────────────────────────────────────────────────────────────────
function renderFeed() {
    const feedList = document.getElementById('feedList');

    if (posts.length === 0) {
        feedList.innerHTML = '<p class="loading-text">No posts yet. Check back soon!</p>';
        return;
    }

    feedList.innerHTML = posts.map((post, i) => {
        const mediaHtml = buildMedia(post);
        const tallyHtml = buildTally(post.id);
        const myOption  = localStorage.getItem(`reacted_${post.id}`);
        const btnClass  = myOption ? 'react-btn reacted' : 'react-btn';
        const btnLabel  = myOption ? 'Reacted' : 'React';
        const date      = new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const caption   = escHtml(post.caption || '');

        return `
            <div class="post-card reveal" id="post-${post.id}" style="transition-delay:${i * 0.09}s">
                <div class="post-header">
                    <img class="post-avatar" src="assets/images/Logo.png" alt="The Homegrowns">
                    <span class="post-username">thehomegrowns</span>
                </div>
                ${mediaHtml}
                <div class="post-actions">
                    <div class="action-left">
                        <button class="${btnClass}" id="reactBtn-${post.id}" data-post-id="${post.id}">
                            ${btnLabel}
                        </button>
                        <div class="reaction-tally" id="tally-${post.id}">${tallyHtml}</div>
                    </div>
                </div>
                <div class="post-body">
                    <p class="post-caption" id="caption-${post.id}"><span class="post-username-inline">thehomegrowns</span>&nbsp;${caption}</p>
                    <p class="post-date">${date}</p>
                </div>
            </div>
        `;
    }).join('');

    initReveal();
    setupSeeMore();
}

function setupSeeMore() {
    requestAnimationFrame(() => {
        document.querySelectorAll('.post-caption').forEach(el => {
            if (el.scrollHeight > el.clientHeight + 2) {
                const btn = document.createElement('button');
                btn.className = 'see-more-btn';
                btn.textContent = '...more';
                btn.onclick = () => {
                    el.classList.add('expanded');
                    btn.remove();
                };
                el.after(btn);
            }
        });
    });
}

function buildMedia(post) {
    if (!post.media_url || post.media_type === 'none') return '';
    if (post.media_type === 'video') {
        return `<div class="post-media"><video src="${post.media_url}" controls preload="metadata" playsinline></video></div>`;
    }
    return `<div class="post-media"><img src="${post.media_url}" alt="post" onerror="this.parentElement.style.display='none'"></div>`;
}

function buildTally(postId) {
    const counts   = reactionCounts[postId] || {};
    const myOption = localStorage.getItem(`reacted_${postId}`);
    return reactionOptions
        .filter(opt => counts[opt.id] > 0)
        .map(opt => `
            <div class="tally-item ${myOption === opt.id ? 'mine' : ''}">
                <img src="${opt.media_url}" alt="${opt.label || ''}" onerror="this.style.display='none'">
                <span>${counts[opt.id]}</span>
            </div>
        `).join('');
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Event delegation (replaces inline onclick) ────────────────────────────
function setupDelegation() {
    // React button clicks
    document.getElementById('feedList').addEventListener('click', e => {
        const btn = e.target.closest('.react-btn');
        if (btn) {
            e.stopPropagation();
            togglePicker(btn.dataset.postId, btn);
            return;
        }
    });

    // Picker option clicks (picker is outside feedList)
    picker.addEventListener('click', e => {
        const opt = e.target.closest('.picker-option');
        if (opt) {
            e.stopPropagation();
            selectReaction(opt.dataset.postId, opt.dataset.optionId);
        }
    });
}

// ── Picker ────────────────────────────────────────────────────────────────
function togglePicker(postId, btnEl) {
    if (activePostId === postId && picker.style.display !== 'none') {
        closePicker();
        return;
    }

    activePostId = postId;

    if (reactionOptions.length === 0) {
        pickerInner.innerHTML = '<p class="picker-empty">No reaction stickers yet.</p>';
    } else {
        const myOption = localStorage.getItem(`reacted_${postId}`);
        pickerInner.innerHTML = reactionOptions.map(opt => `
            <div class="picker-option ${myOption === opt.id ? 'active' : ''}"
                 title="${opt.label || ''}"
                 data-post-id="${postId}"
                 data-option-id="${opt.id}">
                <img src="${opt.media_url}" alt="${opt.label || 'reaction'}" onerror="this.parentElement.style.opacity='0.3'">
            </div>
        `).join('');
    }

    // position: fixed uses viewport coords — do NOT add scrollY/scrollX
    picker.style.display = 'block';

    const rect    = btnEl.getBoundingClientRect();
    const pickerW = picker.offsetWidth  || 280;
    const pickerH = picker.offsetHeight || 70;
    let top  = rect.top  - pickerH - 10;
    let left = rect.left + (rect.width / 2) - (pickerW / 2);
    if (top < 10) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
    picker.style.top  = top + 'px';
    picker.style.left = left + 'px';
}

async function selectReaction(postId, optionId) {
    const myOption = localStorage.getItem(`reacted_${postId}`);

    try {
        if (myOption === optionId) {
            const { data: existing } = await supabase
                .from('newsfeed_reactions').select('id')
                .eq('post_id', postId).eq('option_id', optionId).limit(1);
            if (existing && existing.length > 0) {
                await supabase.from('newsfeed_reactions').delete().eq('id', existing[0].id);
            }
            localStorage.removeItem(`reacted_${postId}`);
        } else {
            if (myOption) {
                const { data: prev } = await supabase
                    .from('newsfeed_reactions').select('id')
                    .eq('post_id', postId).eq('option_id', myOption).limit(1);
                if (prev && prev.length > 0) {
                    await supabase.from('newsfeed_reactions').delete().eq('id', prev[0].id);
                }
            }
            await supabase.from('newsfeed_reactions').insert({ post_id: postId, option_id: optionId });
            localStorage.setItem(`reacted_${postId}`, optionId);
        }
    } catch (err) {
        console.error('Reaction error:', err);
    }

    closePicker();
    await loadAll();
}

function closePicker() {
    picker.style.display = 'none';
    activePostId = null;
}

function setupPickerDismiss() {
    document.addEventListener('click', e => {
        if (!picker.contains(e.target) && !e.target.closest('.react-btn')) {
            closePicker();
        }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePicker(); });
}

// ── Mobile nav ────────────────────────────────────────────────────────────
window.toggleMenu = () => document.getElementById('nav-list').classList.toggle('active');
