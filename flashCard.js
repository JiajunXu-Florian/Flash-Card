let cards = [];
let history = [];
let historyMode = 'me';
let usedCards = 0;
let searchTerm = '';
let editingId = null;
let activeView = 'auth';
let authMode = 'login';

let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

const icons = {
  trash:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>',
  edit:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 3v6h6"></path><path d="M12 7v5l3 3"></path></svg>',
  arrow:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"></path><path d="m13 5 7 7-7 7"></path></svg>',
  bolt:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m13 2-2 9h4l-4 11 2-9H9l4-11Z"></path></svg>',
};

const cardsGrid    = document.getElementById('cardsGrid');
const cardCount    = document.getElementById('cardCount');
const usedCount    = document.getElementById('usedCount');
const searchInput  = document.getElementById('searchInput');
const modal        = document.getElementById('createModal');
const createForm   = document.getElementById('createForm');
const questionInput= document.getElementById('questionInput');
const answerInput  = document.getElementById('answerInput');
const categoryInput= document.getElementById('categoryInput');
const levelInput   = document.getElementById('levelInput');
const formError    = document.getElementById('formError');
const toast        = document.getElementById('toast');
const modalTitle   = document.getElementById('modalTitle');
const modalDesc    = document.getElementById('modalDesc');
const submitBtn    = document.getElementById('submitBtn');
const darkToggle   = document.getElementById('darkToggle');
const moonIcon     = document.getElementById('moonIcon');
const sunIcon      = document.getElementById('sunIcon');

const categoryClassMap = {
  'Game': 'game', 'Language Learn': 'language',
  'Sports': 'sports', 'Music': 'music', 'Math': 'math',
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function saveLogin(newToken, user) {
  token = newToken;
  currentUser = user;
  localStorage.setItem('token', newToken);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearLogin() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function authFetch(url, method = 'GET', body = null) {
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
  };
  if (body !== null) options.body = JSON.stringify(body);

  const res = await fetch(url, options);

  if (res.status === 401) {
    clearLogin();
    showAuthView();
    throw new Error('Please log in again');
  }
  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')';
    try {
      const data = await res.json();
      if (data.detail) msg = data.detail;
    } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

function showAuthView() {
  activeView = 'auth';
  document.getElementById('authView').style.display = '';
  document.getElementById('cardsView').style.display = 'none';
  document.getElementById('historyView').style.display = 'none';
  document.getElementById('authedToolbar').style.display = 'none';
  document.getElementById('guestToolbar').style.display = 'flex';
  document.getElementById('mobileCreateBtn').classList.remove('show');
  document.getElementById('authError').classList.remove('show');
  document.getElementById('authForm').reset();
}

function showCardsView() {
  activeView = 'cards';
  document.getElementById('authView').style.display = 'none';
  document.getElementById('cardsView').style.display = '';
  document.getElementById('historyView').style.display = 'none';
  document.getElementById('authedToolbar').style.display = 'flex';
  document.getElementById('guestToolbar').style.display = 'none';
  document.getElementById('mobileCreateBtn').classList.add('show');
  document.querySelector('.search').style.display = '';
  document.getElementById('openCreateBtn').style.display = '';
  updateNavHighlight('cards');
  loadCards();
}

function showHistoryView(mode) {
  historyMode = mode;
  activeView = mode === 'all' ? 'allHistory' : 'history';
  document.getElementById('authView').style.display = 'none';
  document.getElementById('cardsView').style.display = 'none';
  document.getElementById('historyView').style.display = '';
  document.getElementById('authedToolbar').style.display = 'flex';
  document.getElementById('guestToolbar').style.display = 'none';
  document.getElementById('mobileCreateBtn').classList.remove('show');
  document.querySelector('.search').style.display = 'none';
  document.getElementById('openCreateBtn').style.display = 'none';

  if (mode === 'all') {
    document.getElementById('historyTitle').textContent = 'All Users Learning History';
    document.getElementById('historySub').textContent = 'Every reveal across every user. Admin-only view.';
    updateNavHighlight('allHistory');
  } else {
    document.getElementById('historyTitle').textContent = 'My Learning History';
    document.getElementById('historySub').textContent = "Every card you've revealed appears below, most recent first.";
    updateNavHighlight('history');
  }
  loadHistory();
}

function updateNavHighlight(activeName) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === activeName);
  });
}

