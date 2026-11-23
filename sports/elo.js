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
      games: 17, name: 'NFL', path: 'football/nfl', K: 20, mult: logMult, splitYear: false,
      rounds: ['Wild Card', 'Divisional', 'Conference', 'Super Bowl'], winsNeeded: [1, 1, 1, 1],
      playoff: { divTop: 1, wild: 3 }, // per conference
      clinch: { '*': 'clinched the #1 seed and a bye', z: 'clinched the division', y: 'clinched a wild card', x: 'clinched a playoff spot', e: 'eliminated from playoff contention' },
    },
    nba: {
      games: 82, name: 'NBA', path: 'basketball/nba', K: 20, mult: nbaMult, splitYear: true, playIn: true,
      rounds: ['1st Round', 'Conf Semis', 'Conf Finals', 'Finals'], winsNeeded: [4, 4, 4, 4],
      playoff: { divTop: 0, wild: 6, playIn: true }, // seeds 7-10 go through the play-in
      clinch: { '*': 'clinched the best record in the league', z: 'clinched the #1 seed in the conference', y: 'clinched the division', x: 'clinched a playoff spot', xp: 'reached the playoffs through the play-in', pb: 'clinched a play-in spot', e: 'eliminated from playoff contention' },
    },
    nhl: {
      games: 82, name: 'NHL', path: 'hockey/nhl', K: 6, mult: nhlMult, splitYear: true,
      rounds: ['1st Round', '2nd Round', 'Conf Final', 'Cup Final'], winsNeeded: [4, 4, 4, 4],
      playoff: { divTop: 3, wild: 2, points: true },
      clinch: { '*': "clinched the Presidents' Trophy (best record)", z: 'clinched the conference', y: 'clinched the division', x: 'clinched a playoff spot', e: 'eliminated from playoff contention' },
    },
    wnba: {
      games: 44, name: 'WNBA', path: 'basketball/wnba', K: 20, mult: nbaMult, splitYear: false,
      rounds: ['First Round', 'Semifinals', 'Finals'], winsNeeded: [2, 3, 4],
      roundMap: { RD16: 0, SEMI: 1, FINAL: 2 }, // ESPN skips a quarterfinal code here
      groups: 'conference',
      playoff: { divTop: 0, wild: 8, overall: true }, // top 8 regardless of conference
      clinch: { '*': 'clinched the #1 seed', x: 'clinched a playoff spot', e: 'eliminated from playoff contention' },
    },
    cfb: {
      // college: too many teams and too few games for Elo, so a season-long power rating instead (see rateCfb);
      // its settings were picked by backtesting 2021-2025, predicting each week from the weeks before it
      kind: 'cfb', games: 12, name: 'CFB', path: 'football/college-football', splitYear: false, base: 0,
      rounds: ['First Round', 'Quarterfinals', 'Semifinals', 'Championship'], winsNeeded: [1, 1, 1, 1],
      cap: 28, // margins beyond this don't count, so running up the score doesn't pay
      ridge: 2, // pull towards last season's rating, worth about two games of evidence
      carry: 0.8, // share of last season's rating a team starts with
      sigma: 12.5, // spread of college margins around the rating gap, for win probabilities
      weeks: 16,
    },
    mlb: {
      games: 162, name: 'MLB', path: 'baseball/mlb', K: 4, mult: logMult, splitYear: false,
      rounds: ['Wild Card', 'Division Series', 'LCS', 'World Series'], winsNeeded: [2, 3, 4, 4],
      playoff: { divTop: 1, wild: 3 }, // per league
      clinch: { '*': 'clinched the #1 seed and a bye', x: 'clinched the division', y: 'clinched a wild card', e: 'eliminated from playoff contention' },
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

  function roundOf(comp, L) {
    const byType = L.roundMap || { RD16: 0, QTR: 1, SEMI: 2, FINAL: 3 };
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
          const num = (name) => Number(((e.stats || []).find((s) => s.name === name) || {}).value) || 0;
          const record = stat('overall') ? stat('overall').split(',')[0] // NHL appends ", 109 PTS"
            : stat('wins') ? `${stat('wins')}-${stat('losses')}` : '';
          teams[t.id] = {
            id: t.id,
            name: t.shortDisplayName || t.name,
            color: '#555',
            alt: '#555',
            record,
            wl: { w: num('wins'), l: num('losses'), t: num('ties'), pts: num('points') },
            clinch: stat('clincher') || '',
            streak: stat('streak') || '',
            l10: (stat('Last Ten Games') || '').split(',')[0], // NHL appends ", 0 PTS"
            slug: (t.shortDisplayName || t.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          };
          ids.push(t.id);
        }
        if (ids.length) divisions.push({ name: div.name, conf: conf.name, ids });
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
          post: st !== 2, // playoffs and the NBA play-in
          round: st === 3 ? roundOf(comp, L) : -1,
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

  function cfbRound(comp) {
    const h = headline(comp);
    if (!/college football playoff/i.test(h)) return -1; // an ordinary bowl
    if (/first round/i.test(h)) return 0;
    if (/quarterfinal/i.test(h)) return 1;
    if (/semifinal/i.test(h)) return 2;
    if (/championship/i.test(h)) return 3;
    return -1;
  }

  // college: one standings request plus one scoreboard per week (FBS games only, which include FBS-vs-FCS)
  async function loadCfbYear(L, year, withPost) {
    const standings = await getJSON(`${BASE}/v2/sports/${L.path}/standings?season=${year}`);
    const teams = {};
    const divisions = [];
    for (const conf of standings.children || []) {
      const ids = [];
      // some conferences (the Sun Belt) list their teams under East/West divisions
      const entries = [conf, ...(conf.children || [])].flatMap((g) => (g.standings || {}).entries || []);
      for (const e of entries) {
        const t = e.team;
        if (teams[t.id]) continue;
        const stat = (name) => ((e.stats || []).find((x) => x.name === name) || {}).displayValue;
        const [w, l] = (stat('overall') || '0-0').split('-').map(Number);
        teams[t.id] = {
          id: t.id, name: t.shortDisplayName || t.name, color: '#555', alt: '#555',
          record: stat('overall') || '', wl: { w, l, t: 0, pts: 0 }, clinch: '', streak: stat('streak') || '', l10: '',
          slug: (t.shortDisplayName || t.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        };
        ids.push(t.id);
      }
      if (ids.length) divisions.push({ name: conf.name, conf: 'FBS', ids });
    }
    // every FCS opponent is pooled into one team that gets its own rating but isn't listed
    teams.FCS = { id: 'FCS', name: 'FCS', color: '#555', alt: '#555', record: '', wl: { w: 0, l: 0, t: 0, pts: 0 },
      clinch: '', streak: '', l10: '', slug: 'fcs', hidden: true };

    const urls = [];
    for (let w = 1; w <= L.weeks; w++) urls.push({ week: w, st: 2, url: `${BASE}/site/v2/sports/${L.path}/scoreboard?groups=80&dates=${year}&seasontype=2&week=${w}&limit=300` });
    if (withPost) urls.push({ week: L.weeks + 1, st: 3, url: `${BASE}/site/v2/sports/${L.path}/scoreboard?groups=80&dates=${year}&seasontype=3&limit=300` });

    let failed = 0;
    const pages = await pool(urls, CONCURRENCY, (u) => getJSON(u.url).then((d) => ({ ...u, d })).catch(() => { failed++; return { ...u, d: {} }; }));

    const seen = new Set();
    const games = [];
    for (const { week, st, d } of pages) {
      for (const ev of d.events || []) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        const comp = ev.competitions[0];
        const sides = {};
        for (const c of comp.competitors) {
          const id = teams[c.team.id] ? c.team.id : 'FCS';
          if (id !== 'FCS') {
            if (c.team.color && teams[id].color === '#555') teams[id].color = '#' + c.team.color;
            if (c.team.alternateColor) teams[id].alt = '#' + c.team.alternateColor;
          }
          sides[c.homeAway] = { id, score: scoreOf(c.score) };
          if (id === 'FCS') {
            Object.assign(sides[c.homeAway], {
              name: c.team.shortDisplayName || c.team.name || 'FCS',
              color: '#' + (c.team.color || '555555'),
              alt: '#' + (c.team.alternateColor || c.team.color || '555555'),
            });
          }
        }
        if (!sides.home || !sides.away || (sides.home.id === 'FCS' && sides.away.id === 'FCS')) continue;
        const status = (comp.status || ev.status || {}).type || {};
        games.push({
          date: new Date(ev.date), week, post: st === 3, round: st === 3 ? cfbRound(comp) : -1, conf: '', neutral: !!comp.neutralSite,
          done: !!status.completed, home: sides.home, away: sides.away,
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

    const cfb = L.kind === 'cfb';
    const load = cfb ? loadCfbYear : loadYear;
    if (phase === 1) year -= 1; // preseason: the last full season is the interesting one
    // college starts each team from last season's rating, so fetch that season alongside
    const prevLoad = (y) => load(L, y, true).catch(() => null);
    let prev = cfb ? prevLoad(year - 1) : null;
    let data = await load(L, year, phase !== 2);

    if (phase !== 2 && !data.games.some((g) => g.done && !g.post)) {
      data = (cfb && (await prev)) || (await load(L, year - 1, true));
      if (cfb) prev = prevLoad(year - 2);
    }
    if (cfb) {
      const p = await prev;
      data.prior = p ? priorFrom(L, p) : null;
    }
    return data;
  }

  // ---------- elo ----------

  function runElo(L, games, teams) {
    const state = {};
    for (const id in teams) state[id] = { ...teams[id], elo: START, last: 0, hist: [], oppSum: 0, oppN: 0, regN: 0, wins: 0, expWins: 0 };
    // luck ignores each team's first quarter of the season, while everyone's still near 1600
    const settle = Math.ceil(L.games / 4);

    const played = [];
    for (const g of games) {
      if (!g.done) continue;
      const h = state[g.home.id];
      const a = state[g.away.id];

      const diff = h.elo - a.elo;
      const expHome = 1 / (1 + Math.pow(10, -diff / 400));
      const margin = g.home.score - g.away.score;
      const actual = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
      if (!g.post) {
        // strength of schedule: opponents' rating going into the game
        h.oppSum += a.elo; h.oppN++;
        a.oppSum += h.elo; a.oppN++;
        // luck: actual wins against the wins the pre-game odds expected
        if (++h.regN > settle) { h.wins += actual; h.expWins += expHome; }
        if (++a.regN > settle) { a.wins += 1 - actual; a.expWins += 1 - expHome; }
      }
      const mult = margin === 0 ? 1 : L.mult(Math.abs(margin), margin > 0 ? diff : -diff);

      const shift = L.K * mult * (actual - expHome);
      h.elo += shift;
      a.elo -= shift;
      h.last = shift;
      a.last = -shift;
      h.hist.push({ date: g.date, post: g.post, opp: a.id, home: true, us: g.home.score, them: g.away.score, elo: h.elo, shift });
      a.hist.push({ date: g.date, post: g.post, opp: h.id, home: false, us: g.away.score, them: g.home.score, elo: a.elo, shift: -shift });
      played.push({ ...g, shift, expHome });
    }
    return { state, played };
  }

  // ---------- college ratings ----------

  // gaussian elimination with partial pivoting; A is n×n row-major and gets overwritten
  function solve(A, b, n) {
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
      if (p !== c) {
        for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; }
        const t = b[c]; b[c] = b[p]; b[p] = t;
      }
      const d = A[c * n + c];
      if (!d) continue;
      for (let r = c + 1; r < n; r++) {
        const f = A[r * n + c] / d;
        if (!f) continue;
        for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
        b[r] -= f * b[c];
      }
    }
    const x = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let sum = b[r];
      for (let k = r + 1; k < n; k++) sum -= A[r * n + k] * x[k];
      x[r] = A[r * n + r] ? sum / A[r * n + r] : 0;
    }
    return x;
  }

  // standard normal CDF (Abramowitz & Stegun 7.1.26)
  function normCdf(z) {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  // power rating: least-squares fit of rating gaps (plus home field, learned from the games) to capped
  // score margins, pulled towards each team's starting rating; centred so an average FBS team is 0
  function marginRatings(L, ids, ix, games, prior) {
    const n = ids.length + 1; // the last unknown is home field
    const A = new Float64Array(n * n);
    const b = new Float64Array(n);
    for (let i = 0; i < n - 1; i++) {
      A[i * n + i] = L.ridge;
      if (prior) b[i] = L.ridge * (prior[ids[i]] || 0);
    }
    A[n * n - 1] = 0.01; // home field barely regularised
    for (const g of games) {
      const m = Math.max(-L.cap, Math.min(L.cap, g.home.score - g.away.score));
      const v = [[ix[g.home.id], 1], [ix[g.away.id], -1]];
      if (!g.neutral) v.push([n - 1, 1]);
      for (const [i, si] of v) {
        b[i] += si * m;
        for (const [j, sj] of v) A[i * n + j] += si * sj;
      }
    }
    const x = solve(A, b, n);
    const r = x.subarray(0, n - 1);
    let sum = 0, k = 0;
    ids.forEach((id, i) => { if (id !== 'FCS') { sum += r[i]; k++; } });
    for (let i = 0; i < n - 1; i++) r[i] -= k ? sum / k : 0;
    return { r, hfa: x[n - 1] };
  }

  // starting ratings: last season's final power rating, scaled back towards average;
  // teams new to FBS start at average, which the backtest was run with
  function priorFrom(L, prev) {
    const ids = Object.keys(prev.teams);
    const ix = Object.fromEntries(ids.map((id, i) => [id, i]));
    const { r } = marginRatings(L, ids, ix, prev.games.filter((g) => g.done), null);
    return Object.fromEntries(ids.map((id, i) => [id, L.carry * r[i]]));
  }

  // refits the power rating after every week, so the chart and weekly movement work like Elo's
  function rateCfb(L, data) {
    const ids = Object.keys(data.teams);
    const ix = Object.fromEntries(ids.map((id, i) => [id, i]));
    const state = {};
    for (const id of ids) state[id] = { ...data.teams[id], elo: 0, last: 0, hist: [], oppSum: 0, oppN: 0, wins: 0, expWins: 0 };

    const done = data.games.filter((g) => g.done);
    const weeks = [...new Set(done.map((g) => g.week))].sort((a, b) => a - b);
    // before any games, everyone sits at their starting rating (average if last season didn't load)
    const prior = data.prior || null;
    let before = Float64Array.from(ids, (id) => (prior && prior[id]) || 0);
    let now = before;
    let hfa = 0; // home field, refit each week with everything else
    for (const id of ids) state[id].start = now[ix[id]];
    const played = [];
    const edge = (g) => (g.neutral ? 0 : hfa);

    // strength of record as of a given week: wins minus what a typical top-25 team would expect
    const visibleIx = ids.map((id, i) => (data.teams[id].hidden ? -1 : i)).filter((i) => i >= 0);
    const sorAt = (r, games) => {
      const sorted = visibleIx.map((i) => r[i]).sort((p, q) => q - p);
      const bar = sorted[Math.min(24, sorted.length - 1)] || 0;
      const out = new Float64Array(ids.length);
      for (const g of games) {
        const i = ix[g.home.id], j = ix[g.away.id];
        out[i] += (g.home.score > g.away.score ? 1 : 0) - normCdf((bar - r[j] + edge(g)) / L.sigma);
        out[j] += (g.away.score > g.home.score ? 1 : 0) - normCdf((bar - r[i] - edge(g)) / L.sigma);
      }
      return out;
    };

    for (const w of weeks) {
      const upto = done.filter((g) => g.week <= w);
      const fit = marginRatings(L, ids, ix, upto, prior);
      const r = fit.r;
      // odds from the ratings going into the week
      for (const g of done.filter((x) => x.week === w)) {
        g.expHome = normCdf((now[ix[g.home.id]] - now[ix[g.away.id]] + edge(g)) / L.sigma);
      }
      hfa = fit.hfa;
      const sor = sorAt(r, upto);
      for (const g of done.filter((x) => x.week === w)) {
        const i = ix[g.home.id], j = ix[g.away.id];
        const h = state[g.home.id], a = state[g.away.id];
        const hs = r[i] - (h.hist.length ? h.hist[h.hist.length - 1].elo : h.start);
        const as = r[j] - (a.hist.length ? a.hist[a.hist.length - 1].elo : a.start);
        h.hist.push({ date: g.date, post: g.post, opp: a.id, oppName: g.away.name, home: true, neutral: g.neutral, us: g.home.score, them: g.away.score, elo: r[i], shift: hs, sor: sor[i] });
        a.hist.push({ date: g.date, post: g.post, opp: h.id, oppName: g.home.name, home: false, neutral: g.neutral, us: g.away.score, them: g.home.score, elo: r[j], shift: as, sor: sor[j] });
        played.push({ ...g, shift: hs, aShift: as });
      }
      before = now;
      now = r;
    }

    ids.forEach((id, i) => {
      state[id].elo = now[i];
      state[id].last = now[i] - before[i];
    });

    const visible = ids.filter((id) => !state[id].hidden);
    const rankBy = (arr) => {
      const out = {};
      visible.slice().sort((p, q) => arr[ix[q]] - arr[ix[p]]).forEach((id, k) => { out[id] = k + 1; });
      return out;
    };
    if (weeks.length >= (prior ? 1 : 2)) {
      const was = rankBy(before), is = rankBy(now);
      for (const id of visible) state[id].move = was[id] - is[id];
    }

    // strength of record: wins above what a typical top-25 team would expect against the same schedule
    const ranked = visible.map((id) => now[ix[id]]).sort((p, q) => q - p);
    const bar = ranked[Math.min(24, ranked.length - 1)] || 0;
    for (const g of done) {
      for (const [me, opp] of [[g.home, g.away], [g.away, g.home]]) {
        const t = state[me.id];
        t.oppSum += now[ix[opp.id]];
        t.oppN++;
        t.expWins += normCdf((bar - now[ix[opp.id]] + (me === g.home ? edge(g) : -edge(g))) / L.sigma);
        t.wins += me.score > opp.score ? 1 : 0;
      }
    }
    for (const id of visible) {
      const t = state[id];
      t.sor = t.oppN ? t.wins - t.expWins : null;
    }
    return { state, played, hfa };
  }

  // ---------- playoff odds ----------

  // unplayed regular-season games still to come (ESPN keeps old rainouts that were never made up as "not completed")
  const pending = (g) => !g.done && !g.post && g.date >= Date.now() - 12 * 3600 * 1000;

  const SIMS = 5000;
  const OT_SHARE = 0.23; // NHL games that go to OT/shootout, where the loser still gets a point

  // play out the rest of the regular season SIMS times on current ratings and count playoff berths
  function playoffOdds(L, data, state) {
    const P = L.playoff;
    if (!P) return null; // college playoff fields are picked by a committee
    const ids = Object.keys(state);
    const ix = Object.fromEntries(ids.map((id, i) => [id, i]));
    const rem = data.games.filter(pending);
    if (!rem.length) return null;

    const elo = ids.map((id) => state[id].elo);
    const winP = (a, b) => 1 / (1 + Math.pow(10, -(elo[a] - elo[b]) / 400));
    const gh = Int32Array.from(rem, (g) => ix[g.home.id]);
    const ga = Int32Array.from(rem, (g) => ix[g.away.id]);
    const gp = Float64Array.from(rem, (g) => winP(ix[g.home.id], ix[g.away.id]));
    const base = Float64Array.from(ids, (id) => {
      const r = data.teams[id].wl;
      return P.points ? r.pts : r.w + 0.5 * r.t;
    });

    const confs = new Map();
    for (const d of data.divisions) {
      const key = P.overall ? 'all' : d.conf;
      if (!confs.has(key)) confs.set(key, []);
      confs.get(key).push(d.ids.map((id) => ix[id]));
    }

    const made = new Float64Array(ids.length);
    const score = new Float64Array(ids.length);
    const byScore = (a, b) => score[b] - score[a];

    for (let s = 0; s < SIMS; s++) {
      for (let i = 0; i < ids.length; i++) score[i] = base[i] + Math.random() * 1e-3; // random tiebreak
      for (let k = 0; k < gh.length; k++) {
        const homeWon = Math.random() < gp[k];
        const w = homeWon ? gh[k] : ga[k];
        const l = homeWon ? ga[k] : gh[k];
        if (P.points) {
          score[w] += 2;
          if (Math.random() < OT_SHARE) score[l] += 1;
        } else {
          score[w] += 1;
        }
      }

      for (const divs of confs.values()) {
        const inn = new Set();
        for (const d of divs) d.slice().sort(byScore).slice(0, P.divTop).forEach((i) => inn.add(i));
        const rest = divs.flat().filter((i) => !inn.has(i)).sort(byScore);
        rest.slice(0, P.wild).forEach((i) => inn.add(i));

        if (P.playIn) {
          const [s7, s8, s9, s10] = rest.slice(P.wild, P.wild + 4);
          if (s10 !== undefined) {
            // 7v8 winner is in; the loser meets the 9v10 winner for the last spot
            const w78 = Math.random() < winP(s7, s8) ? s7 : s8;
            const l78 = w78 === s7 ? s8 : s7;
            const w910 = Math.random() < winP(s9, s10) ? s9 : s10;
            inn.add(w78);
            inn.add(Math.random() < winP(l78, w910) ? l78 : w910);
          }
        }
        for (const i of inn) made[i]++;
      }
    }

    return Object.fromEntries(ids.map((id, i) => [id, made[i] / SIMS]));
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

  function pctText(p) {
    const r = Math.round(p * 100);
    if (r === 0 && p > 0) return '<1%';
    if (r === 100 && p < 1) return '>99%';
    return `${r}%`;
  }

  // offsets from an average team; elo is zero-sum, so the league average is always START
  const signed = (v) => {
    if (v == null) return '';
    const r = Math.round(v);
    return r > 0 ? `+${r}` : String(r);
  };

  const luckText = (v) => {
    const r = Math.round(v * 10) / 10;
    return r > 0 ? `+${r.toFixed(1)}` : r.toFixed(1);
  };

  // one-decimal change, coloured like delta()
  function delta1(x) {
    const r = Math.round(x * 10) / 10;
    if (!r) return '<span class="flat-txt">·</span>';
    return r > 0 ? `<span class="up-txt">+${r.toFixed(1)}</span>` : `<span class="down-txt">${r.toFixed(1)}</span>`;
  }

  // numeric columns: each one sorts on click and explains itself on hover
  function columns(L, extra, showRank) {
    if (L.kind === 'cfb') return [
      extra.move && { key: 'move', label: 'wk', lead: true, tip: 'places moved in the power rankings since last week',
        val: (t) => t.move ?? null, html: moveHTML },
      showRank && { key: 'rank', label: '#', lead: true, asc: true, tip: 'rank by power rating',
        val: (t) => t.rank, html: (t) => t.rank },
      { key: 'rec', label: 'rec', tip: 'overall record; sorts by win percentage',
        val: (t) => t.recVal, html: (t) => esc(t.record) },
      { key: 'elo', label: 'power', tip: `power rating: points better than an average FBS team on a neutral field. Fit to every game so far ` +
        `(margins capped at ${L.cap}, home field worth ${(extra.hfa || 0).toFixed(1)} learned from the games), starting from ` +
        `${Math.round(L.carry * 100)}% of last season's rating, which counts for about ${L.ridge} games`,
        val: (t) => t.elo, html: (t) => luckText(t.elo) },
      { key: 'sor', label: 'sor', tip: 'strength of record: wins above what a typical top-25 team would expect against the same schedule (+ = more impressive)',
        val: (t) => t.sor, html: (t) => (t.sor == null ? '' : luckText(t.sor)) },
      { key: 'last', label: 'last', tip: 'change in power rating since last week',
        val: (t) => t.last, html: (t) => delta1(t.last) },
      { key: 'sos', label: 'sos', opt: true, tip: 'strength of schedule: average power rating of opponents faced (+ = tougher)',
        val: (t) => t.sos, html: (t) => (t.sos == null ? '' : luckText(t.sos)) },
      extra.left && { key: 'left', label: 'left', opt: true, tip: 'average power rating of the opponents still to play (+ = tougher)',
        val: (t) => t.left, html: (t) => (t.left == null ? '' : luckText(t.left)) },
    ].filter(Boolean);

    return [
      extra.move && { key: 'move', label: 'wk', lead: true, tip: 'places moved in the Elo rankings over the past week',
        val: (t) => t.move ?? null, html: moveHTML },
      showRank && { key: 'rank', label: '#', lead: true, asc: true, tip: 'rank by current Elo',
        val: (t) => t.rank, html: (t) => t.rank },
      { key: 'rec', label: 'rec',
        tip: (L.playoff || {}).points ? 'regular-season record (W-L-OTL); sorts by points' : 'regular-season record; sorts by win percentage',
        val: (t) => t.recVal, html: (t) => esc(t.record) },
      { key: 'elo', label: 'elo', tip: `current Elo rating; every team started the season at ${START}`,
        val: (t) => t.elo, html: (t) => Math.round(t.elo) },
      { key: 'last', label: 'last', tip: 'rating change from their most recent game',
        val: (t) => t.last, html: (t) => delta(t.last) },
      { key: 'l5', label: 'l5', tip: 'form: rating change over their last 5 games',
        val: (t) => t.l5, html: (t) => delta(t.l5) },
      extra.odds && { key: 'playoff', label: 'playoff',
        tip: `chance of making the playoffs, from ${SIMS.toLocaleString('en-US')} simulations of the rest of the regular season`,
        val: (t) => extra.odds[t.id], html: (t) => esc(pctText(extra.odds[t.id])) },
      { key: 'sos', label: 'sos',
        tip: 'strength of schedule so far: average rating of opponents faced, relative to an average team (+ = tougher)',
        val: (t) => t.sos, html: (t) => signed(t.sos), opt: true },
      extra.left && { key: 'left', label: 'left',
        tip: 'strength of the schedule still to play: average current rating of remaining opponents, relative to an average team (+ = tougher)',
        val: (t) => t.left, html: (t) => signed(t.left), opt: true },
      { key: 'luck', label: 'luck', opt: true,
        tip: `wins minus the wins Elo expected from the pre-game odds, counting from game ${Math.ceil(L.games / 4) + 1} ` +
          '(after the first quarter of the season) (+ = winning more than they "should")',
        val: (t) => (t.expWins ? t.wins - t.expWins : null),
        html: (t) => (t.expWins ? luckText(t.wins - t.expWins) : '') },
    ].filter(Boolean);
  }

  let sort = { key: 'elo', dir: -1 };
  let clinchLegend = {};

  function moveHTML(t) {
    if (!t.move) return '';
    return t.move > 0 ? `<span class="up-txt">↑${t.move}</span>` : `<span class="down-txt">↓${-t.move}</span>`;
  }

  // one line under the table explaining whichever clinch letters are showing
  function clinchKey(rows) {
    const shown = new Set(rows.map((t) => t.clinch).filter(Boolean));
    if (!shown.size) return '';
    const letters = [...Object.keys(clinchLegend).filter((k) => shown.has(k)), ...[...shown].filter((k) => !(k in clinchLegend))];
    return '<p class="clinch-key">' + letters.map((k) =>
      `<span><span class="clinch">${esc(k)}</span> ${esc(clinchLegend[k] || 'clinch status from ESPN')}</span>`).join('') + '</p>';
  }

  function clinchHTML(t) {
    if (!t.clinch) return '';
    const what = clinchLegend[t.clinch] || 'clinch status from ESPN';
    return ` <span class="clinch" data-tip="${esc(what)}">${esc(t.clinch)}</span>`;
  }

  function table(rows, cols, limit) {
    const col = cols.find((c) => c.key === sort.key) || cols.find((c) => c.key === 'elo');
    const v = (t) => { const x = col.val(t); return x == null ? Infinity * sort.dir : x; }; // blanks sort last
    rows = rows.slice().sort((a, b) => sort.dir * (v(a) - v(b)) || b.elo - a.elo);
    if (limit) rows = rows.slice(0, limit);

    const lead = cols.filter((c) => c.lead);
    const rest = cols.filter((c) => !c.lead);
    const cell = (c, t) => `<td class="num${c.opt ? ' opt' : ''}${c.key === 'rank' ? ' rank' : ''}${c.key === 'move' ? ' move' : ''}">${c.html(t)}</td>`;
    const body = rows.map((t) => `<tr class="team" data-id="${t.id}" data-slug="${t.slug}" tabindex="0">
        ${lead.map((c) => cell(c, t)).join('')}
        <td>${swatch(t)}${esc(t.name)}${clinchHTML(t)}</td>
        ${rest.map((c) => cell(c, t)).join('')}
      </tr>`).join('');

    const th = (c) => {
      const on = c === col;
      const cls = `num sortable${on ? ' sorted' : ''}${on && sort.dir > 0 ? ' asc' : ''}${c.lead ? ' tip-left' : ''}${c.opt ? ' opt' : ''}`;
      return `<th class="${cls}" data-sort="${c.key}" data-tip="${esc(c.tip)}" tabindex="0">` +
        `${c.label}<span class="ind"></span></th>`;
    };

    return `<table class="elo">
      <thead><tr>
        ${lead.map(th).join('')}
        <th>team</th>
        ${rest.map(th).join('')}
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  }

  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // ---------- per-team panel: history chart, form, compare ----------

  function deltaD(x, d) {
    const r = Number(x.toFixed(d));
    if (!r) return '<span class="flat-txt">·</span>';
    const txt = Math.abs(r).toFixed(d).replace(/^0\./, '.');
    return r > 0 ? `<span class="up-txt">+${txt}</span>` : `<span class="down-txt">-${txt}</span>`;
  }

  // what the history chart can plot; the pro leagues only have Elo
  function metricsFor(L) {
    if (L.kind !== 'cfb') return { elo: { name: 'elo', base: START, fmt: (v) => Math.round(v), dfmt: delta, span: 20 } };
    return {
      elo: { name: 'power rating', base: 0, fmt: luckText, dfmt: delta1, span: 4, carried: true },
      sor: { name: 'strength of record', base: 0, fmt: luckText, dfmt: delta1, span: 1 },
    };
  }

  let curL = null; // the league being shown
  let curHfa = 0; // college home field, in points
  // chance a beats b; college adds home field when a is at home (pro Elo has none)
  const winProb = (a, b, home = false) => (curL.kind === 'cfb'
    ? normCdf((a.elo - b.elo + (home ? curHfa : 0)) / curL.sigma)
    : 1 / (1 + Math.pow(10, -(a.elo - b.elo) / 400)));
  const gameProb = (state, g) => winProb(state[g.home.id], state[g.away.id], !g.neutral);
  const baseOf = (L) => L.base ?? START;
  const fmtR = (v) => (curL.kind === 'cfb' ? luckText(v) : Math.round(v)); // college ratings are small, keep a decimal
  const hashParts = () => location.hash.slice(1).split('/');

  function setHash(slug) {
    history.replaceState(null, '', `#${current}${slug ? '/' + slug : ''}`);
  }

  function toggleHistory(tr, state) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('hist')) {
      next.remove();
      tr.classList.remove('open');
      if (hashParts()[1] === tr.dataset.slug) setHash('');
      return;
    }
    openPanel(tr, state);
    setHash(tr.dataset.slug);
  }

  function openPanel(tr, state) {
    const team = state[tr.dataset.id];
    const others = Object.values(state).filter((t) => t !== team && !t.hidden).sort((a, b) => a.name.localeCompare(b.name));
    const facts = [team.streak && `streak ${esc(team.streak)}`, team.l10 && `last 10: ${esc(team.l10)}`].filter(Boolean);

    const row = document.createElement('tr');
    row.className = 'hist';
    row.innerHTML = `<td colspan="${tr.children.length}">
      <div class="panel-meta">
        ${facts.join(' · ')}${facts.length ? ' · ' : ''}
        ${curL.kind === 'cfb' ? `<label>plot <select class="metric">${Object.entries(metricsFor(curL)).map(([k, m]) =>
          `<option value="${k}">${esc(m.name)}</option>`).join('')}</select></label> · ` : ''}
        <label>compare with <select class="cmp"><option value="">—</option>${others.map((t) =>
          `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      </div>
      <div class="legend" hidden></div>
      <div class="chart"></div>
      <p class="h2h meta" hidden></p>
    </td>`;
    tr.after(row);
    tr.classList.add('open');

    const chart = row.querySelector('.chart');
    const legend = row.querySelector('.legend');
    const h2h = row.querySelector('.h2h');
    const select = row.querySelector('.cmp');
    const metric = row.querySelector('.metric');
    // clicks and keys inside the panel shouldn't bubble up to the row/sort handlers
    row.addEventListener('click', (e) => e.stopPropagation());
    row.addEventListener('keydown', (e) => e.stopPropagation());

    const draw = () => {
      const other = state[select.value] || null;
      drawHistory(chart, team, state, other, metric ? metric.value : 'elo');
      legend.hidden = !other;
      h2h.hidden = !other;
      if (!other) return;
      legend.innerHTML = [[team, 'a'], [other, 'b']].map(([t, k]) =>
        `<span class="key"><i class="${k}"></i>${esc(t.name)}</span>`).join('');
      const p = winProb(team, other);
      h2h.textContent = `if they played today: ${team.name} ${pctText(p)} · ${other.name} ${pctText(1 - p)}`;
    };
    select.addEventListener('change', draw);
    if (metric) metric.addEventListener('change', draw);
    draw();
    return row;
  }

  function drawHistory(el, team, state, other, mkey = 'elo') {
    if (!team.hist.length) {
      el.innerHTML = '<p class="meta">no games yet</p>';
      return;
    }

    // point 0 is the season start; with a comparison, the x axis runs to the longer season
    const M = metricsFor(curL)[mkey];
    const base = M.base;
    const series = [team, other].filter(Boolean).map((t, k) => {
      // college power ratings start from last season's, everything else from the baseline
      const pts = [{ v: M.carried && t.start != null ? t.start : base }, ...t.hist.map((h) => ({ ...h, v: h[mkey] }))];
      pts.forEach((p, i) => { p.d = i ? p.v - pts[i - 1].v : 0; });
      return { t, cls: other ? (k ? 'line b' : 'line a') : 'line', pts };
    });
    const pts = series[0].pts;
    const n = Math.max(...series.map((sr) => sr.pts.length));
    const W = Math.max(300, el.clientWidth || 600);
    const H = 150;
    const pad = { l: 40, r: 44, t: 14, b: 22 };

    const vals = series.flatMap((sr) => sr.pts.map((p) => p.v));
    const lo = Math.min(base, ...vals);
    const hi = Math.max(base, ...vals);
    const room = Math.max(M.span, hi - lo) * 0.08;
    const y0 = lo - room, y1 = hi + room;

    const x = (i) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    const label = (tx, ty, text, anchor, cls = 'axis') =>
      `<text class="${cls}" x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(text)}</text>`;

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((sr) => sr.t.name).join(' and '))} ${esc(M.name)} by game">`;

    // 1600 reference, plus the high and low when they're far enough from it to read
    svg += `<line class="ref" x1="${pad.l}" x2="${W - pad.r}" y1="${y(base)}" y2="${y(base)}"/>`;
    svg += label(pad.l - 6, y(base) + 4, base === 0 ? '0' : M.fmt(base), 'end');
    for (const v of [Math.max(...vals), Math.min(...vals)]) {
      if (Math.abs(y(v) - y(base)) > 14) svg += label(pad.l - 6, y(v) + 4, M.fmt(v), 'end');
    }

    const postAt = pts.findIndex((p) => p.post);
    if (postAt > 0) {
      const px = (x(postAt - 1) + x(postAt)) / 2;
      svg += `<line class="sep" x1="${px}" x2="${px}" y1="${pad.t - 4}" y2="${H - pad.b}"/>`;
      svg += label(px + 4, pad.t - 4, curL.kind === 'cfb' ? 'bowls' : 'playoffs', 'start');
    }

    svg += label(x(1), H - 6, fmtDate(pts[1].date), 'start');
    if (pts.length > 2) svg += label(x(pts.length - 1), H - 6, fmtDate(pts[pts.length - 1].date), 'end');

    // lines, then end dots with their values (nudged apart if they'd overlap)
    const ends = series.map((sr) => ({ sr, i: sr.pts.length - 1, ly: y(sr.pts[sr.pts.length - 1].v) }));
    if (ends.length === 2 && Math.abs(ends[0].ly - ends[1].ly) < 12) {
      const [up, down] = ends[0].ly <= ends[1].ly ? ends : [ends[1], ends[0]];
      const mid = (up.ly + down.ly) / 2;
      up.ly = mid - 6;
      down.ly = mid + 6;
    }
    for (const sr of series) {
      const d = sr.pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
      svg += `<path class="${sr.cls}" d="${d}"/>`;
    }
    for (const { sr, i, ly } of ends) {
      const k = sr.cls.split(' ')[1] || '';
      svg += `<circle class="dot ${k}" cx="${x(i)}" cy="${y(sr.pts[i].v)}" r="3.5"/>`;
      svg += label(x(i) + 8, ly + 4, M.fmt(sr.pts[i].v), 'start', 'val');
    }

    // hover layer
    svg += `<line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>`;
    series.forEach((sr) => {
      const k = sr.cls.split(' ')[1] || '';
      svg += `<circle class="dot hover ${k}" r="4" visibility="hidden"/>`;
    });
    svg += `<rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}"/>`;
    svg += '</svg><div class="tip" hidden></div>';
    el.innerHTML = svg;

    const svgEl = el.querySelector('svg');
    const cross = el.querySelector('.cross');
    const dots = [...el.querySelectorAll('.dot.hover')];
    const tip = el.querySelector('.tip');

    const describe = (sr, i) => {
      const p = sr.pts[i];
      if (!p) return `${esc(sr.t.name)}: season over`;
      const who = other ? `${esc(sr.t.name)}: ` : '';
      if (i === 0) return `${who}season start · ${M.carried && sr.t.start != null ? `${M.fmt(p.v)} (from last season)` : base}`;
      const res = p.us > p.them ? 'W' : p.us < p.them ? 'L' : 'T';
      return `${who}${fmtDate(p.date)} · ${res} ${p.us}–${p.them} ${p.home || p.neutral ? 'vs' : '@'}${p.neutral ? ' (neutral)' : ''} ${esc(p.oppName || state[p.opp].name)}` +
        `${other ? ' · ' : '<br>'}${M.fmt(p.v)} ${M.dfmt(p.d)}`;
    };

    const hide = () => {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
      tip.hidden = true;
    };
    el.querySelector('.hit').addEventListener('pointerleave', hide);
    el.querySelector('.hit').addEventListener('pointermove', (e) => {
      const box = svgEl.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((sx - pad.l) / (W - pad.l - pad.r)) * (n - 1))));

      cross.setAttribute('x1', x(i));
      cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      series.forEach((sr, k) => {
        const p = sr.pts[i];
        dots[k].setAttribute('visibility', p ? 'visible' : 'hidden');
        if (p) { dots[k].setAttribute('cx', x(i)); dots[k].setAttribute('cy', y(p.v)); }
      });

      tip.innerHTML = series.map((sr) => describe(sr, i)).join('<br>');
      tip.hidden = false;
      const anchor = (series.find((sr) => sr.pts[i]) || series[0]).pts[i] || pts[pts.length - 1];
      const px = (x(i) / W) * box.width;
      const left = px > box.width / 2 ? px - tip.offsetWidth - 12 : px + 12;
      tip.style.left = `${left}px`;
      tip.style.top = `${(y(anchor.v) / H) * box.height - tip.offsetHeight / 2}px`;
    });
  }

  const seasonLabel = (L, year) => (L.splitYear ? `${year - 1}–${String(year).slice(2)}` : String(year));

  let view = 'ranked';
  let current = null;
  let openFromHash = () => {};
  let showAll = false;
  const cache = {};

  function render(key, data) {
    const L = LEAGUES[key];
    curL = L;
    const cfb = L.kind === 'cfb';
    const base = baseOf(L);
    const { state, played, hfa } = cfb ? rateCfb(L, data) : runElo(L, data.games, data.teams);
    curHfa = hfa || 0;
    const all = Object.values(state).filter((t) => !t.hidden).sort((a, b) => b.elo - a.elo);
    all.forEach((t, i) => { t.rank = i + 1; });
    clinchLegend = L.clinch || {};

    // form: rating change over the last 5 games
    for (const t of all) t.l5 = t.hist.slice(-5).reduce((sum, h) => sum + h.shift, 0);

    // rank movement over the week before the latest game
    const latest = played.length ? played[played.length - 1].date : null;
    const weekAgo = latest && new Date(latest - 7 * 24 * 3600 * 1000);
    if (!cfb && weekAgo && played[0].date <= weekAgo) { // college sets this from its weekly refits
      const eloAt = (t) => {
        let e = START;
        for (const h of t.hist) { if (h.date > weekAgo) break; e = h.elo; }
        return e;
      };
      all.slice().sort((a, b) => eloAt(b) - eloAt(a)).forEach((t, i) => { t.move = i + 1 - t.rank; });
    }

    // remaining strength of schedule uses current ratings
    for (const t of all) { t.remSum = 0; t.remN = 0; }
    for (const g of data.games) {
      if (!pending(g)) continue;
      const h = state[g.home.id], a = state[g.away.id];
      h.remSum += a.elo; h.remN++;
      a.remSum += h.elo; a.remN++;
    }
    for (const t of all) {
      const r = t.wl;
      t.recVal = (L.playoff || {}).points ? r.pts : (r.w + 0.5 * r.t) / (r.w + r.l + r.t || 1);
      t.sos = t.oppN ? t.oppSum / t.oppN - base : null;
      t.left = t.remN ? t.remSum / t.remN - base : null;
    }
    const extra = { odds: playoffOdds(L, data, state), left: all.some((t) => t.remN), move: all.some((t) => t.move !== undefined), hfa };

    // college lists 138 teams, so the ranked view starts at the top 25
    const more = () => (cfb ? `<button class="more" data-more>${showAll ? 'show top 25' : `show all ${all.length}`}</button>` : '');
    const views = {
      ranked: () => table(all, columns(L, extra, true), cfb && !showAll ? 25 : 0) + more(),
      division: () => data.divisions.map(({ name, ids }) =>
        `<h3>${esc(name)}</h3>` + table(ids.map((id) => state[id]), columns(L, extra, false))).join(''),
    };
    const resort = (key) => {
      const asc = key === 'rank';
      sort = sort.key === key ? { key, dir: -sort.dir } : { key, dir: asc ? 1 : -1 };
      show(view);
    };
    const show = (v, scroll) => {
      view = v;
      $('tables').innerHTML = views[v]() + clinchKey(all);
      for (const b of document.querySelectorAll('#views button')) b.classList.toggle('active', b.dataset.view === v);
      openFromHash(scroll);
    };
    // a link like #nba/celtics opens that team's panel
    openFromHash = (scroll) => {
      const slug = hashParts()[1];
      const tr = slug && $('tables').querySelector(`tr.team[data-slug="${CSS.escape(slug)}"]`);
      if (!tr && slug && cfb && !showAll && all.some((t) => t.slug === slug)) { showAll = true; return show(view, scroll); }
      if (!tr) return;
      const next = tr.nextElementSibling;
      if (!(next && next.classList.contains('hist'))) openPanel(tr, state);
      if (scroll) tr.scrollIntoView({ block: 'center' });
    };
    for (const b of document.querySelectorAll('#views button')) {
      b.onclick = () => show(b.dataset.view);
      if (b.dataset.view === 'division') b.textContent = L.groups === 'conference' || cfb ? 'by conference' : 'by division';
    }
    $('tables').onclick = (e) => {
      if (e.target.closest('[data-more]')) {
        showAll = !showAll;
        if (!showAll) setHash(''); // otherwise a linked team outside the top 25 would expand it again
        return show(view);
      }
      const th = e.target.closest('th[data-sort]');
      if (th) return resort(th.dataset.sort);
      const tr = e.target.closest('tr.team');
      if (tr) toggleHistory(tr, state);
    };
    $('tables').onkeydown = (e) => {
      if (!e.target.closest || (e.key !== 'Enter' && e.key !== ' ')) return;
      const th = e.target.closest('th[data-sort]');
      const tr = e.target.closest('tr.team');
      if (th || tr) e.preventDefault();
      if (th) resort(th.dataset.sort);
      else if (tr) toggleHistory(tr, state);
    };
    $('views').hidden = false;
    show(view, true);

    $('title').textContent = `${L.name} ${cfb ? 'ratings' : 'Elo'}, ${seasonLabel(L, data.year)}`;

    const series = buildSeries(L, data.games);
    // who to show for a game side: the team, or for college the actual FCS school behind the pooled rating
    const who = (side) => (side.name ? { name: side.name, color: side.color, alt: side.alt, fcs: true } : state[side.id]);
    const tag = (t) => `${swatch(t)}${esc(t.name)}${t.fcs ? ' <span class="meta">(FCS)</span>' : ''}`;

    const last = played[played.length - 1];
    let status = played.length
      ? `${played.length} games played · last: ${who(last.away).name} @ ${who(last.home).name}, ${fmtDate(last.date)}`
      : data.prior ? 'no games played yet; ratings carried over from last season' : `no games played yet; everyone is still at ${base}`;
    if (data.failed) status += ` · ${data.failed} schedule request(s) failed, a few games may be missing`;
    $('status').textContent = status;

    $('bracket').innerHTML = bracketHTML(L, series, state);

    let html = '';
    const recent = played.slice(-8).reverse();
    if (recent.length) {
      html += '<h3>Recent games</h3><ul class="games">' + recent.map((g) => {
        const a = who(g.away), h = who(g.home);
        const awayWon = g.away.score > g.home.score;
        const gain = awayWon ? (g.aShift ?? -g.shift) : g.shift;
        return `<li>${fmtDate(g.date)} &nbsp; ${tag(a)} ${g.away.score} @ ${tag(h)} ${g.home.score}
          &nbsp; <span class="meta">(${esc((awayWon ? a : h).name)} ${cfb ? delta1(gain) : delta(gain)})</span></li>`;
      }).join('') + '</ul>';
    }

    const upsets = played
      .filter((g) => g.home.score !== g.away.score)
      .map((g) => ({ g, p: g.home.score > g.away.score ? g.expHome : 1 - g.expHome }))
      .sort((x, y) => x.p - y.p)
      .slice(0, 5);
    if (upsets.length) {
      html += '<h3>Biggest upsets</h3><ul class="games">' + upsets.map(({ g, p }) => {
        const a = who(g.away), h = who(g.home);
        const winner = g.home.score > g.away.score ? h : a;
        return `<li>${fmtDate(g.date)} &nbsp; ${tag(a)} ${g.away.score} @ ${tag(h)} ${g.home.score}
          &nbsp; <span class="meta">(${esc(winner.name)} had ${esc(pctText(p))})</span></li>`;
      }).join('') + '</ul>';
    }

    const cutoff = Date.now() - 12 * 3600 * 1000;
    const upcoming = data.games.filter((g) => !g.done && g.date >= cutoff);
    const next = upcoming.slice(0, 8);
    if (next.length) {
      html += '<h3>Up next</h3>';

      // game of the week: over the next 7 days, the matchup whose weaker team is strongest,
      // which rewards both good teams and close odds
      const horizon = upcoming[0].date.getTime() + 7 * 24 * 3600 * 1000;
      const gotw = upcoming.filter((g) => g.date <= horizon).reduce((best, g) => {
        const q = Math.min(state[g.home.id].elo, state[g.away.id].elo);
        return !best || q > best.q ? { g, q } : best;
      }, null);
      if (gotw) {
        const g = gotw.g;
        const pHome = gameProb(state, g);
        const fav = pHome >= 0.5 ? who(g.home) : who(g.away);
        html += `<p class="gotw"><span class="meta">game of the week</span> &nbsp; ${fmtDate(g.date)} &nbsp; ` +
          `${tag(who(g.away))} @ ${tag(who(g.home))} &nbsp; ` +
          `<span class="meta">${esc(fav.name)} ${esc(pctText(Math.max(pHome, 1 - pHome)))}</span></p>`;
      }

      html += '<ul class="games">' + next.map((g) => {
        const pHome = gameProb(state, g);
        const fav = pHome >= 0.5 ? who(g.home) : who(g.away);
        return `<li>${fmtDate(g.date)} &nbsp; ${tag(who(g.away))} @ ${tag(who(g.home))}
          &nbsp; <span class="meta">${esc(fav.name)} ${esc(pctText(Math.max(pHome, 1 - pHome)))}</span></li>`;
      }).join('') + '</ul>';
    }
    $('recent').innerHTML = html;
  }

  function select(key) {
    if (!LEAGUES[key]) key = 'nfl';
    current = key;
    openFromHash = () => {};
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
  window.addEventListener('hashchange', () => {
    const [league] = hashParts();
    if (league === current) openFromHash(true);
    else select(league);
  });
  select(hashParts()[0]);
})();
