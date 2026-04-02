'use strict';

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const fs = require('fs');
const path = require('path');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const API_TOKEN = process.env.PANDASCORE_TOKEN || 'YOUR_PANDASCORE_API_TOKEN';
const BASE_URL  = 'https://api.pandascore.co';
const OUT_DIR   = path.join(__dirname, '..', 'output');
const SITE_NAME = 'EsportsArena';
const SITE_URL  = 'https://esportsarena.example.com'; // replace with real domain

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
function getDateRange(offsetDays) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const start = d.toISOString().split('T')[0] + 'T00:00:00Z';
  d.setUTCHours(23, 59, 59, 999);
  const end   = d.toISOString().split('T')[0] + 'T23:59:59Z';
  return { start, end };
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  }) + ' UTC';
}

function ruDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function isoDateSlug(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ─── API FETCH ────────────────────────────────────────────────────────────────
async function fetchMatches(offsetDays) {
  const { start, end } = getDateRange(offsetDays);
  const params = new URLSearchParams({
    token:                  API_TOKEN,
    'range[begin_at]':      `${start},${end}`,
    per_page:               '50',
    sort:                   'begin_at',
  });
  const url = `${BASE_URL}/matches?${params}`;
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) {
    console.warn(`  API error ${res.status} for offset ${offsetDays}`);
    return [];
  }
  return res.json();
}

// ─── GAME ICONS ───────────────────────────────────────────────────────────────
const GAME_ICONS = {
  'League of Legends': '⚔️',
  'Counter-Strike':    '🔫',
  'Dota 2':            '🛡️',
  'Valorant':          '🎯',
  'Overwatch':         '💥',
  'Rocket League':     '🚀',
  'PUBG':              '🪖',
  'Fortnite':          '🏗️',
  'Rainbow Six Siege': '🧨',
  'King of Glory':     '👑',
};

