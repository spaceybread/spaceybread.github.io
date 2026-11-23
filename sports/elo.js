(function () {
  const BASE = 'https://site.api.espn.com/apis';
  const START = 1600;
  const CONCURRENCY = 6;

  // margin-of-victory multipliers (m = winner's margin, d = winner's elo minus loser's)
  const logMult = (m, d) => Math.log(m + 1) * (2.2 / (d * 0.001 + 2.2));
  const nbaMult = (m, d) => Math.pow(m + 3, 0.8) / (7.5 + 0.006 * d);
  const nhlMult = (m, d) => (0.6686 * Math.log(m) + 0.8048) * (2.05 / (d * 0.001 + 2.05));

  const LEAGUES = {
    nfl: {
      name: 'NFL', path: 'football/nfl', K: 20, mult: logMult, splitYear: false,
      rounds: ['Wild Card', 'Divisional', 'Conference', 'Super Bowl'], winsNeeded: [1, 1, 1, 1],
    },
    nba: {
      name: 'NBA', path: 'basketball/nba', K: 20, mult: nbaMult, splitYear: true, playIn: true,
      rounds: ['1st Round', 'Conf Semis', 'Conf Finals', 'Finals'], winsNeeded: [4, 4, 4, 4],
    },
    nhl: {
      name: 'NHL', path: 'hockey/nhl', K: 6, mult: nhlMult, splitYear: true,
      rounds: ['1st Round', '2nd Round', 'Conf Final', 'Cup Final'], winsNeeded: [4, 4, 4, 4],
    },
    mlb: {
      name: 'MLB', path: 'baseball/mlb', K: 4, mult: logMult, splitYear: false,
      rounds: ['Wild Card', 'Division Series', 'LCS', 'World Series'], winsNeeded: [2, 3, 4, 4],
    },
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- fetching ----------

  async function getJSON(url, tries = 3) {
    for (let i = 0; ; i++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        if (i >= tries - 1) throw err;
        await sleep(500 * (i + 1));
      }
    }
  }

  // run fn over items with at most n requests in flight, so ESPN doesn't start dropping connections
  async function pool(items, n, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const k = next++;
        out[k] = await fn(items[k]);
      }
    };
    await Promise.all(Array.from({ length: n }, worker));
    return out;
  }

  function headline(comp) {
    return ((comp.notes || [])[0] || {}).headline || '';
  }

  function roundOf(comp) {
    const byType = { RD16: 0, QTR: 1, SEMI: 2, FINAL: 3 };
    const t = comp.type && comp.type.abbreviation;
    if (t in byType) return byType[t];
    const h = headline(comp); // the NFL labels every playoff game "STD", so go by the headline
    if (/wild ?card/i.test(h)) return 0;
    if (/divisional/i.test(h)) return 1;
    if (/championship/i.test(h)) return 2;
    if (/super bowl/i.test(h)) return 3;
    return -1;
  }

  function confOf(comp) {
    const m = headline(comp).match(/^(East|West|AFC|NFC|AL|NL)/);
    return m ? m[1] : '';
  }

  const scoreOf = (s) => (s && typeof s === 'object' ? Number(s.value) : Number(s));

  async function loadYear(L, year, withPost) {
    const standings = await getJSON(`${BASE}/v2/sports/${L.path}/standings?level=3&season=${year}`);

    const teams = {};
    const divisions = [];
    for (const conf of standings.children || []) {
      for (const div of conf.children || [conf]) {
        const ids = [];
        for (const e of (div.standings || {}).entries || []) {
          const t = e.team;
          const stat = (name) => ((e.stats || []).find((s) => s.name === name) || {}).displayValue;
          const record = stat('overall') ? stat('overall').split(',')[0] // NHL appends ", 109 PTS"
            : stat('wins') ? `${stat('wins')}-${stat('losses')}` : '';
          teams[t.id] = {
            id: t.id,
            name: t.shortDisplayName || t.name,
            color: '#555',
            alt: '#555',
            record,
          };
          ids.push(t.id);
        }
        if (ids.length) divisions.push({ name: div.name, ids });
      }
    }

    const types = [2];
    if (withPost) types.push(3);
    if (withPost && L.playIn) types.push(5);

    // the schedule only carries a team's primary colour; the core API has the accent too
    const [sport, league] = L.path.split('/');
    const jobs = [];
    for (const id in teams) {
      jobs.push({ id, url: `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/teams/${id}` });
      for (const st of types) jobs.push({ id, st, url: `${BASE}/site/v2/sports/${L.path}/teams/${id}/schedule?season=${year}&seasontype=${st}` });
    }

    let failed = 0;
    const results = await pool(jobs, CONCURRENCY, (job) =>
      getJSON(job.url)
        .then((d) => ({ ...job, d }))
        .catch(() => { if (job.st) failed++; return { ...job, d: {} }; }));

    for (const { id, st, d } of results) {
      if (st) continue;
      if (d.color) teams[id].color = '#' + d.color;
      teams[id].alt = '#' + (d.alternateColor || d.color || '555');
    }

    const seen = new Set();
    const games = [];
    for (const { id, st, d } of results) {
      if (!st) continue;
      if (d.team && d.team.color && teams[id].color === '#555') teams[id].color = '#' + d.team.color;

      for (const ev of d.events || []) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);

        const comp = ev.competitions[0];
        const sides = {};
        for (const c of comp.competitors) {
          if (!teams[c.team.id]) continue; // all-star games and the like
          sides[c.homeAway] = { id: c.team.id, score: scoreOf(c.score) };
        }
        if (!sides.home || !sides.away) continue;

        const status = (comp.status || ev.status || {}).type || {};
        games.push({
          date: new Date(ev.date),
          post: st === 3,
          round: st === 3 ? roundOf(comp) : -1,
          conf: st === 3 ? confOf(comp) : '',
          done: !!status.completed,
          home: sides.home,
          away: sides.away,
        });
      }
    }

    games.sort((a, b) => a.date - b.date);
    return { year, teams, divisions, games, failed };
  }

  async function loadLeague(key) {
    const L = LEAGUES[key];
    const sb = await getJSON(`${BASE}/site/v2/sports/${L.path}/scoreboard`);
    const phase = sb.season.type; // 1 pre, 2 regular, 3 post, 4 off
    let year = sb.season.year;

    if (phase === 1) year -= 1; // preseason: the last full season is the interesting one
    let data = await loadYear(L, year, phase !== 2);

    if (phase !== 2 && !data.games.some((g) => g.done && !g.post)) {
      data = await loadYear(L, year - 1, true);
    }
    return data;
  }

  // ---------- elo ----------

  function runElo(L, games, teams) {
    const state = {};
    for (const id in teams) state[id] = { ...teams[id], elo: START, last: 0, hist: [] };

    const played = [];
    for (const g of games) {
      if (!g.done) continue;
      const h = state[g.home.id];
      const a = state[g.away.id];

      const diff = h.elo - a.elo;
      const expHome = 1 / (1 + Math.pow(10, -diff / 400));
      const margin = g.home.score - g.away.score;
      const actual = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
      const mult = margin === 0 ? 1 : L.mult(Math.abs(margin), margin > 0 ? diff : -diff);

      const shift = L.K * mult * (actual - expHome);
      h.elo += shift;
      a.elo -= shift;
      h.last = shift;
      a.last = -shift;
      h.hist.push({ date: g.date, post: g.post, opp: a.id, home: true, us: g.home.score, them: g.away.score, elo: h.elo, shift });
      a.hist.push({ date: g.date, post: g.post, opp: h.id, home: false, us: g.away.score, them: g.home.score, elo: a.elo, shift: -shift });
      played.push({ ...g, shift });
    }
    return { state, played };
  }

  // ---------- bracket ----------

  function buildSeries(L, games) {
    const map = new Map();
    for (const g of games) {
      if (!g.post || g.round < 0) continue;
      const ids = [g.home.id, g.away.id].sort();
      const key = g.round + ':' + ids.join('-');
      let s = map.get(key);
      if (!s) {
        s = { round: g.round, conf: g.conf, teams: ids, wins: { [ids[0]]: 0, [ids[1]]: 0 }, last: null, first: g.date };
        map.set(key, s);
      }
      if (g.done) {
        const m = g.home.score - g.away.score;
        if (m) s.wins[m > 0 ? g.home.id : g.away.id]++;
        s.last = g;
      }
    }

    const series = [...map.values()];
    for (const s of series) {
      s.winner = s.teams.find((t) => s.wins[t] >= L.winsNeeded[s.round]) || null;
    }

    const feeder = (s, team) => series.find((x) => x.round === s.round - 1 && x.teams.includes(team)) || null;
    for (const s of series) {
      // a team with no feeder had a bye; list it first, like a top seed
      s.order = [...s.teams].sort((a, b) => (feeder(s, a) ? 1 : 0) - (feeder(s, b) ? 1 : 0));
      s.kids = s.round > 0 ? s.order.map((t) => feeder(s, t)) : [];
    }
    return series;
  }

  function bracketHTML(L, series, state) {
    if (!series.length) return '';

    const isRoot = (s) => !series.some((x) => x.round === s.round + 1 && x.teams.some((t) => s.teams.includes(t)));
    const roots = series.filter(isRoot).sort((a, b) => a.conf.localeCompare(b.conf) || b.round - a.round || a.first - b.first);
    const maxRound = Math.max(...series.map((s) => s.round));

    const cells = [];
    let row = 2; // row 1 holds the round names
    const place = (s) => {
      if (!s) { row++; return; } // bye
      const start = row;
      if (s.kids.length) s.kids.forEach(place);
      else row++;
      cells.push({ s, start, span: row - start });
    };
    roots.forEach(place);

    const side = (s, id) => {
      const t = state[id];
      const cls = s.winner ? (s.winner === id ? 'won' : 'lost') : '';
      let w = s.wins[id];
      if (L.winsNeeded[s.round] === 1) w = s.last ? (s.last.home.id === id ? s.last.home.score : s.last.away.score) : '';
      return `<div class="side ${cls}">${swatch(t)}` +
        `<span class="name">${esc(t.name)}</span><span class="w">${w}</span></div>`;
    };

    let html = `<div class="bracket" style="grid-template-columns:repeat(${maxRound + 1}, max-content)">`;
    for (let r = 0; r <= maxRound; r++) {
      html += `<div class="round" style="grid-column:${r + 1};grid-row:1">${L.rounds[r]}</div>`;
    }
    for (const { s, start, span } of cells) {
      html += `<div class="series" style="grid-column:${s.round + 1};grid-row:${start} / span ${span}">` +
        s.order.map((id) => side(s, id)).join('') + '</div>';
    }
    return '<h3>Playoffs</h3><div class="bracket-wrap">' + html + '</div></div>';
  }

  // ---------- rendering ----------

  const swatch = (t) => `<span class="swatch" style="background:${t.color};border-bottom-color:${t.alt}"></span>`;

  function delta(x) {
    const r = Math.round(x);
    if (r === 0) return '<span class="flat-txt">·</span>';
    return r > 0 ? `<span class="up-txt">+${r}</span>` : `<span class="down-txt">${r}</span>`;
  }

  function table(rows, spread, showRank) {
    const body = rows.map((t, i) => {
      const off = t.elo - START;
      const pct = (Math.abs(off) / spread) * 50;
      const bar = off >= 0
        ? `<span class="up" style="left:50%;width:${pct}%"></span>`
        : `<span class="down" style="right:50%;width:${pct}%"></span>`;
      return `<tr class="team" data-id="${t.id}" tabindex="0">
        ${showRank ? `<td class="rank num">${i + 1}</td>` : ''}
        <td>${swatch(t)}${esc(t.name)}</td>
        <td class="num">${esc(t.record)}</td>
        <td class="num">${Math.round(t.elo)}</td>
        <td class="num">${delta(t.last)}</td>
        <td class="bar-cell"><div class="bar">${bar}</div></td>
      </tr>`;
    }).join('');

    return `<table class="elo">
      <thead><tr>
        ${showRank ? '<th class="num">#</th>' : ''}
        <th>team</th><th class="num">rec</th><th class="num">elo</th><th class="num">last</th><th class="bar-cell"></th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  }

  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // ---------- per-team history chart ----------

  function toggleHistory(tr, state) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('hist')) {
      next.remove();
      tr.classList.remove('open');
      return;
    }
    const row = document.createElement('tr');
    row.className = 'hist';
    row.innerHTML = `<td colspan="${tr.children.length}"><div class="chart"></div></td>`;
    tr.after(row);
    tr.classList.add('open');
    drawHistory(row.querySelector('.chart'), state[tr.dataset.id], state);
  }

  function drawHistory(el, team, state) {
    if (!team.hist.length) {
      el.innerHTML = '<p class="meta">no games yet</p>';
      return;
    }

    const pts = [{ elo: START }, ...team.hist]; // point 0 is the season start
    const W = Math.max(300, el.clientWidth || 600);
    const H = 150;
    const pad = { l: 40, r: 44, t: 14, b: 22 };

    const vals = pts.map((p) => p.elo);
    const lo = Math.min(START, ...vals);
    const hi = Math.max(START, ...vals);
    const room = Math.max(20, hi - lo) * 0.08;
    const y0 = lo - room, y1 = hi + room;

    const x = (i) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    const label = (tx, ty, text, anchor, cls = 'axis') =>
      `<text class="${cls}" x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(text)}</text>`;

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(team.name)} Elo by game">`;

    // 1600 reference, plus the season's high and low when they're far enough from it to read
    svg += `<line class="ref" x1="${pad.l}" x2="${W - pad.r}" y1="${y(START)}" y2="${y(START)}"/>`;
    svg += label(pad.l - 6, y(START) + 4, START, 'end');
    for (const v of [Math.max(...vals), Math.min(...vals)]) {
      if (Math.abs(y(v) - y(START)) > 14) svg += label(pad.l - 6, y(v) + 4, Math.round(v), 'end');
    }

    const postAt = pts.findIndex((p) => p.post);
    if (postAt > 0) {
      const px = (x(postAt - 1) + x(postAt)) / 2;
      svg += `<line class="sep" x1="${px}" x2="${px}" y1="${pad.t - 4}" y2="${H - pad.b}"/>`;
      svg += label(px + 4, pad.t - 4, 'playoffs', 'start');
    }

    svg += label(x(1), H - 6, fmtDate(pts[1].date), 'start');
    if (pts.length > 2) svg += label(x(pts.length - 1), H - 6, fmtDate(pts[pts.length - 1].date), 'end');

    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.elo).toFixed(1)}`).join('');
    svg += `<path class="line" d="${d}"/>`;

    const end = pts.length - 1;
    svg += `<circle class="dot" cx="${x(end)}" cy="${y(pts[end].elo)}" r="3.5"/>`;
    svg += label(x(end) + 8, y(pts[end].elo) + 4, Math.round(pts[end].elo), 'start', 'val');

    // hover layer
    svg += `<line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>`;
    svg += `<circle class="dot hover" r="4" visibility="hidden"/>`;
    svg += `<rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}"/>`;
    svg += '</svg><div class="tip" hidden></div>';
    el.innerHTML = svg;

    const svgEl = el.querySelector('svg');
    const cross = el.querySelector('.cross');
    const dot = el.querySelector('.dot.hover');
    const tip = el.querySelector('.tip');

    const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    el.querySelector('.hit').addEventListener('pointerleave', hide);
    el.querySelector('.hit').addEventListener('pointermove', (e) => {
      const box = svgEl.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * W;
      const i = Math.max(0, Math.min(end, Math.round(((sx - pad.l) / (W - pad.l - pad.r)) * end)));
      const p = pts[i];

      cross.setAttribute('x1', x(i));
      cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(i));
      dot.setAttribute('cy', y(p.elo));
      dot.setAttribute('visibility', 'visible');

      if (i === 0) {
        tip.innerHTML = `season start<br>${START}`;
      } else {
        const res = p.us > p.them ? 'W' : p.us < p.them ? 'L' : 'T';
        tip.innerHTML = `${fmtDate(p.date)} · ${res} ${p.us}–${p.them} ${p.home ? 'vs' : '@'} ${esc(state[p.opp].name)}` +
          `<br>${Math.round(p.elo)} ${delta(p.shift)}`;
      }
      tip.hidden = false;
      const px = (x(i) / W) * box.width;
      const left = px > box.width / 2 ? px - tip.offsetWidth - 12 : px + 12;
      tip.style.left = `${left}px`;
      tip.style.top = `${(y(p.elo) / H) * box.height - tip.offsetHeight / 2}px`;
    });
  }
  const seasonLabel = (L, year) => (L.splitYear ? `${year - 1}–${String(year).slice(2)}` : String(year));

  let view = 'ranked';
  let current = null;
  const cache = {};

  function render(key, data) {
    const L = LEAGUES[key];
    const { state, played } = runElo(L, data.games, data.teams);
    const all = Object.values(state).sort((a, b) => b.elo - a.elo);
    const spread = Math.max(1, ...all.map((t) => Math.abs(t.elo - START)));

    const views = {
      ranked: () => table(all, spread, true),
      division: () => data.divisions.map(({ name, ids }) => {
        const rows = ids.map((id) => state[id]).sort((a, b) => b.elo - a.elo);
        return `<h3>${esc(name)}</h3>` + table(rows, spread, false);
      }).join(''),
    };
    const show = (v) => {
      view = v;
      $('tables').innerHTML = views[v]();
      for (const b of document.querySelectorAll('#views button')) b.classList.toggle('active', b.dataset.view === v);
    };
    for (const b of document.querySelectorAll('#views button')) b.onclick = () => show(b.dataset.view);
    $('tables').onclick = (e) => {
      const tr = e.target.closest('tr.team');
      if (tr) toggleHistory(tr, state);
    };
    $('tables').onkeydown = (e) => {
      const tr = e.target.closest && e.target.closest('tr.team');
      if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleHistory(tr, state); }
    };
    $('views').hidden = false;
    show(view);

    $('title').textContent = `${L.name} Elo, ${seasonLabel(L, data.year)}`;

    const series = buildSeries(L, data.games);
    const last = played[played.length - 1];
    let status = played.length
      ? `${played.length} games played · last: ${state[last.away.id].name} @ ${state[last.home.id].name}, ${fmtDate(last.date)}`
      : `no games played yet; everyone is still at ${START}`;
    if (data.failed) status += ` · ${data.failed} schedule request(s) failed, a few games may be missing`;
    $('status').textContent = status;

    $('bracket').innerHTML = bracketHTML(L, series, state);

    let html = '';
    const recent = played.slice(-8).reverse();
    if (recent.length) {
      html += '<h3>Recent games</h3><ul class="games">' + recent.map((g) => {
        const a = state[g.away.id], h = state[g.home.id];
        const awayWon = g.away.score > g.home.score;
        return `<li>${fmtDate(g.date)} &nbsp; ${esc(a.name)} ${g.away.score} @ ${esc(h.name)} ${g.home.score}
          &nbsp; <span class="meta">(${esc((awayWon ? a : h).name)} ${delta(awayWon ? -g.shift : g.shift)})</span></li>`;
      }).join('') + '</ul>';
    }

    const cutoff = Date.now() - 12 * 3600 * 1000;
    const next = data.games.filter((g) => !g.done && g.date >= cutoff).slice(0, 8);
    if (next.length) {
      html += '<h3>Up next</h3><ul class="games">' + next.map((g) => {
        const a = state[g.away.id], h = state[g.home.id];
        const pHome = 1 / (1 + Math.pow(10, -(h.elo - a.elo) / 400));
        const fav = pHome >= 0.5 ? h : a;
        const p = Math.round(Math.max(pHome, 1 - pHome) * 100);
        return `<li>${fmtDate(g.date)} &nbsp; ${esc(a.name)} @ ${esc(h.name)}
          &nbsp; <span class="meta">${esc(fav.name)} ${p}%</span></li>`;
      }).join('') + '</ul>';
    }
    $('recent').innerHTML = html;
  }

  function select(key) {
    if (!LEAGUES[key]) key = 'nfl';
    current = key;
    for (const b of document.querySelectorAll('#leagues button')) b.classList.toggle('active', b.dataset.league === key);

    $('title').textContent = `${LEAGUES[key].name} Elo`;
    $('status').textContent = 'fetching games ...';
    $('views').hidden = true;
    $('tables').innerHTML = $('bracket').innerHTML = $('recent').innerHTML = '';

    cache[key] = cache[key] || loadLeague(key);
    cache[key]
      .then((data) => { if (current === key) render(key, data); })
      .catch((err) => {
        delete cache[key];
        if (current === key) $('status').textContent = `couldn't load games (${err.message}). try refreshing.`;
      });
  }

  for (const b of document.querySelectorAll('#leagues button')) {
    b.onclick = () => { location.hash = b.dataset.league; };
  }
  window.addEventListener('hashchange', () => select(location.hash.slice(1)));
  select(location.hash.slice(1));
})();
