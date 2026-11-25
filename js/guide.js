// Welcome guide: a short step-by-step tour of every screen for new users. It opens the matching
// tab, highlights it and explains it in plain words. Offered once after the first-visit notice,
// and always available from the "Guide" button.
(function () {
  const P = window.PP; if (!P) return;
  const { $, store, gotoTab, activeTab } = P;

  // Show the right text on the Data tab: the website updates itself; a downloaded copy doesn't.
  document.body.classList.add(location.protocol === 'file:' ? 'is-local' : 'is-web');

  const tabBtn = t => document.querySelector(`#tabs button[data-tab="${t}"]`);
  const STEPS = [
    { title: 'Welcome to PaperPaisaa 👋', text: 'Practise investing and trading with <b>pretend money on real Indian stock prices</b>, and learn what works before you risk real money.<br><br>Free, no sign-up, and everything you do stays on your device. This tour takes about a minute.', next: 'Start the tour', alt: 'Skip' },
    { el: () => document.querySelector('header .search'), title: '🔍 Find any stock', text: 'Type a company name, like <b>tata</b> or <b>hdfc</b>. Picking a stock opens its chart. Tap the <b>☆</b> next to its name at the top to save it to your watchlist.' },
    { tab: 'chart', title: '📈 Chart', text: 'A full price chart with candles, lines or Heikin Ashi, over 60 indicators (RSI, moving averages, MACD…), drawing lines and full screen. Pinch or scroll to zoom.' },
    { tab: 'watch', title: '⭐ Watchlist', text: 'Your saved stocks in one list: today\'s price and change, 1-year return and where the price sits in its 52-week range. Tap a row to open its chart.' },
    { tab: 'backtest', title: '🧪 Backtest', text: 'Pick a famous strategy and see how it <b>would have done</b> on past prices: profit, worst fall and every trade on the chart.<br><br>Scroll down to the <b>Reality check</b>: it tells you honestly whether the strategy beat simply buying and holding, after charges and tax.' },
    { tab: 'library', title: '📚 Strategies', text: '164 well-known trading strategies, each explained in plain words, from moving-average crossovers to the Turtle Traders. Tap any card to test it.' },
    { tab: 'scanner', title: '🔎 Scanner', text: 'Run one strategy on every stock at once, or every strategy on one stock. See which ones worked best and which signals say "buy" today.' },
    { tab: 'optimizer', title: '🎛️ Optimizer', text: 'Try many settings of a strategy at once and see which worked best in the past. Careful: the "best" settings are often just luck, and the Reality check helps you spot that.' },
    { tab: 'paper', title: '💼 Paper Trading', text: 'A practice account with <b>₹10 lakh of pretend money</b>. Buy and sell at real closing prices and track your holdings and profit, just like a real demat account.' },
    { tab: 'replay', title: '⏪ Bar Replay', text: 'Go back to any date and trade day by day without seeing the future. Great practice for reading charts and making decisions.' },
    { tab: 'challenge', title: '🎢 Crash Challenge', text: 'Could you hold through a crash? Relive Covid 2020, 2008 or a mystery stock with ₹10 lakh, decide when to hold or sell, and see how you\'d really behave.' },
    { tab: 'options', title: '🧮 Options Lab', text: 'See how popular Nifty option strategies would have done since 2008, and why most people who trade options lose money.' },
    { tab: 'data', title: '🗂️ Data', text: 'Where the prices come from: up to 30 years of daily prices for the Nifty 100, updated automatically every weekday evening.' },
    { el: () => guideBtn(), title: 'You\'re all set ✅', text: 'A good first step is the <b>Crash Challenge</b> or a <b>Backtest</b>.<br><br>You can reopen this guide any time with the <b>❓ Guide</b> button. Remember: everything here is practice and learning, not investment advice.', next: 'Done', alt: 'Try the Crash Challenge' },
  ];

  const guideBtn = () => [...document.querySelectorAll('.guide-open')].find(b => b.offsetParent) || $('guideBtn');
  let at = -1, startTab = null, hi = null;
  const visible = s => !s.tab || (tabBtn(s.tab) && !tabBtn(s.tab).hidden);
  function highlight(elm) {
    if (hi) hi.classList.remove('tour-hi'); hi = elm || null;
    if (!hi) return;
    hi.classList.add('tour-hi');
    hi.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  function show(i) {
    at = i; const s = STEPS[i];
    if (s.tab && activeTab() !== s.tab) { gotoTab(s.tab); window.scrollTo({ top: 0 }); }
    highlight(s.tab ? tabBtn(s.tab) : s.el ? s.el() : null);
    const shown = STEPS.filter(visible), pos = shown.indexOf(s);
    $('tourStep').textContent = i === 0 ? '' : `${pos} of ${shown.length - 1}`;
    $('tourTitle').textContent = s.title; $('tourText').innerHTML = s.text;
    $('tourDots').innerHTML = i === 0 ? '' : shown.slice(1).map((x, k) => `<i class="${k + 1 === pos ? 'on' : ''}"></i>`).join('');
    $('tourBack').hidden = i === 0; $('tourNext').textContent = s.next || 'Next';
    $('tourAlt').hidden = !s.alt; $('tourAlt').textContent = s.alt || '';
    $('tourCard').hidden = false; $('tourCard').classList.toggle('tour-intro', i === 0);
    $('tourNext').focus({ preventScroll: true });
  }
  function move(dir) { let i = at + dir; while (i > 0 && i < STEPS.length && !visible(STEPS[i])) i += dir; if (i < 0) return; if (i >= STEPS.length) return end(); show(i); }
  function end(goto) {
    $('tourCard').hidden = true; highlight(null); at = -1; store.set('npt_guide_v1', true); document.querySelectorAll('.guide-open').forEach(b => b.classList.remove('pulse'));
    const t = goto || startTab; if (t && activeTab() !== t) gotoTab(t);
  }
  function open() { startTab = activeTab(); show(0); }

  $('tourNext').onclick = () => move(1);
  $('tourBack').onclick = () => move(-1);
  $('tourX').onclick = () => end();
  $('tourAlt').onclick = () => (at === 0 ? end() : end('challenge'));
  document.querySelectorAll('.guide-open').forEach(b => (b.onclick = open));
  $('footGuide').onclick = e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); open(); };
  document.addEventListener('keydown', e => {
    if ($('tourCard').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'Escape') end(); else if (e.key === 'ArrowRight') move(1); else if (e.key === 'ArrowLeft' && at > 0) move(-1);
  });

  // First visit: offer the tour right after the "Before you start" notice. Returning users just
  // see the Guide button glow once so they notice it.
  window.addEventListener('pp:acked', () => { if (!store.get('npt_guide_v1', false)) setTimeout(open, 250); });
  if (!store.get('npt_guide_v1', false)) {
    if (store.get('npt_ack_v1', false)) { document.querySelectorAll('.guide-open').forEach(b => b.classList.add('pulse')); store.set('npt_guide_v1', true); }   // glow once only
    else if ($('ackModal').hidden) setTimeout(() => { if ($('ackModal').hidden && $('tourCard').hidden) open(); }, 800);   // notice turned off in config
  }
})();