function applyAuthMode() {
  if (authMode === 'login') {
    document.getElementById('authTitle').textContent = 'Welcome back';
    document.getElementById('authSubtitle').textContent = 'Log in to access your flashcards.';
    document.getElementById('authSubmitBtn').textContent = 'Log in';
    document.getElementById('authSwitchPrompt').textContent = 'New here?';
    document.getElementById('authSwitchLink').textContent = 'Create an account';
  } else {
    document.getElementById('authTitle').textContent = 'Create an account';
    document.getElementById('authSubtitle').textContent = 'Sign up to start building your knowledge base.';
    document.getElementById('authSubmitBtn').textContent = 'Sign up';
    document.getElementById('authSwitchPrompt').textContent = 'Already have an account?';
    document.getElementById('authSwitchLink').textContent = 'Log in instead';
  }
}

document.getElementById('authSwitchLink').addEventListener('click', (e) => {
  e.preventDefault();
  authMode = authMode === 'login' ? 'register' : 'login';
  document.getElementById('authError').classList.remove('show');
  applyAuthMode();
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('authError');
  errorEl.classList.remove('show');

  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;

  if (username.length < 3 || password.length < 6) {
    errorEl.textContent = 'Username must be at least 3 characters, password at least 6';
    errorEl.classList.add('show');
    return;
  }

  const url = authMode === 'login' ? '/auth/login' : '/auth/register';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Request failed');
    }
    const data = await res.json();
    saveLogin(data.token, data.user);
    afterLogin();
    showToast(authMode === 'login' ? 'Logged in' : 'Account created');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearLogin();
  cards = [];
  history = [];
  showAuthView();
  showToast('Logged out');
});

function afterLogin() {
  document.getElementById('usernameLabel').textContent = currentUser.username;
  document.getElementById('userBadge').textContent = currentUser.role;
  document.getElementById('userBadge').classList.toggle('admin', currentUser.role === 'admin');
  document.getElementById('heroName').textContent = currentUser.username;
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = currentUser.role === 'admin' ? '' : 'none';
  });
  showCardsView();
}

function filterCards() {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter(card =>
    (card.category || '').toLowerCase().includes(q) ||
    (card.question || '').toLowerCase().includes(q) 
  );
}

function getCategoryClass(category) { return categoryClassMap[category] || 'math'; }

function makeCardMarkup(card) {
  const accentIcon = card.accent === 'bolt' ? icons.bolt : icons.history;
  const lvl = escapeHtml(card.level || 'easy');
  const catClass = getCategoryClass(card.category);
  return `
    <article class="card" data-card-id="${card.id}" tabindex="0">
      <div class="card-inner">
        <div class="face front">
          <div class="card-top">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span class="tag ${catClass}">${escapeHtml(card.category)}</span>
              <span class="tag ${lvl}">${lvl}</span>
            </div>
            <div class="card-actions">
              <button class="edit-btn" type="button" data-edit-id="${card.id}">${icons.edit}</button>
              <button class="delete-btn" type="button" data-delete-id="${card.id}">${icons.trash}</button>
            </div>
          </div>
          <div class="card-body">
            <div class="answer-label">Question</div>
            <h5 class="card-title">${escapeHtml(card.question)}</h5>
          </div>
          <div class="card-footer">
            <div class="meta">${accentIcon}<span>${escapeHtml(card.review)}</span></div>
            <div class="footer-action"><span>Flip Card</span>${icons.arrow}</div>
          </div>
        </div>
        <div class="face back">
          <div class="back-header">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span class="tag ${catClass}">${escapeHtml(card.category)}</span>
              <span class="tag ${lvl}">${lvl}</span>
            </div>
            <span class="back-badge">Revealed</span>
          </div>
          <div class="back-section">
            <div class="back-label">Question</div>
            <p class="back-question">${escapeHtml(card.question)}</p>
          </div>
          <div class="back-divider"></div>
          <div class="back-section">
            <div class="back-label">Answer</div>
            <p class="back-answer">${escapeHtml(card.answer)}</p>
          </div>
        </div>
      </div>
    </article>
  `;
}

function makeAddCardMarkup() {
  return `
    <button class="add-card" id="inlineAddCard" type="button">
      <div class="add-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"></path></svg>
      </div>
      <div>
        <h5 style="font-size:1.35rem; margin:0 0 8px; color:#1f2937; font-weight:800;">Add New Card</h5>
        <p style="margin:0; color:#73819d; line-height:1.6; max-width:240px;">Ask yourself anything you want to learn!</p>
      </div>
    </button>
  `;
}