function gameIcon(name) {
  for (const [key, icon] of Object.entries(GAME_ICONS)) {
    if (name && name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🎮';
}

function statusBadge(status) {
  const map = {
    'running':   ['LIVE', '#ff3e3e'],
    'not_started': ['Скоро', '#f5a623'],
    'finished':  ['Завершён', '#4caf50'],
    'canceled':  ['Отменён', '#888'],
    'postponed': ['Перенесён', '#888'],
  };
  const [label, color] = map[status] || ['—', '#888'];
  return `<span class="badge" style="background:${color}">${label}</span>`;
}

// ─── HTML TEMPLATE ────────────────────────────────────────────────────────────
function buildMatchCard(m) {
  const opponents = m.opponents || [];
  const team1 = opponents[0]?.opponent;
  const team2 = opponents[1]?.opponent;
  const score1 = m.results?.[0]?.score ?? '?';
  const score2 = m.results?.[1]?.score ?? '?';
  const game   = m.videogame?.name || 'Esports';
  const league = m.league?.name   || '';
  const serie  = m.serie?.full_name || m.serie?.name || '';
  const logo1  = team1?.image_url;
  const logo2  = team2?.image_url;

  return `
<article class="match-card" itemscope itemtype="https://schema.org/SportsEvent">
  <meta itemprop="startDate" content="${m.begin_at || ''}">
  <meta itemprop="endDate"   content="${m.end_at   || ''}">
  <meta itemprop="eventStatus" content="https://schema.org/EventScheduled">
  <meta itemprop="url"       content="${SITE_URL}/matches/${m.id}">
  <div class="card-header">
    <span class="game-label" itemprop="sport">${gameIcon(game)} ${game}</span>
    <span class="tournament" itemprop="name">${league}${serie ? ' · ' + serie : ''}</span>
    ${statusBadge(m.status)}
  </div>
  <div class="teams-row">
    <div class="team" itemprop="homeTeam" itemscope itemtype="https://schema.org/SportsTeam">
      ${logo1 ? `<img class="team-logo" src="${logo1}" alt="${team1?.name}" loading="lazy">` : '<div class="team-logo placeholder">?</div>'}
      <span class="team-name" itemprop="name">${team1?.name || 'TBD'}</span>
    </div>
    <div class="score-block">
      <span class="score">${score1} <span class="vs">vs</span> ${score2}</span>
      <time class="match-time" datetime="${m.begin_at || ''}">${formatDate(m.begin_at)}</time>
    </div>
    <div class="team team-right" itemprop="awayTeam" itemscope itemtype="https://schema.org/SportsTeam">
      ${logo2 ? `<img class="team-logo" src="${logo2}" alt="${team2?.name}" loading="lazy">` : '<div class="team-logo placeholder">?</div>'}
      <span class="team-name" itemprop="name">${team2?.name || 'TBD'}</span>
    </div>
  </div>
  ${m.name ? `<div class="match-footer">📋 ${m.name}</div>` : ''}
</article>`;
}

function buildPage({ title, description, slug, canonicalUrl, dateLabel, matches, navLinks, schemaOrg }) {
  const matchCards = matches.length
    ? matches.map(buildMatchCard).join('\n')
    : '<div class="empty-state">🎮 Матчи не найдены на эту дату</div>';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- SEO -->
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url"         content="${canonicalUrl}">
  <meta property="og:site_name"   content="${SITE_NAME}">
  <meta property="og:locale"      content="ru_RU">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${title}">
  <meta name="twitter:description" content="${description}">

  <!-- Schema.org Organization + WebSite -->
  <script type="application/ld+json">
  ${JSON.stringify(schemaOrg, null, 2)}
  </script>

  <style>
    /* ── RESET & BASE ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:        #0a0d14;
      --surface:   #111622;
      --surface2:  #1a2135;
      --border:    #1e2d4a;
      --accent:    #00d4ff;
      --accent2:   #7b61ff;
      --text:      #e8edf5;
      --text-muted:#7a8aaa;
      --red:       #ff3e3e;
      --green:     #00e676;
      --radius:    12px;
      --font-head: 'Rajdhani', 'Orbitron', sans-serif;
      --font-body: 'IBM Plex Sans', 'Segoe UI', sans-serif;
    }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 15px;
      line-height: 1.6;
      min-height: 100vh;
    }

    /* ── FONTS ── */
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

    /* ── BACKGROUND GRID ── */
    body::before {
      content: '';
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(0,212,255,.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
      z-index: 0;
    }

    /* ── HEADER ── */
    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(10,13,20,.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
    }
    .header-inner {
      max-width: 1100px;
      margin: auto;
      display: flex;
      align-items: center;
      gap: 32px;
      height: 62px;
    }
    .logo {
      font-family: var(--font-head);
      font-size: 1.4rem;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
      text-decoration: none;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .logo span { -webkit-text-fill-color: var(--text); }

    /* ── NAV ── */
    nav { display: flex; gap: 4px; margin-left: auto; }
    nav a {
      padding: 6px 16px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: .85rem;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--text-muted);
      transition: all .2s;
      border: 1px solid transparent;
    }
    nav a:hover { color: var(--accent); border-color: var(--border); }
    nav a.active {
      color: var(--accent);
      background: rgba(0,212,255,.08);
      border-color: rgba(0,212,255,.25);
    }

    /* ── HERO STRIP ── */
    .hero {
      position: relative;
      max-width: 1100px;
      margin: 40px auto 0;
      padding: 0 24px;
    }
    .hero-tag {
      display: inline-block;
      font-size: .72rem;
      font-weight: 600;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--accent);
      border: 1px solid rgba(0,212,255,.3);
      border-radius: 4px;
      padding: 3px 10px;
      margin-bottom: 10px;
    }
    h1 {
      font-family: var(--font-head);
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      font-weight: 900;
      letter-spacing: .04em;
      line-height: 1.1;
      text-transform: uppercase;
    }
    h1 em {
      font-style: normal;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-sub {
      margin-top: 8px;
      color: var(--text-muted);
      font-size: .95rem;
    }
    .match-count {
      margin-top: 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: .82rem;
      color: var(--text-muted);
    }
    .match-count strong { color: var(--text); font-size: 1.1rem; }

    /* ── DIVIDER ── */
    .divider {
      max-width: 1100px;
      margin: 24px auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-muted);
      font-size: .75rem;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1;
      height: 1px;
      background: var(--border);
    }

    /* ── MATCH GRID ── */
    .matches-grid {
      max-width: 1100px;
      margin: 0 auto 60px;
      padding: 0 24px;
      display: grid;
      gap: 14px;
      grid-template-columns: 1fr;
    }
    @media(min-width:700px){ .matches-grid { grid-template-columns: 1fr 1fr; } }
    @media(min-width:1000px){ .matches-grid { grid-template-columns: 1fr 1fr 1fr; } }

    /* ── MATCH CARD ── */
    .match-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color .2s, transform .2s, box-shadow .2s;
      position: relative;
      overflow: hidden;
    }
    .match-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      opacity: 0;
      transition: opacity .2s;
    }
    .match-card:hover {
      border-color: rgba(0,212,255,.3);
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0,0,0,.4);
    }
    .match-card:hover::before { opacity: 1; }

    /* card header */
    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .game-label {
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .tournament {
      font-size: .72rem;
      color: var(--text-muted);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badge {
      font-size: .65rem;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fff;
      flex-shrink: 0;
    }

    /* teams row */
    .teams-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .team {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }
    .team-right { align-items: center; }
    .team-logo {
      width: 48px; height: 48px;
      object-fit: contain;
      border-radius: 8px;
      background: var(--surface2);
    }
    .team-logo.placeholder {
      width: 48px; height: 48px;
      border-radius: 8px;
      background: var(--surface2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      color: var(--text-muted);
    }
    .team-name {
      font-size: .78rem;
      font-weight: 600;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    /* score */
    .score-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .score {
      font-family: var(--font-head);
      font-size: 1.5rem;
      font-weight: 900;
      letter-spacing: .06em;
      color: var(--text);
    }
    .vs { color: var(--text-muted); font-size: .9rem; }
    .match-time {
      font-size: .68rem;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .match-footer {
      font-size: .72rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      padding-top: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* empty state */
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
      font-size: 1.1rem;
    }

    /* ── FOOTER ── */
    footer {
      border-top: 1px solid var(--border);
      text-align: center;
      padding: 28px 24px;
      color: var(--text-muted);
      font-size: .8rem;
    }
    footer a { color: var(--accent); text-decoration: none; }

    /* ── LIVE PULSE ── */
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .badge[style*="#ff3e3e"] { animation: pulse 1.4s infinite; }
  </style>
</head>
<body>

<header>
  <div class="header-inner">
    <a class="logo" href="index.html">${SITE_NAME}<span>.</gg</span></a>
    <nav>
      ${navLinks}
    </nav>
  </div>
</header>

<main>
  <section class="hero">
    <div class="hero-tag">Киберспорт · Live Scores</div>
    <h1>${title.replace(SITE_NAME + ' — ', '').replace(/ \| .+$/, '').replace(/^(Матчи .+)$/, '<em>$1</em>')}</h1>
    <p class="hero-sub">${description}</p>
    <div class="match-count">
      Найдено матчей: <strong>${matches.length}</strong>
    </div>
  </section>

  <div class="divider">${dateLabel}</div>

  <div class="matches-grid" itemscope itemtype="https://schema.org/ItemList">
    ${matchCards}
  </div>
</main>

<footer>
  <p>Данные предоставлены <a href="https://pandascore.co" target="_blank" rel="noopener">PandaScore API</a> &nbsp;·&nbsp; ${SITE_NAME} © ${new Date().getFullYear()}</p>
</footer>

</body>
</html>`;
}

// ─── SCHEMA.ORG ──────────────────────────────────────────────────────────────
function buildSchema(pageTitle, pageUrl, dateLabel, matches) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        "name": SITE_NAME,
        "url": SITE_URL,
        "logo": {
          "@type": "ImageObject",
          "url": `${SITE_URL}/logo.png`
        },
        "sameAs": []
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        "url": SITE_URL,
        "name": SITE_NAME,
        "publisher": { "@id": `${SITE_URL}/#organization` },
        "inLanguage": "ru-RU"
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        "url": pageUrl,
        "name": pageTitle,
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "inLanguage": "ru-RU",
        "dateModified": new Date().toISOString()
      },
      {
        "@type": "ItemList",
        "name": `Киберспортивные матчи — ${dateLabel}`,
        "numberOfItems": matches.length,
        "itemListElement": matches.slice(0, 10).map((m, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "item": {
            "@type": "SportsEvent",
            "name": m.name || `${m.opponents?.[0]?.opponent?.name || 'TBD'} vs ${m.opponents?.[1]?.opponent?.name || 'TBD'}`,
            "startDate": m.begin_at,
            "url": `${SITE_URL}/matches/${m.id}`
          }
        }))
      }
    ]
  };
}

