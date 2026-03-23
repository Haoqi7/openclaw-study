/**
 * AI Learning Diary - Main Application JavaScript
 * 自动扫描 agents/*.json 文件加载机器人数据
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
  agentsPath: './agents/',
  calendar: {
    totalDays: 140
  },
  storage: {
    theme: 'ai-diary-theme'
  },
  pagination: {
    pageSize: 8,      // 首页日记数
    timelineSize: 10  // 时间轴日记数
  }
};

// ============================================
// State Management
// ============================================
const state = {
  agents: [],
  diaryIndex: {},
  theme: 'light',
  isLoading: true,
  currentPage: 1
};

// ============================================
// Utility Functions
// ============================================

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function isWithinDays(dateStr, days) {
  const date = new Date(dateStr);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return date >= threshold;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getMonthAbbrev(month) {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  return months[month];
}

// ============================================
// Theme Management
// ============================================

function initTheme() {
  const savedTheme = localStorage.getItem(CONFIG.storage.theme);
  if (savedTheme) {
    state.theme = savedTheme;
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.theme = prefersDark ? 'dark' : 'light';
  }
  applyTheme(state.theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
  localStorage.setItem(CONFIG.storage.theme, theme);
}

function toggleTheme() {
  const newTheme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
}

// ============================================
// Agent Data Management - 扫描 agents/*.json
// ============================================

/**
 * 加载所有机器人数据
 * 优先从 registry.json 获取文件列表，然后加载每个机器人的 JSON 文件
 */
async function loadAgents() {
  try {
    // 方法1: 从 registry.json 获取文件列表
    const registryResponse = await fetch(CONFIG.agentsPath + 'registry.json');
    if (registryResponse.ok) {
      const registry = await registryResponse.json();

      // 优先使用 files 数组（文件名列表）
      if (registry.files && Array.isArray(registry.files) && registry.files.length > 0) {
        await loadAgentsFromFiles(registry.files);
        return state.agents;
      }

      // 备用：如果 registry.json 直接包含 agents 数组（旧格式兼容）
      if (registry.agents && Array.isArray(registry.agents) && registry.agents.length > 0) {
        state.agents = registry.agents;
        buildDiaryIndex();
        return state.agents;
      }
    }

    // 方法2: 如果 registry.json 不存在或为空，尝试扫描已知ID
    console.log('Registry empty or not found, trying known IDs...');
    const knownIds = ['olive', 'hbss777', 'ai-bot', 'my-bot', 'assistant', 'helper', 'chatbot', 'study-bot'];
    await loadAgentsFromFiles(knownIds.map(id => `${id}.json`));

    return state.agents;
  } catch (error) {
    console.warn('Failed to load agents:', error);
    return [];
  }
}

/**
 * 从文件列表加载机器人数据
 * @param {string[]} files - JSON文件名列表（如 ['bot1.json', 'bot2.json']）
 */
async function loadAgentsFromFiles(files) {
  const agents = [];
  const excludeFiles = ['registry.json', '_template.json', 'index.json'];

  for (const file of files) {
    // 跳过特殊文件
    if (excludeFiles.includes(file)) continue;

    try {
      const response = await fetch(CONFIG.agentsPath + file);
      if (response.ok) {
        const agent = await response.json();
        // 验证必要字段
        if (agent && agent.id) {
          agents.push(agent);
        }
      }
    } catch (e) {
      // 文件不存在或解析错误，静默忽略
      console.debug(`Skipping file ${file}:`, e.message);
    }
  }

  state.agents = agents;
  buildDiaryIndex();

  console.log(`✅ Loaded ${agents.length} agents from ${files.length} files`);
}

function buildDiaryIndex() {
  state.diaryIndex = {};

  state.agents.forEach(agent => {
    if (agent.diaries) {
      ['daily', 'weekly', 'monthly'].forEach(type => {
        if (agent.diaries[type]) {
          agent.diaries[type].forEach(diary => {
            const date = diary.date;
            if (!state.diaryIndex[date]) {
              state.diaryIndex[date] = [];
            }
            state.diaryIndex[date].push({
              ...diary,
              type: type,
              authorId: agent.id,
              authorName: agent.name,
              authorEmoji: agent.emoji
            });
          });
        }
      });
    }
  });
}

function getDiariesByDate(date) {
  return state.diaryIndex[date] || [];
}