function render() {
  const visible = filterCards();
  let html = visible.map(makeCardMarkup).join('') + makeAddCardMarkup();

  if (visible.length === 0) {
    html += `
      <div class="empty-message show">
        <div class="empty-message-icon">
          <svg viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        </div>
        <p class="empty-message-title">No cards found</p>
        <p class="empty-message-sub">Try a different keyword or create a new card.</p>
      </div>`;
  }

  cardsGrid.innerHTML = html;
  cardCount.textContent = cards.length + ' ' + (cards.length === 1 ? 'card' : 'cards') + ' ready';
  usedCount.textContent = usedCards + ' ' + (usedCards === 1 ? 'card' : 'cards') + ' used';
}

async function loadCards() {
  try {
    cards = await authFetch('/cards');
    render();
  } catch (err) {
    cards = [];
    render();
    if (!err.message.includes('log in again')) showToast(err.message);
  }
}

async function removeCard(id, announce = true) {
  const index = cards.findIndex(c => c.id === id);
  if (index === -1) return;
  const removed = cards[index];
  cards.splice(index, 1);
  render();
  try {
    await authFetch('/cards/' + id, 'DELETE');
    if (announce) showToast('Deleted: ' + removed.question);
  } catch (err) {
    cards.splice(index, 0, removed);
    render();
    showToast(err.message);
  }
}

async function loadHistory() {
  const url = historyMode === 'all' ? '/history/all' : '/history/me';
  try {
    history = await authFetch(url);
  } catch (err) {
    history = [];
    showToast(err.message);
  }
  renderHistory();
}

function renderHistory() {
  const showUserCol = historyMode === 'all';
  document.querySelectorAll('.col-user').forEach(el => {
    el.style.display = showUserCol ? '' : 'none';
  });

  const tbody = document.getElementById('historyBody');
  const empty = document.getElementById('historyEmpty');
  const table = document.getElementById('historyTable');

  if (history.length === 0) {
    table.style.display = 'none';
    empty.classList.add('show');
    return;
  }
  table.style.display = '';
  empty.classList.remove('show');

  tbody.innerHTML = history.map(row => `
    <tr>
      ${showUserCol ? `<td class="col-user">${escapeHtml(row.username || row.user_id)}</td>` : ''}
      <td>${escapeHtml(row.card_question_snapshot || '(card deleted)')}</td>
      <td class="history-card-id">${escapeHtml(row.card_id)}</td>
      <td class="history-time">${formatDate(row.viewed_at)}</td>
      <td><button class="history-delete" data-history-delete="${row.id}" type="button">Delete</button></td>
    </tr>
  `).join('');
}

async function deleteHistoryRow(id) {
  try {
    await authFetch('/history/' + id, 'DELETE');
    history = history.filter(h => String(h.id) !== String(id));
    renderHistory();
    showToast('History entry removed');
  } catch (err) {
    showToast(err.message);
  }
}

function flipThenUse(cardEl, id) {
  if (cardEl.classList.contains('is-flipped')) return;
  if (cardEl.classList.contains('is-removing')) return;

  cardEl.classList.add('is-flipped');
  showToast('Answer revealed. Card will disappear.');

  const card = cards.find(c => c.id === id);
  authFetch('/history', 'POST', {
    card_id: id,
    card_question_snapshot: card ? card.question : '',
  }).catch(() => {});

  setTimeout(() => {
    if (!document.body.contains(cardEl)) return;
    cardEl.classList.add('is-removing');
    setTimeout(() => {
      const art = cardEl.closest('article');
      if (art) art.remove();
    }, 280);
  }, 3000);

  setTimeout(() => {
    if (cards.some(c => c.id === id)) {
      usedCards += 1;
      removeCard(id, false);
      showToast('Card completed and removed');
    }
  }, 3350);
}

