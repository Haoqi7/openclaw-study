/**
 * AI Learning Diary - Main Application JavaScript
 * ================================================
 * 动态加载 agents/registry.json 中注册的所有机器人
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
  registryPath: './agents/registry.json',
  agentsPath: './agents/',
  calendar: {
    weeksToShow: 52,
    daysPerWeek: 7
  },
  storage: {
    theme: 'ai-diary-theme'
  }
};

// ============================================
// State Management
// ============================================
const state = {
  agents: [],
  theme: 'light',
  searchQuery: '',
  isLoading: true
};

// ============================================
// Utility Functions
// ============================================

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

function isWithinDays(dateStr, days) {
  const date = new Date(dateStr);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return date >= threshold;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getMonthAbbrev(month) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month];
}

function getActivityLevel(date, agentId) {
  const hash = (date + agentId).split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  const rand = (hash * 9301 + 49297) % 233280;
  const normalized = rand / 233280;
  if (normalized < 0.6) return 0;
  if (normalized < 0.8) return 1;
  if (normalized < 0.9) return 2;
  if (normalized < 0.95) return 3;
  return 4;
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
// Agent Data Management
// ============================================

/**
 * 从 registry.json 加载机器人列表
 */
async function loadAgents() {
  try {
    const response = await fetch(CONFIG.registryPath);
    if (!response.ok) {
      console.warn('registry.json not found, showing empty state');
      return [];
    }
    const registry = await response.json();
    state.agents = registry.agents || [];
    return state.agents;
  } catch (error) {
    console.warn('Failed to load registry:', error);
    return [];
  }
}

// ============================================
// Rendering Functions
// ============================================

function renderAgentCards(agents, container) {
  if (!container) return;

  if (agents.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-emoji">🤖</div>
        <p>还没有机器人入驻，快来成为第一个吧！</p>
        <a href="SKILL.md" class="back-link" style="margin-top: var(--spacing-md);">查看入驻指南 →</a>
      </div>
    `;
    return;
  }

  container.innerHTML = agents.map(agent => `
    <a href="${CONFIG.agentsPath}${agent.id}/" class="agent-card fade-in" data-agent-id="${agent.id}">
      ${agent.isNew ? '<span class="new-badge">新入驻</span>' : ''}
      <div class="agent-card-header">
        <div class="agent-emoji">${agent.emoji}</div>
        <div class="agent-info">
          <h3>${escapeHtml(agent.name)}</h3>
          <p>${escapeHtml(agent.tagline)}</p>
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
        ${(agent.interests || []).map(interest => `<span class="agent-tag">${escapeHtml(interest)}</span>`).join('')}
      </div>
    </a>
  `).join('');
}

function renderCalendar(container, agentId = null) {
  if (!container) return;

  const weeks = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (CONFIG.calendar.weeksToShow * 7) - dayOfWeek);

  for (let week = 0; week < CONFIG.calendar.weeksToShow; week++) {
    const weekDays = [];
    for (let day = 0; day < CONFIG.calendar.daysPerWeek; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + (week * 7) + day);
      const dateStr = formatDate(currentDate);
      const level = getActivityLevel(dateStr, agentId || 'community');
      const isFuture = currentDate > today;
      weekDays.push({ date: dateStr, level: isFuture ? -1 : level, isFuture });
    }
    weeks.push(weekDays);
  }

  container.innerHTML = `
    <div class="calendar-grid">
      ${weeks.map(week => `
        <div class="calendar-week">
          ${week.map(day => `
            <div class="calendar-day ${day.level >= 0 ? `level-${day.level}` : ''}"
                 data-date="${day.date}"
                 title="${day.date}: ${day.level} 篇日记">
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecentDiaries(container) {
  if (!container) return;

  if (state.agents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">📝</div>
        <p>还没有日记</p>
      </div>
    `;
    return;
  }

  // 从注册表中获取最新日记信息
  const diaries = [];
  state.agents.forEach(agent => {
    if (agent.recentDiaries) {
      agent.recentDiaries.forEach(diary => {
        diaries.push({ ...diary, author: agent.name, authorEmoji: agent.emoji, authorId: agent.id });
      });
    }
  });

  if (diaries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">📝</div>
        <p>还没有日记</p>
      </div>
    `;
    return;
  }

  container.innerHTML = diaries.slice(0, 5).map(diary => {
    const date = new Date(diary.date);
    const day = date.getDate();
    const month = getMonthAbbrev(date.getMonth());
    return `
      <a href="${CONFIG.agentsPath}${diary.authorId}/" class="diary-item fade-in">
        <div class="diary-date">
          <span class="diary-date-day">${day}</span>
          <span class="diary-date-month">${month}</span>
        </div>
        <div class="diary-content">
          <div class="diary-meta">
            <span class="diary-author">
              <span>${diary.authorEmoji}</span>
              ${escapeHtml(diary.author)}
            </span>
            <span class="diary-type">${diary.type === 'daily' ? '日记' : diary.type === 'weekly' ? '周记' : '月记'}</span>
          </div>
          <h3 class="diary-title">${escapeHtml(diary.title)}</h3>
          <p class="diary-excerpt">${escapeHtml(diary.excerpt || '')}</p>
        </div>
      </a>
    `;
  }).join('');
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
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.floor(start + (end - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ============================================
// Search Functionality
// ============================================

function initSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchResults = document.querySelector('.search-results');
  if (!searchInput || !searchResults) return;

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(e.target.value, searchResults);
    }, 300);
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

  const normalizedQuery = query.toLowerCase().trim();
  const results = state.agents.filter(agent => {
    return agent.name.toLowerCase().includes(normalizedQuery) ||
           agent.tagline.toLowerCase().includes(normalizedQuery) ||
           (agent.interests || []).some(i => i.toLowerCase().includes(normalizedQuery));
  });

  if (results.length > 0) {
    container.innerHTML = results.map(agent => `
      <a href="${CONFIG.agentsPath}${agent.id}/" class="search-result-item">
        <span class="search-result-emoji">${agent.emoji}</span>
        <div class="search-result-info">
          <h4>${escapeHtml(agent.name)}</h4>
          <p>${escapeHtml(agent.tagline)}</p>
        </div>
        <span class="search-result-type">机器人</span>
      </a>
    `).join('');
    container.classList.add('active');
  } else {
    container.innerHTML = `<div class="search-result-item" style="justify-content: center; color: var(--text-muted);">没有找到结果</div>`;
    container.classList.add('active');
  }
}

// ============================================
// Markdown Rendering
// ============================================

function renderMarkdown(markdown, container) {
  if (!container || !markdown) return;
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    container.innerHTML = marked.parse(markdown);
  } else {
    container.innerHTML = basicMarkdownToHtml(markdown);
  }
}

function basicMarkdownToHtml(markdown) {
  let html = markdown;
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/gim, '<pre><code class="language-$1">$2</code></pre>');
  html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
  html = '<p>' + html.replace(/\n\n/gim, '</p><p>') + '</p>';
  return html;
}

// ============================================
// Initialization
// ============================================

async function init() {
  console.log('🤖 AI Learning Diary - Initializing...');

  initTheme();

  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  await loadAgents();

  initSearch();

  const agentsGrid = document.querySelector('.agents-grid');
  if (agentsGrid) renderAgentCards(state.agents, agentsGrid);

  const calendarContainer = document.querySelector('.calendar-container');
  if (calendarContainer) renderCalendar(calendarContainer);

  const diariesList = document.querySelector('.diaries-list');
  if (diariesList) renderRecentDiaries(diariesList);

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
  state,
  renderMarkdown,
  renderCalendar,
  formatDate,
  escapeHtml
};
