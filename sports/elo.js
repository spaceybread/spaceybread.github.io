(function () {
  const BASE = 'https://site.api.espn.com/apis';
  const START = 1600;
  const CONCURRENCY = 6;

  // margin-of-victory multipliers (m = winner's margin, d = winner's elo minus loser's)
  const logMult = (m, d) => Math.log(m + 1) * (2.2 / (d * 0.001 + 2.2));
  const nbaMult = (m, d) => Math.pow(m + 3, 0.8) / (7.5 + 0.006 * d);
  const nhlMult = (m, d) => (0.6686 * Math.log(m) + 0.8048) * (2.05 / (d * 0.001 + 2.05));

  // pro leagues: Elo with home field (hfa, in Elo points; none at neutral sites), a rest edge (rest.elo per extra day
  // off, counting up to rest.cap days) and a start from last season (carry Elo points per point of average margin).
  // All picked by backtesting five seasons per league, predicting every game from the ones before it.
  // unc: rating uncertainty (see proUncertainty); its settings come from the same backtests, where the predicted
  // spread of errors matched the actual spread to within about 10% at every stage of the season
  const LEAGUES = {
    nfl: {
      months: [8, 1], // in season from the first month to the second (0 = January)
      games: 17, name: 'NFL', path: 'football/nfl', K: 20, mult: logMult, splitYear: false, eloPerPoint: 25,
      hfa: 30, rest: { cap: 13, elo: 5 }, carry: 10, // byes and short weeks
      unc: { ridge: 4, half: 120, noise: 8.3, eloPer: 22.6 },
      rounds: ['Wild Card', 'Divisional', 'Conference', 'Super Bowl'], winsNeeded: [1, 1, 1, 1],
      playoff: { divTop: 1, wild: 3 }, // per conference
      clinch: { '*': 'clinched the #1 seed and a bye', z: 'clinched the division', y: 'clinched a wild card', x: 'clinched a playoff spot', e: 'eliminated from playoff contention' },
    },
    nba: {
      months: [9, 5], // in season from the first month to the second (0 = January)
      games: 82, name: 'NBA', path: 'basketball/nba', K: 20, mult: nbaMult, splitYear: true, playIn: true, eloPerPoint: 28,
      hfa: 40, rest: { cap: 1, elo: 60 }, carry: 12, // back-to-backs
      unc: { ridge: 8, half: 60, noise: 13.7, eloPer: 21.3 },
      rounds: ['1st Round', 'Conf Semis', 'Conf Finals', 'Finals'], winsNeeded: [4, 4, 4, 4],
      playoff: { divTop: 0, wild: 6, playIn: true }, // seeds 7-10 go through the play-in
      clinch: { '*': 'clinched the best record in the league', z: 'clinched the #1 seed in the conference', y: 'clinched the division', x: 'clinched a playoff spot', xp: 'reached the playoffs through the play-in', pb: 'clinched a play-in spot', e: 'eliminated from playoff contention' },
    },
    nhl: {
      months: [9, 5], // in season from the first month to the second (0 = January)
      games: 82, name: 'NHL', path: 'hockey/nhl', K: 8, mult: nhlMult, splitYear: true,
      hfa: 20, rest: { cap: 1, elo: 60 }, carry: 60, // back-to-backs
      unc: { ridge: 40, half: 0, noise: 2.52, eloPer: 116 },
      rounds: ['1st Round', '2nd Round', 'Conf Final', 'Cup Final'], winsNeeded: [4, 4, 4, 4],
      playoff: { divTop: 3, wild: 2, points: true },
      clinch: { '*': "clinched the Presidents' Trophy (best record)", z: 'clinched the conference', y: 'clinched the division', x: 'clinched a playoff spot', e: 'eliminated from playoff contention' },
    },
    wnba: {
      months: [4, 9], // in season from the first month to the second (0 = January)
      games: 44, name: 'WNBA', path: 'basketball/wnba', K: 30, mult: nbaMult, splitYear: false, eloPerPoint: 28,
      hfa: 30, rest: { cap: 3, elo: 15 }, carry: 12,
      unc: { ridge: 4, half: 0, noise: 10.3, eloPer: 22.8 },
      rounds: ['First Round', 'Semifinals', 'Finals'], winsNeeded: [2, 3, 4],
      roundMap: { RD16: 0, SEMI: 1, FINAL: 2 }, // ESPN skips a quarterfinal code here
      groups: 'conference',
      playoff: { divTop: 0, wild: 8, overall: true }, // top 8 regardless of conference
      clinch: { '*': 'clinched the #1 seed', x: 'clinched a playoff spot', e: 'eliminated from playoff contention' },
    },
    cfb: {
      months: [7, 0], // in season from the first month to the second (0 = January)
      // college: too many teams and too few games for Elo, so a season-long power rating instead (see rateCfb);
      // its settings were picked by backtesting 2021-2025, predicting each week from the weeks before it
      kind: 'cfb', college: true, games: 12, name: 'CFB', title: 'College football', path: 'football/college-football', splitYear: false, base: 0,
      pool: 'FCS', postName: 'bowls', bracketName: 'College Football Playoff',
      rounds: ['First Round', 'Quarterfinals', 'Semifinals', 'Championship'], winsNeeded: [1, 1, 1, 1],
      cap: 28, // margins beyond this don't count, so running up the score doesn't pay
      ridge: 2, // pull towards last season's rating, worth about two games of evidence
      carry: 0.8, // share of last season's rating a team starts with
      sigma: 12.5, // spread of college margins around the rating gap, for win probabilities
      noise: 11.9, // spread of (capped) margins around the true gap, for rating uncertainty
      weeks: 16,
    },
    // college basketball: same power rating as college football, refit daily; picked by backtesting 2022-2026
    // (men 74% of winners, women 77%). carry: points of starting rating per point of last season's average margin
    cbb: {
      months: [10, 3], // in season from the first month to the second (0 = January)
      kind: 'cbb', college: true, games: 31, name: 'CBB', title: "Men's college basketball", path: 'basketball/mens-college-basketball', splitYear: true, base: 0,
      rounds: ['Sweet 16', 'Elite 8', 'Final Four', 'Championship'], winsNeeded: [1, 1, 1, 1],
      cap: 30, ridge: 2, carry: 0.9, otherStart: -15, sigma: 12, noise: 10.4, uncScale: 0.6, weeks: 19,
      pool: 'non-D1', postName: 'tournament', bracketName: 'NCAA tournament',
    },
    wcbb: {
      months: [10, 3], // in season from the first month to the second (0 = January)
      kind: 'cbb', college: true, games: 30, name: 'WCBB', title: "Women's college basketball", path: 'basketball/womens-college-basketball', splitYear: true, base: 0,
      rounds: ['Sweet 16', 'Elite 8', 'Final Four', 'Championship'], winsNeeded: [1, 1, 1, 1],
      cap: 30, ridge: 1, carry: 1, otherStart: -15, sigma: 11, noise: 10.7, uncScale: 0.6, weeks: 19,
      pool: 'non-D1', postName: 'tournament', bracketName: 'NCAA tournament',
    },
    mlb: {
      months: [2, 9], // in season from the first month to the second (0 = January)
      games: 162, name: 'MLB', path: 'baseball/mlb', K: 3.2, mult: logMult, splitYear: false,
      hfa: 20, rest: null, carry: 40, // rest made no difference in baseball
      unc: { ridge: 80, half: 0, noise: 4.39, eloPer: 80 },
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

  // the sportsbook line ESPN shows for a game: the home spread and the home win chance implied
  // by the moneylines (with the bookmaker's margin taken out); null when there isn't one
  function parseLine(comp) {
    const o = (comp.odds || [])[0];
    if (!o) return null;
    const num = (x) => (x == null || x === '' ? NaN : /^even$/i.test(x) ? 100 : Number(x));
    const ml = o.moneyline || {};
    const mlOf = (side) => num(((ml[side] || {}).close || {}).odds ?? ((o[side + 'TeamOdds'] || {}).moneyLine));
    const implied = (x) => (x < 0 ? -x / (100 - x) : 100 / (x + 100));
    const mh = mlOf('home'), ma = mlOf('away');
    const pHome = isFinite(mh) && isFinite(ma) ? implied(mh) / (implied(mh) + implied(ma)) : null;
    let spread = num((((o.pointSpread || {}).home || {}).close || {}).line);
    if (!isFinite(spread)) spread = num(o.spread); // ESPN quotes this one from the home side too
    return { spread: isFinite(spread) ? spread : null, pHome };
  }

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
          id: ev.id,
          date: new Date(ev.date),
          neutral: !!comp.neutralSite,
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
          id: ev.id, line: status.completed ? undefined : parseLine(comp),
          date: new Date(ev.date), week, post: st === 3, round: st === 3 ? cfbRound(comp) : -1, conf: '', neutral: !!comp.neutralSite,
          done: !!status.completed, home: sides.home, away: sides.away,
        });
      }
    }
    games.sort((a, b) => a.date - b.date);
    return { year, teams, divisions, games, failed };
  }

  // NCAA tournament rounds from the Sweet 16 on (the bracket would be too wide before that)
  function cbbRound(comp) {
    const h = headline(comp);
    if (!/(Men's Basketball Championship|NCAA Women's Championship)/i.test(h)) return -1; // NIT, WBIT and the rest
    if (/sweet 16/i.test(h)) return 0;
    if (/elite (8|eight)/i.test(h)) return 1;
    if (/final four/i.test(h)) return 2;
    if (/national championship/i.test(h)) return 3;
    return -1;
  }

  // college basketball: standings for the team list, then one scoreboard per ESPN week (about 360 teams play ~6,000
  // games, too many for per-team schedules) plus, once the season's over, one per day of the postseason
  async function loadCbbYear(L, year, withPost) {
    const standings = await getJSON(`${BASE}/v2/sports/${L.path}/standings?season=${year}`);
    const teams = {};
    const divisions = [];
    for (const conf of standings.children || []) {
      const ids = [];
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
      if (ids.length) divisions.push({ name: conf.name, conf: 'D1', ids });
    }
    // every non-Division I opponent shares one rating, like FCS teams in college football
    teams.X = { id: 'X', name: L.pool, color: '#555', alt: '#555', record: '', wl: { w: 0, l: 0, t: 0, pts: 0 },
      clinch: '', streak: '', l10: '', slug: 'non-d1', hidden: true };

    // ESPN's week 1 starts at the beginning of November; past seasons need every week, the current one up to next week
    const start = new Date(year - 1, 10, 1);
    const now = Math.floor((Date.now() - start) / (7 * 864e5)) + 2;
    const last = withPost ? L.weeks : Math.max(1, Math.min(L.weeks, now));
    const urls = [];
    for (let w = 1; w <= last; w++) urls.push({ week: w, url: `${BASE}/site/v2/sports/${L.path}/scoreboard?dates=${year}&seasontype=2&week=${w}&groups=50&limit=1000` });
    if (withPost) {
      for (let d = new Date(year, 2, 14); d <= new Date(year, 3, 9); d = new Date(d.getTime() + 864e5)) {
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        urls.push({ week: L.weeks + 1, url: `${BASE}/site/v2/sports/${L.path}/scoreboard?dates=${ymd}&groups=50&limit=1000` });
      }
    }

    let failed = 0;
    const pages = await pool(urls, CONCURRENCY, (u) => getJSON(u.url).then((d) => ({ ...u, d })).catch(() => { failed++; return { ...u, d: {} }; }));
    const seen = new Set();
    const games = [];
    for (const { week, d } of pages) {
      for (const ev of d.events || []) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        const comp = ev.competitions[0];
        const sides = {};
        for (const c of comp.competitors) {
          const id = teams[c.team.id] ? c.team.id : 'X';
          if (id !== 'X') {
            if (c.team.color && teams[id].color === '#555') teams[id].color = '#' + c.team.color;
            if (c.team.alternateColor) teams[id].alt = '#' + c.team.alternateColor;
          }
          sides[c.homeAway] = { id, score: scoreOf(c.score) };
          if (id === 'X') {
            Object.assign(sides[c.homeAway], {
              name: c.team.shortDisplayName || c.team.name || L.pool,
              color: '#' + (c.team.color || '555555'),
              alt: '#' + (c.team.alternateColor || c.team.color || '555555'),
            });
          }
        }
        if (!sides.home || !sides.away || (sides.home.id === 'X' && sides.away.id === 'X')) continue;
        const status = (comp.status || ev.status || {}).type || {};
        const post = (ev.season || {}).type === 3;
        games.push({
          id: ev.id, line: status.completed ? undefined : parseLine(comp),
          date: new Date(ev.date), week: post ? L.weeks + 1 : week, post, round: post ? cbbRound(comp) : -1, conf: '',
          neutral: !!comp.neutralSite, done: !!status.completed, home: sides.home, away: sides.away,
        });
      }
    }
    games.sort((a, b) => a.date - b.date);
    return { year, teams, divisions, games, failed };
  }

  async function loadLeague(key) {
    const L = LEAGUES[key];
    const sb = await getJSON(`${BASE}/site/v2/sports/${L.path}/scoreboard`);
    // college basketball keeps the season under leagues[0], with the type as an object
    const season = sb.season || ((sb.leagues || [])[0] || {}).season || {};
    const phase = typeof season.type === 'object' ? Number(season.type.type) : season.type; // 1 pre, 2 regular, 3 post, 4 off
    let year = season.year;

    const cfb = L.kind === 'cfb';
    const load = cfb ? loadCfbYear : L.kind === 'cbb' ? loadCbbYear : loadYear;
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
    } else {
      data.prior = await marginsFrom(L, data.year - 1).catch(() => null);
    }
    return data;
  }

  // pro leagues start each team from last season's average margin per game, which one standings request gives
  async function marginsFrom(L, year) {
    const standings = await getJSON(`${BASE}/v2/sports/${L.path}/standings?level=1&season=${year}`);
    const out = {};
    const walk = (node) => {
      for (const c of node.children || []) walk(c);
      for (const e of (node.standings || {}).entries || []) {
        const v = (name) => Number(((e.stats || []).find((x) => x.name === name) || {}).value) || 0;
        const gp = v('gamesPlayed') || v('wins') + v('losses') + v('ties') + v('otLosses');
        if (v('avgPointsFor')) out[e.team.id] = v('avgPointsFor') - v('avgPointsAgainst');
        else if (gp) out[e.team.id] = (v('pointsFor') - v('pointsAgainst')) / gp;
      }
    };
    walk(standings);
    return Object.keys(out).length ? out : null;
  }

  // ---------- elo ----------

  function runElo(L, games, teams, prior) {
    const state = {};
    for (const id in teams) {
      const start = START + (prior && prior[id] != null ? L.carry * prior[id] : 0);
      state[id] = { ...teams[id], elo: start, start, last: 0, hist: [], oppSum: 0, oppN: 0, regN: 0, wins: 0, expWins: 0 };
    }
    // home field and rest for every game, played or not: days off since each team's previous game, capped
    const lastSeen = {};
    for (const g of games) {
      const off = (id) => (lastSeen[id] == null || !L.rest ? 0
        : Math.min(L.rest.cap, Math.max(0, Math.round((g.date - lastSeen[id]) / 864e5) - 1)));
      const rh = lastSeen[g.home.id] == null && L.rest ? L.rest.cap : off(g.home.id);
      const ra = lastSeen[g.away.id] == null && L.rest ? L.rest.cap : off(g.away.id);
      g.edge = (g.neutral ? 0 : L.hfa || 0) + (L.rest ? L.rest.elo * (rh - ra) : 0);
      lastSeen[g.home.id] = lastSeen[g.away.id] = g.date;
    }
    // luck ignores each team's first quarter of the season, while everyone's still near 1600
    const settle = Math.ceil(L.games / 4);

    const played = [];
    for (const g of games) {
      if (!g.done) continue;
      const h = state[g.home.id];
      const a = state[g.away.id];

      const diff = h.elo - a.elo + g.edge;
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

  // rating uncertainty for the pro leagues: the standard error a least-squares margin fit of the same games would
  // give each team (refit after every day's games, older games counting less in leagues with `half`), converted
  // to Elo. It depends only on who has played whom and when, not on the results
  function proUncertainty(L, data, state) {
    const U = L.unc;
    const ids = Object.keys(state);
    const ix = Object.fromEntries(ids.map((id, i) => [id, i]));
    const n = ids.length + 1; // plus home field
    const scale = U.noise * U.eloPer;
    const sd0 = scale / Math.sqrt(U.ridge);
    for (const id of ids) { state[id].sd0 = state[id].sd = sd0; }
    const done = data.games.filter((g) => g.done);
    const next = Object.fromEntries(ids.map((id) => [id, 0])); // next hist entry to fill per team
    for (let k = 0; k < done.length;) {
      const day = done[k].date.toDateString();
      let e = k;
      while (e < done.length && done[e].date.toDateString() === day) e++;
      const now = done[e - 1].date;
      const A = new Float64Array(n * n);
      for (let i = 0; i < n - 1; i++) A[i * n + i] = U.ridge;
      A[n * n - 1] = 0.01;
      for (let j = 0; j < e; j++) {
        const g = done[j];
        const w = U.half ? Math.pow(0.5, (now - g.date) / (U.half * 864e5)) : 1;
        const v = [[ix[g.home.id], 1], [ix[g.away.id], -1]];
        if (!g.neutral) v.push([n - 1, 1]);
        for (const [a, sa] of v) for (const [b, sb] of v) A[a * n + b] += w * sa * sb;
      }
      const inv = inverse(A, n);
      for (let j = k; j < e; j++) {
        for (const id of [done[j].home.id, done[j].away.id]) {
          const sd = scale * Math.sqrt(inv[ix[id] * n + ix[id]]);
          const h = state[id].hist[next[id]++];
          if (h) h.sd = sd;
          state[id].sd = sd;
        }
      }
      k = e;
    }
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

  // full inverse by Gauss-Jordan elimination (A isn't modified); for the uncertainty of least-squares ratings
  function inverse(A, n) {
    const w = 2 * n;
    const M = new Float64Array(n * w);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i * w + j] = A[i * n + j];
      M[i * w + n + i] = 1;
    }
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r * w + c]) > Math.abs(M[p * w + c])) p = r;
      if (p !== c) for (let k = 0; k < w; k++) { const t = M[c * w + k]; M[c * w + k] = M[p * w + k]; M[p * w + k] = t; }
      const d = M[c * w + c];
      if (!d) continue;
      for (let k = c; k < w; k++) M[c * w + k] /= d;
      for (let r = 0; r < n; r++) {
        const f = r === c ? 0 : M[r * w + c];
        if (!f) continue;
        for (let k = c; k < w; k++) M[r * w + k] -= f * M[c * w + k];
      }
    }
    const out = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i * n + j] = M[i * w + n + j];
    return out;
  }

  // a normal draw (Box-Muller)
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

  // standard normal CDF (Abramowitz & Stegun 7.1.26)
  function normCdf(z) {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  // power rating: least-squares fit of rating gaps (plus home field, learned from the games) to capped
  // score margins, pulled towards each team's starting rating; centred so an average FBS team is 0
  // with withSd, also each team's standard error: noise × √(diagonal of the inverted system)
  function marginRatings(L, ids, ix, games, prior, withSd) {
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
    const inv = withSd ? inverse(A, n) : null;
    const x = solve(A, b, n);
    const r = x.subarray(0, n - 1);
    const sd = inv ? Float64Array.from({ length: n - 1 }, (_, i) => L.noise * Math.sqrt(inv[i * n + i])) : null;
    let sum = 0, k = 0;
    ids.forEach((id, i) => { if (id !== 'FCS') { sum += r[i]; k++; } });
    for (let i = 0; i < n - 1; i++) r[i] -= k ? sum / k : 0;
    return { r, hfa: x[n - 1], sd };
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
    const sd0 = L.noise / Math.sqrt(L.ridge); // before any games, the starting rating is worth `ridge` games
    for (const id of ids) { state[id].start = now[ix[id]]; state[id].sd0 = state[id].sd = sd0; }
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
      const fit = marginRatings(L, ids, ix, upto, prior, true);
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
        h.hist.push({ date: g.date, week: g.week, post: g.post, opp: a.id, oppSide: g.away, oppName: g.away.name, home: true, neutral: g.neutral, us: g.home.score, them: g.away.score, elo: r[i], sd: fit.sd[i], shift: hs, sor: sor[i] });
        a.hist.push({ date: g.date, week: g.week, post: g.post, opp: h.id, oppSide: g.home, oppName: g.home.name, home: false, neutral: g.neutral, us: g.away.score, them: g.home.score, elo: r[j], sd: fit.sd[j], shift: as, sor: sor[j] });
        played.push({ ...g, shift: hs, aShift: as });
      }
      before = now;
      now = r;
      ids.forEach((id, i) => { state[id].sd = fit.sd[i]; });
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

  // college basketball: the same power rating as college football, but ~360 teams and ~6,000 games, so it's refit
  // after every day of games by conjugate gradient (warm-started from the day before) instead of a dense solve,
  // and each team's uncertainty uses the quick estimate noise × √(uncScale / (ridge + games played)), which matched
  // the backtest's actual errors to within about 7% at every stage of the season
  function rateCbb(L, data) {
    const ids = Object.keys(data.teams);
    const ix = Object.fromEntries(ids.map((id, i) => [id, i]));
    const n = ids.length + 1, H = n - 1; // the last unknown is home field
    const prior = new Float64Array(n);
    ids.forEach((id, i) => { prior[i] = id === 'X' ? L.otherStart : data.prior && data.prior[id] != null ? L.carry * data.prior[id] : 0; });
    const x = Float64Array.from(prior);
    const visibleIx = ids.map((id, i) => (data.teams[id].hidden ? -1 : i)).filter((i) => i >= 0);
    const centre = () => visibleIx.reduce((sum, i) => sum + x[i], 0) / (visibleIx.length || 1);

    const cnt = new Int32Array(n);
    const sdOf = (i) => L.noise * Math.sqrt(L.uncScale / (L.ridge + cnt[i]));
    const state = {};
    const c0 = centre();
    for (const id of ids) {
      const i = ix[id];
      state[id] = { ...data.teams[id], elo: x[i] - c0, start: x[i] - c0, sd0: sdOf(i), sd: sdOf(i), last: 0, hist: [], oppSum: 0, oppN: 0, wins: 0, expWins: 0 };
    }

    const done = data.games.filter((g) => g.done);
    const hi = Int32Array.from(done, (g) => ix[g.home.id]);
    const ai = Int32Array.from(done, (g) => ix[g.away.id]);
    const hn = Uint8Array.from(done, (g) => (g.neutral ? 0 : 1));
    const m = Float64Array.from(done, (g) => Math.max(-L.cap, Math.min(L.cap, g.home.score - g.away.score)));

    // A·v for the first `upto` games: ridge on every team, plus each game's rating gap (with home field)
    const Av = (v, out, upto) => {
      for (let i = 0; i < H; i++) out[i] = L.ridge * v[i];
      out[H] = 0.01 * v[H];
      for (let j = 0; j < upto; j++) {
        const d = v[hi[j]] - v[ai[j]] + hn[j] * v[H];
        out[hi[j]] += d; out[ai[j]] -= d; if (hn[j]) out[H] += d;
      }
    };
    const r = new Float64Array(n), p = new Float64Array(n), Ap = new Float64Array(n), b = new Float64Array(n);
    const refit = (upto) => {
      for (let i = 0; i < H; i++) b[i] = L.ridge * prior[i];
      b[H] = 0;
      for (let j = 0; j < upto; j++) { b[hi[j]] += m[j]; b[ai[j]] -= m[j]; if (hn[j]) b[H] += m[j]; }
      Av(x, Ap, upto);
      let rr = 0, bb = 0;
      for (let i = 0; i < n; i++) { r[i] = b[i] - Ap[i]; p[i] = r[i]; rr += r[i] * r[i]; bb += b[i] * b[i]; }
      for (let it = 0; it < 200 && rr > 1e-10 * (bb || 1); it++) {
        Av(p, Ap, upto);
        let pAp = 0;
        for (let i = 0; i < n; i++) pAp += p[i] * Ap[i];
        const step = rr / pAp;
        let rn = 0;
        for (let i = 0; i < n; i++) { x[i] += step * p[i]; r[i] -= step * Ap[i]; rn += r[i] * r[i]; }
        for (let i = 0; i < n; i++) p[i] = r[i] + (rn / rr) * p[i];
        rr = rn;
      }
    };
    const edge = (g) => (g.neutral ? 0 : x[H]);
    // strength of record: wins minus what a typical top-25 team would expect against the same schedule
    const sorNow = (upto) => {
      const sorted = visibleIx.map((i) => x[i]).sort((p2, q) => q - p2);
      const bar = sorted[Math.min(24, sorted.length - 1)] || 0;
      const out = new Float64Array(n);
      for (let j = 0; j < upto; j++) {
        const g = done[j];
        out[hi[j]] += (g.home.score > g.away.score ? 1 : 0) - normCdf((bar - x[ai[j]] + hn[j] * x[H]) / L.sigma);
        out[ai[j]] += (g.away.score > g.home.score ? 1 : 0) - normCdf((bar - x[hi[j]] - hn[j] * x[H]) / L.sigma);
      }
      return out;
    };

    const played = [];
    for (let k = 0; k < done.length;) {
      const day = done[k].date.toDateString();
      let e = k;
      while (e < done.length && done[e].date.toDateString() === day) e++;
      for (let j = k; j < e; j++) done[j].expHome = normCdf((x[hi[j]] - x[ai[j]] + edge(done[j])) / L.sigma); // odds going in
      const before = Float64Array.from(x);
      refit(e);
      const c = centre();
      const sor = sorNow(e);
      for (let j = k; j < e; j++) {
        const g = done[j], i = hi[j], a = ai[j];
        cnt[i]++; cnt[a]++;
        const hs = x[i] - before[i], as = x[a] - before[a];
        state[g.home.id].hist.push({ date: g.date, week: g.week, post: g.post, opp: g.away.id, oppSide: g.away, oppName: g.away.name, home: true, neutral: g.neutral,
          us: g.home.score, them: g.away.score, elo: x[i] - c, sd: sdOf(i), shift: hs, sor: sor[i] });
        state[g.away.id].hist.push({ date: g.date, week: g.week, post: g.post, opp: g.home.id, oppSide: g.home, oppName: g.home.name, home: false, neutral: g.neutral,
          us: g.away.score, them: g.home.score, elo: x[a] - c, sd: sdOf(a), shift: as, sor: sor[a] });
        played.push({ ...g, shift: hs, aShift: as });
      }
      k = e;
    }

    const c = centre();
    const sor = sorNow(done.length);
    const latest = done.length ? done[done.length - 1].date : null;
    const weekAgo = latest && new Date(latest - 7 * 864e5);
    const ratingAt = (t, when) => { let v = t.start; for (const h of t.hist) { if (h.date > when) break; v = h.elo; } return v; };
    ids.forEach((id, i) => {
      const t = state[id];
      t.elo = x[i] - c;
      t.sd = sdOf(i);
      t.last = weekAgo ? t.elo - ratingAt(t, weekAgo) : 0; // change over the past week
      if (!t.hidden && done.length) t.sor = sor[i];
    });
    const visible = ids.filter((id) => !state[id].hidden);
    if (weekAgo && done[0].date <= weekAgo) {
      const was = {}, is = {};
      visible.slice().sort((p2, q) => ratingAt(state[q], weekAgo) - ratingAt(state[p2], weekAgo)).forEach((id, k) => { was[id] = k + 1; });
      visible.slice().sort((p2, q) => state[q].elo - state[p2].elo).forEach((id, k) => { is[id] = k + 1; });
      for (const id of visible) state[id].move = was[id] - is[id];
    }
    // schedule strength: opponents' current ratings
    for (let j = 0; j < done.length; j++) {
      const h = state[done[j].home.id], a = state[done[j].away.id];
      h.oppSum += a.elo; h.oppN++;
      a.oppSum += h.elo; a.oppN++;
    }
    return { state, played, hfa: x[H] };
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
    const winP = (a, b) => 1 / (1 + Math.pow(10, -(elo[a] - elo[b] + (L.hfa || 0)) / 400)); // a hosts (the play-in's higher seed)
    const gh = Int32Array.from(rem, (g) => ix[g.home.id]);
    const ga = Int32Array.from(rem, (g) => ix[g.away.id]);
    const gp = Float64Array.from(rem, (g) => 1 / (1 + Math.pow(10, -(elo[ix[g.home.id]] - elo[ix[g.away.id]] + (g.edge || 0)) / 400)));
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
    return `<h3>${esc(L.bracketName || 'Playoffs')}</h3><div class="bracket-wrap">` + html + '</div></div>';
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

  // offsets from an average team (elo is zero-sum, and last season's margins average out, so the mean stays near START)
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

  // likely rank: the middle 80% of where a team lands when every rating is redrawn within its uncertainty
  const LIKELY = {
    key: 'likely', label: 'likely', asc: true, opt: true, // on phones it's in the team panel instead
    tip: 'likely rank: the middle 80% of where the team would rank if every rating were redrawn within its uncertainty ' +
      '(the ± in the team panel, checked against five seasons of results). Narrow = settled, wide = still up for grabs',
    val: (t) => (t.lo == null ? null : t.lo + t.hi / 1000), html: (t) => (t.lo == null ? '' : t.lo === t.hi ? t.lo : `${t.lo}–${t.hi}`),
  };

  // numeric columns: each one sorts on click and explains itself on hover
  let showMore = false; // the secondary columns (marked more) only show after "more stats"
  function columns(L, extra, showRank) {
    return allColumns(L, extra, showRank).filter((c) => showMore || !c.more);
  }

  function allColumns(L, extra, showRank) {
    if (L.college) return [
      extra.move && { key: 'move', label: 'wk', lead: true, opt: true, tip: 'places moved in the power rankings since last week',
        val: (t) => t.move ?? null, html: moveHTML },
      showRank && { key: 'rank', label: '#', lead: true, asc: true, tip: 'rank by power rating',
        val: (t) => t.rank, html: (t) => t.rank },
      extra.ap && { key: 'ap', label: 'ap', asc: true,
        tip: `AP Top 25 rank, from the poll released ${extra.ap.date ? fmtDate(extra.ap.date) : 'after these games'}` +
          (extra.ap.final ? ' (the final poll)' : ''),
        val: (t) => extra.ap.rank[t.id] ?? null, html: (t) => extra.ap.rank[t.id] ?? '' },
      { key: 'rec', label: 'rec', tip: 'overall record; sorts by win percentage',
        val: (t) => t.recVal, html: (t) => esc(t.record) },
      { key: 'elo', label: 'power', tip: `power rating: points better than an average ${L.kind === 'cfb' ? 'FBS' : 'Division I'} team on a neutral ` +
        `field. Fit to every game so far (margins capped at ${L.cap}, home field worth ${(extra.hfa || 0).toFixed(1)} learned from ` +
        `the games), starting from last season, which counts for about ${L.ridge} game${L.ridge === 1 ? '' : 's'}`,
        val: (t) => t.elo, html: (t) => luckText(t.elo) },
      LIKELY,
      { key: 'sor', label: 'sor', opt: true, tip: 'strength of record: wins above what a typical top-25 team would expect against the same schedule (+ = more impressive)',
        val: (t) => t.sor, html: (t) => (t.sor == null ? '' : luckText(t.sor)) },
      { more: true, key: 'last', label: 'last', tip: 'change in power rating since last week',
        val: (t) => t.last, html: (t) => delta1(t.last) },
      { more: true, key: 'sos', label: 'sos', opt: true, tip: 'strength of schedule: average power rating of opponents faced (+ = tougher)',
        val: (t) => t.sos, html: (t) => (t.sos == null ? '' : luckText(t.sos)) },
      extra.left && { more: true, key: 'left', label: 'left', opt: true, tip: 'average power rating of the opponents still to play (+ = tougher)',
        val: (t) => t.left, html: (t) => (t.left == null ? '' : luckText(t.left)) },
    ].filter(Boolean);

    return [
      extra.move && { key: 'move', label: 'wk', lead: true, opt: true, tip: 'places moved in the Elo rankings over the past week',
        val: (t) => t.move ?? null, html: moveHTML },
      showRank && { key: 'rank', label: '#', lead: true, asc: true, tip: 'rank by current Elo',
        val: (t) => t.rank, html: (t) => t.rank },
      { key: 'rec', label: 'rec',
        tip: (L.playoff || {}).points ? 'regular-season record (W-L-OTL); sorts by points' : 'regular-season record; sorts by win percentage',
        val: (t) => t.recVal, html: (t) => esc(t.record) },
      { key: 'elo', label: 'elo', tip: `current Elo rating (${START} is average). Teams started from last season's average margin ` +
        `(${L.carry} Elo per ${L.eloPerPoint ? 'point' : (L.playoff || {}).points ? 'goal' : 'run'} per game); predictions add home field ` +
        `(${L.hfa})${L.rest ? ` and rest (${L.rest.elo} per extra day off${L.rest.cap > 1 ? `, up to ${L.rest.cap}` : ', so mainly back-to-backs'})` : ''}`,
        val: (t) => t.elo, html: (t) => Math.round(t.elo) },
      LIKELY,
      { more: true, key: 'last', label: 'last', tip: 'rating change from their most recent game',
        val: (t) => t.last, html: (t) => delta(t.last) },
      { more: true, key: 'l5', label: 'l5', tip: 'form: rating change over their last 5 games',
        val: (t) => t.l5, html: (t) => delta(t.l5) },
      extra.odds && { key: 'playoff', label: 'playoff', short: 'odds',
        tip: `chance of making the playoffs, from ${SIMS.toLocaleString('en-US')} simulations of the rest of the regular season`,
        val: (t) => extra.odds[t.id], html: (t) => esc(pctText(extra.odds[t.id])) },
      { more: true, key: 'sos', label: 'sos',
        tip: 'strength of schedule so far: average rating of opponents faced, relative to an average team (+ = tougher)',
        val: (t) => t.sos, html: (t) => signed(t.sos), opt: true },
      extra.left && { more: true, key: 'left', label: 'left',
        tip: 'strength of the schedule still to play: average current rating of remaining opponents, relative to an average team (+ = tougher)',
        val: (t) => t.left, html: (t) => signed(t.left), opt: true },
      { more: true, key: 'luck', label: 'luck', opt: true,
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
        `${c.short ? `<span class="lbl-long">${c.label}</span><span class="lbl-short">${c.short}</span>` : c.label}<span class="ind"></span></th>`;
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
    if (!L.college) return { elo: { name: 'elo', base: START, fmt: (v) => Math.round(v), dfmt: delta, span: 20, carried: true, band: true } };
    return {
      elo: { name: 'power rating', base: 0, fmt: luckText, dfmt: delta1, span: 4, carried: true, band: true },
      sor: { name: 'strength of record', base: 0, fmt: luckText, dfmt: delta1, span: 1 },
    };
  }

  let curL = null; // the league being shown
  let curHfa = 0; // college home field, in points
  // chance a beats b, given a's edge (college: home field in points; pro: home field and rest in Elo)
  const winProb = (a, b, edge = 0) => (curL.college
    ? normCdf((a.elo - b.elo + edge) / curL.sigma)
    : 1 / (1 + Math.pow(10, -(a.elo - b.elo + edge) / 400)));
  const edgeOf = (g) => (curL.college ? (g.neutral ? 0 : curHfa) : g.edge || 0);
  const gameProb = (state, g) => winProb(state[g.home.id], state[g.away.id], edgeOf(g));

  let curState = {}; // ratings of the league being shown
  let curData = null; // its games
  // who to show for a game side: the team, or for college the actual FCS school behind the pooled rating
  const who = (side) => (side.name ? { name: side.name, color: side.color, alt: side.alt, fcs: true } : curState[side.id]);
  const tag = (t) => `${swatch(t)}${esc(t.name)}${t.fcs ? ` <span class="meta">(${esc(curL.pool)})</span>` : ''}`;
  const rankTag = (t) => (t.fcs || !t.rank ? '' : `#${t.rank} `) + tag(t);

  // "Iowa by 4.5 · 65%  line Iowa −6.5". Football and basketball quote spreads; hockey and baseball
  // lines are moneylines, so those compare win chances instead
  function oddsText(g) {
    const pHome = gameProb(curState, g);
    const h = who(g.home), a = who(g.away);
    const fav = pHome >= 0.5 ? h : a;
    const pct = pctText(Math.max(pHome, 1 - pHome));
    const half = (x) => String(Math.round(Math.abs(x) * 2) / 2);
    const gap = curState[g.home.id].elo - curState[g.away.id].elo;
    const pts = curL.college ? gap + edgeOf(g) : curL.eloPerPoint ? (gap + edgeOf(g)) / curL.eloPerPoint : null;
    const model = pts == null ? `${fav.name} ${pct}` : half(pts) === '0' ? `toss-up · ${pct}` : `${fav.name} by ${half(pts)} · ${pct}`;
    let line = '';
    if (g.line && pts != null && g.line.spread != null) {
      line = g.line.spread === 0 ? "line pick'em" : `line ${(g.line.spread < 0 ? h : a).name} −${half(g.line.spread)}`;
    } else if (g.line && g.line.pHome != null) {
      line = `line ${(g.line.pHome >= 0.5 ? h : a).name} ${pctText(Math.max(g.line.pHome, 1 - g.line.pHome))}`;
    }
    return esc(model) + (line ? `<span class="line"> · ${esc(line)}</span>` : '');
  }
  const baseOf = (L) => L.base ?? START;
  const fmtR = (v) => (curL.college ? luckText(v) : Math.round(v)); // college ratings are small, keep a decimal
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

  // 80% rank ranges (t.lo, t.hi) for a set of teams, from redrawing every rating within its uncertainty
  const RANK_SIMS = 2000;
  function rankRanges(rows) {
    const n = rows.length;
    const draws = new Float64Array(n);
    const order = Array.from({ length: n }, (_, i) => i);
    const ranks = rows.map(() => new Int32Array(RANK_SIMS));
    for (let s = 0; s < RANK_SIMS; s++) {
      for (let i = 0; i < n; i++) draws[i] = rows[i].elo + (rows[i].sd || 0) * gauss();
      order.sort((a, b) => draws[b] - draws[a]);
      order.forEach((i, k) => { ranks[i][s] = k + 1; });
    }
    rows.forEach((t, i) => {
      const r = ranks[i].sort();
      t.lo = r[Math.floor(RANK_SIMS * 0.1)];
      t.hi = r[Math.floor(RANK_SIMS * 0.9)];
    });
  }

  function openPanel(tr, state) {
    const team = state[tr.dataset.id];
    const others = Object.values(state).filter((t) => t !== team && !t.hidden).sort((a, b) => a.name.localeCompare(b.name));
    const pm = team.sd == null ? '' : curL.college ? team.sd.toFixed(1) : Math.round(team.sd);
    const facts = [
      pm !== '' && `<span data-tip="uncertainty: about a 2-in-3 chance the team's true strength is within this much of its rating. It shrinks as games are played; the shaded band on the chart shows it game by game">rating ±${pm}</span>`,
      team.lo != null && `likely rank ${team.lo === team.hi ? team.lo : `${team.lo}–${team.hi}`}`,
      team.streak && `streak ${esc(team.streak)}`, team.l10 && `last 10: ${esc(team.l10)}`,
    ].filter(Boolean);

    const row = document.createElement('tr');
    row.className = 'hist';
    row.innerHTML = `<td colspan="${tr.children.length}">
      ${facts.length ? `<div class="panel-meta">${facts.join(' · ')}</div>` : ''}
      <div class="panel-meta">
        ${curL.college ? `<label>plot <select class="metric">${Object.entries(metricsFor(curL)).map(([k, m]) =>
          `<option value="${k}">${esc(m.name)}</option>`).join('')}</select></label> &nbsp; ` : ''}
        <label>compare <select class="cmp"><option value="">—</option>${others.map((t) =>
          `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      </div>
      <div class="legend" hidden></div>
      <div class="chart"></div>
      <p class="h2h meta" hidden></p>
      ${panelExtras(team)}
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

  // best win and worst loss (judged by the opponent's current rating) and the games still to play
  function panelExtras(team) {
    const opp = (h) => (h.oppSide ? who(h.oppSide) : curState[h.opp]);
    const rating = (h) => curState[h.opp].elo;
    const pick = (list, better) => list.reduce((x, h) => (!x || better(rating(h), rating(x)) ? h : x), null);
    const best = pick(team.hist.filter((h) => h.us > h.them), (p, q) => p > q);
    const worst = pick(team.hist.filter((h) => h.us < h.them), (p, q) => p < q);
    const game = (label, h) => `<li><span class="sub">${label}</span> ${rankTag(opp(h))} ${h.us}–${h.them}</li>`;
    const resume = [best && game('best win', best), worst && game('worst loss', worst)].filter(Boolean);

    const cutoff = Date.now() - 12 * 3600 * 1000;
    const left = curData.games.filter((g) => !g.done && g.date >= cutoff && (g.home.id === team.id || g.away.id === team.id));
    const SHOW = 5;
    const sched = left.slice(0, SHOW).map((g) => {
      const home = g.home.id === team.id;
      const p = gameProb(curState, g);
      return `<li><span class="sub">${fmtDate(g.date)}</span> ${home || g.neutral ? 'vs' : '@'} ${rankTag(who(home ? g.away : g.home))}
        <span class="sub">${esc(pctText(home ? p : 1 - p))}</span></li>`;
    });
    if (left.length > SHOW) sched.push(`<li class="sub">+ ${left.length - SHOW} more</li>`);

    if (!resume.length && !sched.length) return '';
    return `<div class="panel-cols">
      ${resume.length ? `<div><h4>résumé</h4><ul>${resume.join('')}</ul></div>` : ''}
      ${sched.length ? `<div><h4>still to play · win chance</h4><ul>${sched.join('')}</ul></div>` : ''}
    </div>`;
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
      const pts = [{ v: M.carried && t.start != null ? t.start : base, sd: t.sd0 }, ...t.hist.map((h) => ({ ...h, v: h[mkey] }))];
      if (!M.band) pts.forEach((p) => { p.sd = null; });
      pts.forEach((p, i) => { p.d = i ? p.v - pts[i - 1].v : 0; });
      return { t, cls: other ? (k ? 'line b' : 'line a') : 'line', pts };
    });
    const pts = series[0].pts;
    const n = Math.max(...series.map((sr) => sr.pts.length));
    const W = Math.max(300, el.clientWidth || 600);
    const H = 150;
    const pad = { l: 40, r: 44, t: 14, b: 22 };

    const vals = series.flatMap((sr) => sr.pts.map((p) => p.v));
    // the uncertainty band (one standard error either side) sets the range too
    const lo = Math.min(base, ...series.flatMap((sr) => sr.pts.map((p) => p.v - (p.sd || 0))));
    const hi = Math.max(base, ...series.flatMap((sr) => sr.pts.map((p) => p.v + (p.sd || 0))));
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
      svg += label(px + 4, pad.t - 4, curL.postName || 'playoffs', 'start');
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
      if (sr.pts.every((p) => p.sd != null)) {
        const k = sr.cls.split(' ')[1] || '';
        const up = sr.pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v + p.sd).toFixed(1)}`).join('');
        const down = sr.pts.map((p, i) => `L${x(i).toFixed(1)},${y(p.v - p.sd).toFixed(1)}`).reverse().join('');
        svg += `<path class="band ${k}" d="${up}${down}Z"/>`;
      }
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
      const pm = p.sd != null ? ` ±${curL.college ? p.sd.toFixed(1) : Math.round(p.sd)}` : '';
      if (i === 0) return `${who}season start · ${M.carried && sr.t.start != null ? `${M.fmt(p.v)}${pm} (from last season)` : base}`;
      const res = p.us > p.them ? 'W' : p.us < p.them ? 'L' : 'T';
      return `${who}${fmtDate(p.date)} · ${res} ${p.us}–${p.them} ${p.home || p.neutral ? 'vs' : '@'}${p.neutral ? ' (neutral)' : ''} ${esc(p.oppName || state[p.opp].name)}` +
        `${other ? ' · ' : '<br>'}${M.fmt(p.v)}${pm} ${M.dfmt(p.d)}`;
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
  let renders = 0; // bumped on every render, so late background loads only touch the page that asked
  const cache = {};

  function render(key, data) {
    const L = LEAGUES[key];
    curL = L;
    const cfb = !!L.college; // the college sports share the ratings UI
    const base = baseOf(L);
    const { state, played, hfa } = L.kind === 'cfb' ? rateCfb(L, data) : L.kind === 'cbb' ? rateCbb(L, data)
      : runElo(L, data.games, data.teams, data.prior);
    curHfa = hfa || 0;
    if (!cfb) proUncertainty(L, data, state);
    curState = state;
    curData = data;
    const all = Object.values(state).filter((t) => !t.hidden).sort((a, b) => b.elo - a.elo);
    all.forEach((t, i) => { t.rank = i + 1; });
    rankRanges(all);
    clinchLegend = L.clinch || {};

    // form: rating change over the last 5 games
    for (const t of all) t.l5 = t.hist.slice(-5).reduce((sum, h) => sum + h.shift, 0);

    // rank movement over the week before the latest game
    const latest = played.length ? played[played.length - 1].date : null;
    const weekAgo = latest && new Date(latest - 7 * 24 * 3600 * 1000);
    if (!cfb && weekAgo && played[0].date <= weekAgo) { // college sets this from its weekly refits
      const eloAt = (t) => {
        let e = t.start;
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

    // time machine: the table as it stood after each week. College uses its own week numbers;
    // the pro leagues count 7-day stretches from the first game
    const WEEK = 7 * 24 * 3600 * 1000;
    const day0 = played.length ? new Date(played[0].date).setHours(0, 0, 0, 0) : 0;
    const weekOf = cfb ? (h) => h.week : (h) => Math.floor((h.date - day0) / WEEK) + 1;
    const weeks = [...new Set(played.map(weekOf))].sort((p, q) => p - q);
    const weekEnd = Object.fromEntries(weeks.map((k) => [k, played.filter((g) => weekOf(g) === k).pop().date]));
    const weekName = (k) => {
      const post = played.some((g) => weekOf(g) === k && g.post);
      if (L.kind === 'cfb') return k > L.weeks ? 'the bowls and playoff' : `week ${k}${post ? ' · postseason' : ''}`;
      if (cfb && k > L.weeks) return 'the tournaments';
      return `week ${k}${post ? ' · postseason' : ''} · through ${fmtDate(weekEnd[k])}`;
    };
    let at = weeks.length - 1; // index into weeks; the last one is "now"
    const apAt = (i) => (data.ap && data.ap[weeks[i]]) || null;
    const snaps = {};
    const snapshot = (i) => {
      if (snaps[i]) return snaps[i];
      const startOf = (t) => t.start ?? (cfb ? 0 : START);
      const ratingAt = (t, j) => {
        if (j < 0) return startOf(t);
        const hs = t.hist.filter((h) => weekOf(h) <= weeks[j]);
        return hs.length ? hs[hs.length - 1].elo : startOf(t);
      };
      const rows = all.map((t) => {
        const hs = t.hist.filter((h) => weekOf(h) <= weeks[i]);
        const reg = hs.filter((h) => !h.post);
        const w = reg.filter((h) => h.us > h.them).length, l = reg.filter((h) => h.us < h.them).length, d = reg.length - w - l;
        const elo = ratingAt(t, i), was = ratingAt(t, i - 1);
        return {
          ...t, elo, was, last: elo - was, clinch: '', sd: hs.length ? hs[hs.length - 1].sd ?? t.sd : t.sd0,
          l5: hs.slice(-5).reduce((sum, h) => sum + h.shift, 0),
          sor: cfb && hs.length ? hs[hs.length - 1].sor : null,
          record: `${w}-${l}${d ? '-' + d : ''}`, recVal: (w + 0.5 * d) / (reg.length || 1),
        };
      });
      rows.sort((p, q) => q.elo - p.elo).forEach((t, k) => { t.rank = k + 1; });
      rankRanges(rows);
      // without last season to start from, everyone's level before the first week: no movement to show
      if (i > 0 || data.prior) {
        rows.slice().sort((p, q) => q.was - p.was).forEach((t, k) => { t.move = k + 1 - t.rank; });
      } else rows.forEach((t) => { t.move = undefined; });
      return (snaps[i] = { rows, byId: Object.fromEntries(rows.map((t) => [t.id, t])) });
    };
    // past weeks drop the columns that only make sense today
    const pastCols = (showRank) => columns(L, { move: true, hfa, ap: apAt(at) }, showRank)
      .filter((c) => !['sos', 'left', 'luck', 'playoff'].includes(c.key));
    const live = () => at === weeks.length - 1;
    const rowsNow = () => (live() ? all : snapshot(at).rows);
    const byId = (id) => (live() ? state[id] : snapshot(at).byId[id]);
    const colsNow = (showRank) => (live() ? columns(L, { ...extra, ap: apAt(at) }, showRank) : pastCols(showRank));

    // college lists 138 teams, so the ranked view starts at the top 25
    const more = () => (cfb ? `<button class="more" data-more>${showAll ? 'show top 25' : `show all ${all.length}`}</button>` : '');
    const views = {
      ranked: () => table(rowsNow(), colsNow(true), cfb && !showAll ? 25 : 0) + more(),
      division: () => data.divisions.map(({ name, ids }) =>
        `<h3>${esc(name)}</h3>` + table(ids.map(byId), colsNow(false))).join(''),
    };
    const resort = (key) => {
      const asc = key === 'rank' || key === 'ap' || key === 'likely';
      sort = sort.key === key ? { key, dir: -sort.dir } : { key, dir: asc ? 1 : -1 };
      show(view);
    };
    const show = (v, scroll) => {
      view = v;
      $('tables').innerHTML = views[v]() + clinchKey(rowsNow());
      for (const b of document.querySelectorAll('#views button[data-view]')) b.classList.toggle('active', b.dataset.view === v);
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
    for (const b of document.querySelectorAll('#views button[data-view]')) {
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

    const tm = $('tm');
    const goTo = (i) => {
      at = Math.max(0, Math.min(weeks.length - 1, i));
      tm.value = at;
      tm.style.setProperty('--fill', `${weeks.length > 1 ? (100 * at) / (weeks.length - 1) : 100}%`);
      $('tm-label').textContent = live() ? `${weekName(weeks[at]).replace(/^the /, '')} (latest)` : `after ${weekName(weeks[at])}`;
      $('tm-now').hidden = live();
      $('tm-prev').disabled = at === 0;
      $('tm-next').disabled = live();
    };
    $('timeline').hidden = weeks.length < 2;
    tm.max = Math.max(0, weeks.length - 1);
    tm.oninput = () => { goTo(Number(tm.value)); show(view); };
    $('tm-prev').onclick = () => { goTo(at - 1); show(view); };
    $('tm-next').onclick = () => { goTo(at + 1); show(view); };
    $('tm-now').onclick = () => { goTo(weeks.length - 1); show(view); };
    goTo(at);
    const moreBtn = $('more-stats');
    const moreLabel = () => { moreBtn.textContent = showMore ? 'fewer stats' : 'more stats'; };
    moreBtn.onclick = () => { showMore = !showMore; moreLabel(); show(view); };
    moreLabel();
    show(view, true);

    // college polls load in the background and fill in the ap column when they arrive
    const token = ++renders;
    if (cfb && weeks.length) {
      data.polls = data.polls || fetchPolls(L, data, weeks).catch(() => {});
      data.polls.then(() => { if (token === renders && current === key && data.ap) show(view); });
    }

    $('title').textContent = `${L.title || L.name} ${cfb ? 'ratings' : 'Elo'}, ${seasonLabel(L, data.year)}`;

    const series = buildSeries(L, data.games);
    const last = played[played.length - 1];
    let status = played.length
      ? `${played.length.toLocaleString('en-US')} games played, through ${fmtDate(last.date)}`
      : data.prior ? 'no games played yet; ratings start from last season' : `no games played yet; everyone is still at ${base}`;
    // the model's record: each pick made from the ratings before that game (toss-ups and ties don't count)
    const picks = played.filter((g) => g.home.score !== g.away.score && Math.abs(g.expHome - 0.5) > 1e-9);
    const right = picks.filter((g) => (g.expHome > 0.5) === (g.home.score > g.away.score)).length;
    if (picks.length) status += ` · model picked ${Math.round((100 * right) / picks.length)}% of winners`;
    if (data.failed) status += ` · ${data.failed} schedule request(s) failed, a few games may be missing`;
    $('status').textContent = status;

    $('bracket').innerHTML = bracketHTML(L, series, state);

    // recent games, upsets and up next; redrawn when the pro leagues' betting lines arrive
    let shown = [];
    const drawLists = () => {
      let html = '';
      const recent = played.slice(-8).reverse();
      if (recent.length) {
        html += '<h3>Recent games</h3><ul class="games">' + recent.map((g) => {
          const a = who(g.away), h = who(g.home);
          const awayWon = g.away.score > g.home.score;
          const gain = awayWon ? (g.aShift ?? -g.shift) : g.shift;
          return `<li><span class="sub">${fmtDate(g.date)}</span><span>${tag(a)} ${g.away.score} @ ${tag(h)} ${g.home.score}</span>
            <span class="sub">${esc((awayWon ? a : h).name)} ${cfb ? delta1(gain) : delta(gain)}</span></li>`;
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
          return `<li><span class="sub">${fmtDate(g.date)}</span><span>${tag(a)} ${g.away.score} @ ${tag(h)} ${g.home.score}</span>
            <span class="sub">${esc(winner.name)} had ${esc(pctText(p))}</span></li>`;
        }).join('') + '</ul>';
      }

      const upNext = (g) => `<li><span class="sub">${fmtDate(g.date)}</span>` +
        `<span>${tag(who(g.away))} ${g.neutral ? 'vs' : '@'} ${tag(who(g.home))}</span><span class="sub">${oddsText(g)}</span></li>`;
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
          shown.push(g);
          html += `<p class="gotw-label">game of the week</p><ul class="games gotw">${upNext(g)}</ul>`;
        }

        shown.push(...next);
        html += '<ul class="games">' + next.filter((g) => !gotw || g !== gotw.g).map(upNext).join('') + '</ul>';
      }
      $('recent').innerHTML = html;
    };
    drawLists();

    // pro schedules don't carry betting lines, so fetch the scoreboards for the dates shown, once
    const need = shown.filter((g) => g.line === undefined);
    if (!cfb && need.length && !data.linesLoading) {
      data.linesLoading = fetchLines(L, data, need).then(() => { if (curData === data) drawLists(); });
    }
  }

  // college: the AP poll released after each week's games (ESPN files it under the next week; the final
  // poll comes after the bowls). A week with no poll of its own keeps the one before it
  async function fetchPolls(L, data, weeks) {
    const core = `https://sports.core.api.espn.com/v2/sports/${L.path.replace('/', '/leagues/')}/seasons/${data.year}`;
    const jobs = weeks.map((k) => ({
      k, url: k > L.weeks ? `${core}/types/3/weeks/1/rankings/1` : `${core}/types/2/weeks/${k + 1}/rankings/1`,
    }));
    const res = await pool(jobs, CONCURRENCY, (j) => getJSON(j.url, 1).then((d) => ({ ...j, d })).catch(() => ({ ...j, d: null })));
    const ap = {};
    let last = null;
    for (const { k, d } of res.sort((p, q) => p.k - q.k)) {
      if (d && (d.ranks || []).length) {
        last = {
          date: d.date ? new Date(d.date) : null,
          final: k > L.weeks,
          rank: Object.fromEntries(d.ranks.map((r) => [((r.team || {}).$ref || '').match(/teams\/(\d+)/)?.[1], r.current])),
        };
      }
      ap[k] = last;
    }
    data.ap = ap;
  }

  // one scoreboard request per (US Eastern) date; games without a line are marked null so they aren't asked for again
  async function fetchLines(L, data, games) {
    const ymd = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '');
    const dates = [...new Set(games.map((g) => ymd(g.date)))].slice(0, 7);
    const byId = Object.fromEntries(data.games.map((g) => [g.id, g]));
    await pool(dates, CONCURRENCY, (d) => getJSON(`${BASE}/site/v2/sports/${L.path}/scoreboard?dates=${d}`)
      .then((sb) => {
        for (const ev of sb.events || []) {
          const g = byId[ev.id];
          if (g && !g.done) g.line = parseLine(ev.competitions[0]);
        }
      })
      .catch(() => {}));
    for (const g of games) if (g.line === undefined) g.line = null;
  }

  function select(key) {
    if (!LEAGUES[key]) key = 'nfl';
    current = key;
    openFromHash = () => {};
    for (const b of document.querySelectorAll('#leagues button')) b.classList.toggle('active', b.dataset.league === key);
    for (const g of document.querySelectorAll('#leagues .sport')) g.classList.toggle('current', !!g.querySelector('button.active'));

    $('title').textContent = LEAGUES[key].title || `${LEAGUES[key].name} Elo`;
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

  // leagues between seasons are dimmed (they show the season that just ended)
  const month = new Date().getMonth();
  for (const b of document.querySelectorAll('#leagues button')) {
    b.onclick = () => { location.hash = b.dataset.league; };
    const [from, to] = (LEAGUES[b.dataset.league] || {}).months || [0, 11];
    const on = from <= to ? month >= from && month <= to : month >= from || month <= to;
    b.classList.toggle('off', !on);
    if (!on) b.title = 'between seasons: showing the last one';
  }
  window.addEventListener('hashchange', () => {
    const [league] = hashParts();
    if (league === current) openFromHash(true);
    else select(league);
  });
  select(hashParts()[0]);
})();