// ─── NAV LINKS ────────────────────────────────────────────────────────────────
// Pages use CLEAN slugs — no query params
const PAGES = [
  { file: 'yesterday.html', label: 'Вчера',    offset: -1 },
  { file: 'index.html',     label: 'Сегодня',  offset:  0 },
  { file: 'tomorrow.html',  label: 'Завтра',   offset:  1 },
];

function navLinks(activeFile) {
  return PAGES.map(p =>
    `<a href="${p.file}" class="${p.file === activeFile ? 'active' : ''}">${p.label}</a>`
  ).join('\n      ');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function generate() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\n🚀 EsportsArena Site Generator\n');

  for (const page of PAGES) {
    console.log(`\n📅 Generating: ${page.label} (${page.file})`);

    const dateLabel = ruDate(page.offset);
    const slug      = isoDateSlug(page.offset);

    let matches = [];
    try {
      matches = await fetchMatches(page.offset);
      console.log(`  ✅ ${matches.length} матчей получено`);
    } catch (e) {
      console.warn(`  ⚠️  Ошибка API: ${e.message}. Используем пустой список.`);
    }

    const titles = {
      '-1': `Матчи вчера ${dateLabel} — Киберспорт`,
       '0': `Матчи сегодня ${dateLabel} — Киберспорт`,
       '1': `Матчи завтра ${dateLabel} — Киберспорт`,
    };
    const descs = {
      '-1': `Результаты вчерашних киберспортивных матчей за ${dateLabel}. CS2, Dota 2, LoL, Valorant и другие дисциплины.`,
       '0': `Киберспортивные матчи сегодня ${dateLabel}: расписание и результаты в реальном времени. CS2, Dota 2, LoL, Valorant.`,
       '1': `Расписание киберспортивных матчей на завтра ${dateLabel}. Предстоящие игры по CS2, Dota 2, LoL и Valorant.`,
    };

    const key  = String(page.offset);
    const title = `${SITE_NAME} — ${titles[key]}`;
    const desc  = descs[key];
    const pageUrl = `${SITE_URL}/${page.file}`;
    const schema  = buildSchema(title, pageUrl, dateLabel, matches);

    const html = buildPage({
      title, description: desc,
      slug, canonicalUrl: pageUrl,
      dateLabel, matches,
      navLinks: navLinks(page.file),
      schemaOrg: schema,
    });

    const outPath = path.join(OUT_DIR, page.file);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`  💾 Сохранено: ${outPath}`);
  }

  console.log('\n✅ Готово! Сайт сгенерирован в папку /output\n');
}

generate().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