function openModal(cardToEdit = null) {
  editingId = cardToEdit ? cardToEdit.id : null;
  formError.classList.remove('show');

  if (cardToEdit) {
    modalTitle.textContent = 'Edit flashcard';
    modalDesc.textContent  = 'Update the category, question, or answer below.';
    submitBtn.textContent  = 'Save Changes';
    categoryInput.value    = cardToEdit.category;
    levelInput.value       = cardToEdit.level;
    questionInput.value    = cardToEdit.question;
    answerInput.value      = cardToEdit.answer;
  } else {
    modalTitle.textContent = 'Create a new flashcard';
    modalDesc.textContent  = 'Add a category, a question, and an answer.';
    submitBtn.textContent  = 'Add Card';
    createForm.reset();
    categoryInput.value    = 'Game';
    levelInput.value       = 'easy';
  }

  modal.classList.add('open');
  setTimeout(() => questionInput.focus(), 20);
}

function closeModal() {
  modal.classList.remove('open');
  editingId = null;
}

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();
  const answer = answerInput.value.trim();
  const category = categoryInput.value.trim() || 'Custom';
  const level = levelInput.value || 'easy';

  if (!question || !answer) {
    formError.textContent = 'Please enter both a question and an answer.';
    formError.classList.add('show');
    return;
  }
  formError.classList.remove('show');

  try {
    if (editingId) {
      const index = cards.findIndex(c => c.id === editingId);
      if (index !== -1) {
        const updated = {
          ...cards[index],
          category, level, question, answer,
          review: 'Edited just now',
        };
        await authFetch('/cards/' + editingId, 'PUT', updated);
        cards[index] = updated;
      }
      closeModal();
      render();
      showToast('Card updated');
    } else {
      const newCard = {
        id: crypto.randomUUID(),
        category, level, question, answer,
        review: 'New Card',
        accent: 'bolt',
      };
      const saved = await authFetch('/cards', 'POST', newCard);
      cards.unshift(saved);
      closeModal();
      render();
      showToast('New card created');
    }
  } catch (err) {
    formError.textContent = err.message;
    formError.classList.add('show');
  }
});

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('.nav-btn');
  if (navBtn) {
    const view = navBtn.dataset.view;
    if (view === 'cards') showCardsView();
    if (view === 'history') showHistoryView('me');
    if (view === 'allHistory') showHistoryView('all');
    return;
  }

  const editBtn = e.target.closest('[data-edit-id]');
  if (editBtn) {
    e.stopPropagation();
    const card = cards.find(c => c.id === editBtn.dataset.editId);
    if (card) openModal(card);
    return;
  }

  const deleteBtn = e.target.closest('[data-delete-id]');
  if (deleteBtn) {
    e.stopPropagation();
    removeCard(deleteBtn.dataset.deleteId);
    return;
  }

  const histDelBtn = e.target.closest('[data-history-delete]');
  if (histDelBtn) {
    deleteHistoryRow(histDelBtn.dataset.historyDelete);
    return;
  }

  if (e.target.closest('#openCreateBtn') ||
      e.target.closest('#mobileCreateBtn') ||
      e.target.closest('#inlineAddCard')) {
    openModal();
    return;
  }

  if (e.target === modal ||
      e.target.closest('#closeModalBtn') ||
      e.target.closest('#cancelCreateBtn')) {
    closeModal();
    return;
  }

  const card = e.target.closest('.card');
  if (card && activeView === 'cards') {
    flipThenUse(card, card.dataset.cardId);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) {
    closeModal();
    return;
  }
  const card = e.target.closest && e.target.closest('.card');
  if (card && (e.key === 'Enter' || e.key === ' ') && activeView === 'cards') {
    e.preventDefault();
    flipThenUse(card, card.dataset.cardId);
  }
});

searchInput.addEventListener('input', (e) => {
  searchTerm = e.target.value;
  if (activeView === 'cards') render();
});

function applyDarkMode(isDark) {
  document.body.classList.toggle('dark', isDark);
  if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
  if (sunIcon)  sunIcon.style.display  = isDark ? 'block' : 'none';
  localStorage.setItem('darkMode', isDark);
}

applyDarkMode(localStorage.getItem('darkMode') === 'true');

document.addEventListener('click', (e) => {
  if (e.target.closest('#darkToggle') || e.target.closest('#darkToggleGuest')) {
    applyDarkMode(!document.body.classList.contains('dark'));
  }
});

async function bootstrap() {
  applyAuthMode();

  if (!token) {
    showAuthView();
    return;
  }

  try {
    const res = await fetch('/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) throw new Error();
    const me = await res.json();
    currentUser = me;
    localStorage.setItem('user', JSON.stringify(me));
    afterLogin();
  } catch (e) {
    clearLogin();
    showAuthView();
  }
}

bootstrap();
