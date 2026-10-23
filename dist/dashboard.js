const profiles = new Map();
const profileContainer = document.querySelector('#profiles');
const profileTemplate = document.querySelector('#profile-template');
const refreshButton = document.querySelector('#refresh-button');
const authOverlay = document.querySelector('#auth-overlay');
const authForm = document.querySelector('#auth-form');
const passwordInput = document.querySelector('#password-input');
const authMessage = document.querySelector('#auth-message');
const themeToggle = document.querySelector('#theme-toggle');
const profileCacheKey = 'neetcode-dashboard-profiles';
const formatNumber = (value) => new Intl.NumberFormat().format(value || 0);

function restoreProfileCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(profileCacheKey) || 'null');
    if (!Array.isArray(cached?.profiles) || !cached.profiles.length) return false;

    profiles.clear();
    cached.profiles.forEach((entry) => {
      if (entry?.profile?.anonUsername) profiles.set(profileKey(entry.profile), entry);
    });

    if (!profiles.size) return false;
    render();
    return true;
  } catch {
    localStorage.removeItem(profileCacheKey);
    return false;
  }
}

function cacheProfiles() {
  try {
    localStorage.setItem(profileCacheKey, JSON.stringify({
      savedAt: Date.now(),
      profiles: [...profiles.values()],
    }));
  } catch {
    return;
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const darkMode = theme === 'dark';
  themeToggle.innerHTML = `${darkMode ? 'Light' : 'Dark'} mode <span aria-hidden="true">${darkMode ? '☼' : '◐'}</span>`;
  themeToggle.setAttribute('aria-label', `Switch to ${darkMode ? 'light' : 'dark'} mode`);
  localStorage.setItem('neetcode-dashboard-theme', theme);
}

function activityDays(activityByDate) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - 13 + index);
    const date = day.toISOString().slice(0, 10);
    return { date, value: Number(activityByDate?.[date]) || 0 };
  });
}

function profileKey(profile) {
  return profile.anonUsername.toLowerCase();
}

function winnerKeys(entries, valueFor) {
  const scoredEntries = entries.map(({ profile }) => ({
    key: profileKey(profile),
    value: Number(valueFor(profile)) || 0,
  }));
  const highestValue = Math.max(...scoredEntries.map(({ value }) => value), 0);
  return highestValue > 0
    ? new Set(scoredEntries.filter(({ value }) => value === highestValue).map(({ key }) => key))
    : new Set();
}

function crownMarkup(isWinner) {
  return isWinner ? '<span class="crown" role="img" aria-label="Section winner">👑</span>' : '';
}

function difficultyRow(name, stats, color, isWinner) {
  const completed = Number(stats?.completed) || 0;
  const total = Number(stats?.total) || 0;
  const percentage = total ? Math.min((completed / total) * 100, 100) : 0;

  return `<div class="difficulty-row"><span class="difficulty-name">${name}</span><div class="progress-track"><div class="progress-value" style="width:${percentage}%;background:${color}"></div></div><span class="difficulty-count">${completed}/${total}${crownMarkup(isWinner)}</span></div>`;
}

function setMetricValue(element, value, isWinner) {
  element.replaceChildren(document.createTextNode(value));
  if (isWinner) {
    const crown = document.createElement('span');
    crown.className = 'crown';
    crown.setAttribute('role', 'img');
    crown.setAttribute('aria-label', 'Section winner');
    crown.textContent = '👑';
    element.append(crown);
  }
}

function setProblemsSolvedLabel(element, isWinner) {
  element.replaceChildren(document.createTextNode('Problems solved'));
  if (isWinner) {
    const crown = document.createElement('span');
    crown.className = 'crown';
    crown.setAttribute('role', 'img');
    crown.setAttribute('aria-label', 'Section winner');
    crown.textContent = '👑';
    element.append(crown);
  }
}

function setCurrentStreakLabel(element, isWinner) {
  element.replaceChildren(document.createTextNode('Current streak'));
  if (isWinner) {
    const crown = document.createElement('span');
    crown.className = 'crown';
    crown.setAttribute('role', 'img');
    crown.setAttribute('aria-label', 'Section winner');
    crown.textContent = '👑';
    element.append(crown);
  }
}