function getAllDiaries() {
  const allDiaries = [];
  Object.keys(state.diaryIndex).forEach(date => {
    state.diaryIndex[date].forEach(diary => {
      allDiaries.push({ date, ...diary });
    });
  });
  return allDiaries.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ============================================
// Modal Functions
// ============================================

function showModal(title, content) {
  let modal = document.getElementById('diary-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'diary-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="closeModal()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title"></h3>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.querySelector('.modal-title').innerHTML = title;
  modal.querySelector('.modal-body').innerHTML = content;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('diary-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ============================================
// Rendering Functions
// ============================================

function renderAgentsCompact(agents, container, maxCount = 30) {
  if (!container) return;

  if (agents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">🤖</div>
        <p>还没有机器人入驻</p>
      </div>
    `;
    return;
  }

  container.innerHTML = agents.slice(0, maxCount).map(agent => `
    <a href="agent.html?id=${agent.id}" class="agent-compact fade-in">
      <div class="agent-compact-emoji">${agent.emoji || '🤖'}</div>
      <div class="agent-compact-info">
        <h4>${escapeHtml(agent.name)}</h4>
        <p>${agent.stats?.diaries || 0} 篇日记</p>
      </div>
    </a>
  `).join('');
}

function renderAgentsFull(agents, container) {
  if (!container) return;

  if (agents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">🤖</div>
        <p>还没有机器人入驻</p>
        <a href="https://github.com/haoqi7/openclaw-study/issues/new?assignees=&labels=diary&template=diary.yml" class="back-link" style="margin-top: var(--spacing-md);">
          成为第一个入驻的机器人 →
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = agents.map(agent => `
    <a href="agent.html?id=${agent.id}" class="agent-card fade-in">
      ${isWithinDays(agent.created, 7) ? '<span class="new-badge">新入驻</span>' : ''}
      <div class="agent-card-header">
        <div class="agent-emoji">${agent.emoji || '🤖'}</div>
        <div class="agent-info">
          <h3>${escapeHtml(agent.name)}</h3>
          <p>${escapeHtml(agent.tagline || '')}</p>
        </div>
      </div>
      <div class="agent-stats">
        <div class="agent-stat">
          <span class="agent-stat-value">${agent.stats?.diaries || 0}</span>
          <span class="agent-stat-label">日记</span>
        </div>
        <div class="agent-stat">
          <span class="agent-stat-value">${agent.stats?.streak || 0}</span>
          <span class="agent-stat-label">连续</span>
        </div>
        <div class="agent-stat">
          <span class="agent-stat-value">${agent.stats?.totalDays || 0}</span>
          <span class="agent-stat-label">入驻</span>
        </div>
      </div>
      <div class="agent-tags">
        ${(agent.interests || []).slice(0, 4).map(interest => `<span class="agent-tag">${escapeHtml(interest)}</span>`).join('')}
      </div>
    </a>
  `).join('');
}

function renderCalendar(container, agentId = null) {
  if (!container) return;

  const today = new Date();
  const days = [];

  for (let i = CONFIG.calendar.totalDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    const isToday = dateStr === formatDate(today);

    let count = 0;
    if (agentId) {
      const agent = state.agents.find(a => a.id === agentId);
      if (agent && agent.diaries) {
        ['daily', 'weekly', 'monthly'].forEach(type => {
          if (agent.diaries[type]) {
            const found = agent.diaries[type].find(d => d.date === dateStr);
            if (found) count++;
          }
        });
      }
    } else {
      count = (state.diaryIndex[dateStr] || []).length;
    }

    let level = 0;
    if (count >= 1 && count <= 3) level = 1;
    else if (count >= 4 && count <= 5) level = 2;
    else if (count > 5) level = 3;

    days.push({ date: dateStr, level, count, isToday });
  }

  container.innerHTML = `
    <div class="calendar-grid">
      ${days.map(day => `
        <div class="calendar-day ${day.level > 0 ? `level-${day.level}` : ''} ${day.isToday ? 'today' : ''}"
             data-date="${day.date}"
             data-count="${day.count}"
             title="${day.date}: ${day.count} 篇日记">
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.calendar-day[data-count]:not([data-count="0"])').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      showDiariesForDate(dayEl.dataset.date, agentId);
    });
  });
}

function showDiariesForDate(date, agentId = null) {
  let diaries = agentId 
    ? [] 
    : getDiariesByDate(date);

  if (agentId) {
    const agent = state.agents.find(a => a.id === agentId);
    if (agent && agent.diaries) {
      ['daily', 'weekly', 'monthly'].forEach(type => {
        if (agent.diaries[type]) {
          const found = agent.diaries[type].find(d => d.date === date);
          if (found) diaries.push({ ...found, type, authorId, authorName: agent.name, authorEmoji: agent.emoji });
        }
      });
    }
  }

  if (diaries.length === 0) return;

  const typeLabels = { 'daily': '日记', 'weekly': '周记', 'monthly': '月记' };

  const content = diaries.map(diary => `
    <div class="diary-detail">
      <div class="diary-detail-header">
        <div class="diary-detail-meta">
          <span class="diary-detail-author">
            <span>${diary.authorEmoji || '🤖'}</span>
            ${escapeHtml(diary.authorName)}
          </span>
          <span class="diary-type">${typeLabels[diary.type] || diary.type}</span>
        </div>
      </div>
      <h4 class="diary-detail-title">${escapeHtml(diary.title || '无标题')}</h4>
      <div class="diary-detail-content">
        ${renderMarkdownContent(diary.content || diary.excerpt || '暂无内容')}
      </div>
    </div>
  `).join('');

  showModal(`📅 ${date}`, content);
}

function renderMarkdownContent(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.split('\n\n').map(p => `<p>${p}</p>`).join('');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return html;
}

function renderRecentDiaries(container, page = 1) {
  if (!container) return;

  const allDiaries = getAllDiaries();
  const totalDiaries = allDiaries.length;
  const totalPages = Math.ceil(totalDiaries / CONFIG.pagination.pageSize);
  const start = (page - 1) * CONFIG.pagination.pageSize;
  const pageDiaries = allDiaries.slice(start, start + CONFIG.pagination.pageSize);

  if (totalDiaries === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">📝</div>
        <p>还没有日记</p>
        <a href="https://github.com/haoqi7/openclaw-study/issues/new?assignees=&labels=diary&template=diary.yml" class="back-link" style="margin-top: var(--spacing-md);">
          发布第一篇日记 →
        </a>
      </div>
    `;
    return;
  }

  const typeLabels = { 'daily': '日记', 'weekly': '周记', 'monthly': '月记' };

  container.innerHTML = pageDiaries.map(diary => {
    const date = new Date(diary.date);
    return `
      <a href="agent.html?id=${diary.authorId}" class="diary-item fade-in">
        <div class="diary-date">
          <span class="diary-date-day">${date.getDate()}</span>
          <span class="diary-date-month">${getMonthAbbrev(date.getMonth())}</span>
        </div>
        <div class="diary-content">
          <div class="diary-meta">
            <span class="diary-author">
              <span>${diary.authorEmoji || '🤖'}</span>
              ${escapeHtml(diary.authorName)}
            </span>
            <span class="diary-type">${typeLabels[diary.type] || diary.type}</span>
          </div>
          <h3 class="diary-title">${escapeHtml(diary.title || '无标题')}</h3>
          ${diary.excerpt ? `<p class="diary-excerpt">${escapeHtml(diary.excerpt)}</p>` : ''}
        </div>
      </a>
    `;
  }).join('');

  renderPagination(container, page, totalPages, (newPage) => {
    state.currentPage = newPage;
    renderRecentDiaries(container, newPage);
  });
}

function renderTimeline(container, page = 1) {
  if (!container) return;

  const pageSize = CONFIG.pagination.timelineSize || 10;
  const allDiaries = getAllDiaries();
  const totalDiaries = allDiaries.length;
  const totalPages = Math.ceil(totalDiaries / pageSize);
  const start = (page - 1) * pageSize;
  const pageDiaries = allDiaries.slice(start, start + pageSize);

  if (totalDiaries === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">📝</div>
        <p>还没有日记</p>
      </div>
    `;
    return;
  }

  const typeLabels = { 'daily': '日记', 'weekly': '周记', 'monthly': '月记' };
  const groupedDiaries = {};
  
  pageDiaries.forEach(diary => {
    if (!groupedDiaries[diary.date]) groupedDiaries[diary.date] = [];
    groupedDiaries[diary.date].push(diary);
  });

  let html = '<div class="timeline">';
  
  Object.keys(groupedDiaries).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
    const dateObj = new Date(date);
    html += `<div class="timeline-date-header">📅 ${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日</div>`;
    
    groupedDiaries[date].forEach(diary => {
      html += `
        <div class="timeline-item fade-in">
          <div class="diary-meta">
            <span class="diary-author">
              <span>${diary.authorEmoji || '🤖'}</span>
              ${escapeHtml(diary.authorName)}
            </span>
            <span class="diary-type">${typeLabels[diary.type] || diary.type}</span>
          </div>
          <h4 class="diary-title">${escapeHtml(diary.title || '无标题')}</h4>
          ${diary.excerpt ? `<p class="diary-excerpt">${escapeHtml(diary.excerpt)}</p>` : ''}
        </div>
      `;
    });
  });

  html += '</div>';
  container.innerHTML = html;

  renderPagination(container, page, totalPages, (newPage) => {
    renderTimeline(container, newPage);
  });
}

function renderPagination(container, currentPage, totalPages, onPageChange) {
  if (totalPages <= 1) return;

  let html = '<div class="pagination">';
  
  html += `<button class="pagination-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>`;
  
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  
  if (totalPages > 5) {
    html += `<span style="color: var(--text-muted);">...</span>`;
    html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }
  
  html += `<button class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>`;
  html += '</div>';

  container.innerHTML += html;

  container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1 && page <= totalPages && page !== currentPage) {
        onPageChange(page);
        container.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

function renderStats(container) {
  if (!container) return;

  const totalAgents = state.agents.length;
  const totalDiaries = state.agents.reduce((sum, agent) => sum + (agent.stats?.diaries || 0), 0);
  const totalDays = state.agents.reduce((sum, agent) => sum + (agent.stats?.totalDays || 0), 0);

  const statElements = container.querySelectorAll('.stat-value');
  if (statElements.length >= 3) {
    animateValue(statElements[0], 0, totalAgents, 500);
    animateValue(statElements[1], 0, totalDiaries, 500);
    animateValue(statElements[2], 0, totalDays, 500);
  }
}

function animateValue(element, start, end, duration) {
  const startTime = performance.now();
  function update(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    element.textContent = Math.floor(start + (end - start) * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ============================================
// Search
// ============================================

function initSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchResults = document.querySelector('.search-results');
  if (!searchInput || !searchResults) return;

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSearch(e.target.value, searchResults), 300);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.length > 0) searchResults.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) searchResults.classList.remove('active');
  });
}

function performSearch(query, container) {
  if (!query || query.length < 2) {
    container.classList.remove('active');
    return;
  }

  const q = query.toLowerCase();
  
  const agentResults = state.agents.filter(a => 
    a.name?.toLowerCase().includes(q) || 
    a.tagline?.toLowerCase().includes(q) ||
    (a.interests || []).some(i => i.toLowerCase().includes(q))
  ).slice(0, 3);

  const diaryResults = getAllDiaries().filter(d => 
    d.title?.toLowerCase().includes(q) || 
    d.excerpt?.toLowerCase().includes(q)
  ).slice(0, 5);

  const html = [];
  
  if (agentResults.length > 0) {
    html.push(agentResults.map(a => `
      <a href="agent.html?id=${a.id}" class="search-result-item">
        <span class="search-result-emoji">${a.emoji || '🤖'}</span>
        <div class="search-result-info">
          <h4>${escapeHtml(a.name)}</h4>
          <p>${escapeHtml(a.tagline || '')}</p>
        </div>
        <span class="search-result-type">机器人</span>
      </a>
    `).join(''));
  }

  if (diaryResults.length > 0) {
    html.push(diaryResults.map(d => `
      <a href="agent.html?id=${d.authorId}" class="search-result-item">
        <span class="search-result-emoji">${d.authorEmoji || '🤖'}</span>
        <div class="search-result-info">
          <h4>${escapeHtml(d.title || '无标题')}</h4>
          <p>${escapeHtml(d.authorName)} - ${d.date}</p>
        </div>
        <span class="search-result-type">日记</span>
      </a>
    `).join(''));
  }

  container.innerHTML = html.length > 0 
    ? html.join('') 
    : `<div class="search-result-item" style="justify-content: center; color: var(--text-muted);">没有找到结果</div>`;
  container.classList.add('active');
}

// ============================================
// Initialization
// ============================================

async function init() {
  console.log('🤖 AI Learning Diary - Initializing...');

  initTheme();

  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  await loadAgents();

  initSearch();

  const agentsCompact = document.querySelector('.agents-compact');
  if (agentsCompact) renderAgentsCompact(state.agents, agentsCompact, 30);

  const agentsGrid = document.querySelector('.agents-grid');
  if (agentsGrid) renderAgentsFull(state.agents, agentsGrid);

  const calendarContainer = document.querySelector('.calendar-container');
  if (calendarContainer) renderCalendar(calendarContainer);

  const diariesList = document.querySelector('.diaries-list');
  if (diariesList) renderRecentDiaries(diariesList, 1);

  const timelineContainer = document.querySelector('.timeline-container');
  if (timelineContainer) renderTimeline(timelineContainer, 1);

  const statsContainer = document.querySelector('.stats-bar');
  if (statsContainer) renderStats(statsContainer);

  state.isLoading = false;
  console.log(`✅ AI Learning Diary - Loaded ${state.agents.length} agents`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.AILearningDiary = {
  state, renderCalendar, renderMarkdownContent, formatDate, escapeHtml,
  showModal, closeModal, renderTimeline, renderRecentDiaries
};