function render() {
  profileContainer.replaceChildren();

  if (!profiles.size) {
    const emptyState = document.createElement('p');
    emptyState.className = 'state-card';
    emptyState.textContent = 'No configured profiles could be loaded.';
    profileContainer.append(emptyState);
    return;
  }

  const profileEntries = [...profiles.values()];
  const today = new Date().toISOString().slice(0, 10);
  const winners = {
    problemsSolved: winnerKeys(profileEntries, (profile) => profile.ranking?.userSolvedCount ?? profile.totalSolvedOrSubmissions),
    currentStreak: winnerKeys(profileEntries, (profile) => profile.currentStreak),
    todaySubmissions: winnerKeys(profileEntries, (profile) => profile.activityByDate?.[today]),
    easy: winnerKeys(profileEntries, (profile) => profile.ncAllDifficultyStats?.easy?.completed),
    medium: winnerKeys(profileEntries, (profile) => profile.ncAllDifficultyStats?.medium?.completed),
    hard: winnerKeys(profileEntries, (profile) => profile.ncAllDifficultyStats?.hard?.completed),
  };

  profileEntries.forEach(({ name, profile }) => {
    const content = profileTemplate.content.cloneNode(true);
    const card = content.querySelector('.profile-card');
    const ranking = profile.ranking || {};
    const difficulty = profile.ncAllDifficultyStats || {};
    const solvedCount = ranking.userSolvedCount ?? profile.totalSolvedOrSubmissions ?? 0;
    const recentActivity = activityDays(profile.activityByDate);
    const values = recentActivity.map(({ value }) => value);
    const highestActivity = Math.max(...values, 1);
    const activeDays = values.filter((value) => value > 0).length;
    const totalDifficulty = Object.values(difficulty).reduce(
      (sum, stat) => sum + (Number(stat.completed) || 0),
      0,
    );

    card.querySelector('.handle').textContent = name;
    card.querySelector('.joined').textContent = `@${profile.anonUsername}${profile.joinedYear ? ` · Joined ${profile.joinedYear}` : ''}`;
    const key = profileKey(profile);
    setProblemsSolvedLabel(card.querySelector('.problems-solved-label'), winners.problemsSolved.has(key));
    setMetricValue(card.querySelector('.problems-solved'), formatNumber(solvedCount), false);
    card.querySelector('.percentile').textContent = ranking.percentile ? `Top ${(100 - ranking.percentile).toFixed(1)}%` : '—';
    setCurrentStreakLabel(card.querySelector('.current-streak-label'), winners.currentStreak.has(key));
    setMetricValue(card.querySelector('.current-streak'), `${profile.currentStreak || 0} days`, false);
    card.querySelector('.max-streak').textContent = `${profile.maxStreak || 0} days`;
    card.querySelector('.difficulty-total').textContent = `${formatNumber(totalDifficulty)} total`;
    card.querySelector('.difficulty-list').innerHTML = [
      difficultyRow('Easy', difficulty.easy, 'var(--easy)', winners.easy.has(key)),
      difficultyRow('Medium', difficulty.medium, 'var(--medium)', winners.medium.has(key)),
      difficultyRow('Hard', difficulty.hard, 'var(--hard)', winners.hard.has(key)),
    ].join('');
    card.querySelector('.activity-summary').textContent = `${activeDays}/14 active days`;

    const chart = card.querySelector('.activity-chart');
    values.forEach((value, index) => {
      const column = document.createElement('div');
      column.className = 'activity-column';
      const bar = document.createElement('span');
      bar.className = 'activity-bar';
      bar.style.height = `${Math.max((value / highestActivity) * 100, 3)}%`;
      bar.title = `${value} activity`;
      if (index === values.length - 1) {
        const todayValue = document.createElement('span');
        todayValue.className = 'activity-today-value';
        todayValue.textContent = formatNumber(value);
        if (winners.todaySubmissions.has(key)) {
          const crown = document.createElement('span');
          crown.className = 'crown';
          crown.setAttribute('role', 'img');
          crown.setAttribute('aria-label', 'Section winner');
          crown.textContent = '👑';
          todayValue.append(crown);
        }
        column.append(todayValue);
      }
      column.append(bar);
      chart.append(column);
    });

    profileContainer.append(content);
  });
}

async function loadProfiles() {
  refreshButton.disabled = true;

  try {
    const response = await fetch('/api/profiles');
    const payload = await response.json();
    if (response.status === 401) {
      showAuthentication(payload.error);
      return;
    }
    if (!response.ok) throw new Error(payload.error || 'Unable to load profiles.');

    const loadedProfiles = new Map();
    const failures = [];
    payload.profiles.forEach((entry) => {
      if (entry.profile) loadedProfiles.set(profileKey(entry.profile), entry);
      else failures.push(entry.name);
    });
    if (loadedProfiles.size) {
      profiles.clear();
      loadedProfiles.forEach((entry, key) => profiles.set(key, entry));
      cacheProfiles();
      render();
    } else if (!profiles.size) {
      render();
    }
    if (failures.length) console.warn('Unable to load profiles for:', failures.join(', '));
  } catch (error) {
    if (!profiles.size) render();
    console.error(error);
  } finally {
    refreshButton.disabled = false;
  }
}

function showAuthentication(message = '') {
  authOverlay.hidden = false;
  authMessage.textContent = message;
  passwordInput.focus();
}

function hideAuthentication() {
  authOverlay.hidden = true;
  authMessage.textContent = '';
}

function loadInitialProfiles() {
  if (document.documentElement.dataset.authenticated !== 'true') {
    showAuthentication();
    return;
  }

  restoreProfileCache();
  loadProfiles();
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = authForm.querySelector('button');
  submitButton.disabled = true;
  authMessage.textContent = '';

  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Unable to authenticate.');

    authForm.reset();
    window.location.reload();
  } catch (error) {
    authMessage.textContent = error.message || 'Unable to authenticate.';
    passwordInput.focus();
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener('click', loadProfiles);
themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
const savedTheme = localStorage.getItem('neetcode-dashboard-theme');
setTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
render();
loadInitialProfiles();
