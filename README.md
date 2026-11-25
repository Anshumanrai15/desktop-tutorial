# Nifty Paper Trader

A backtesting and paper-trading app for the Nifty 100 that runs offline in your browser.
It has **164 named strategies**, **64 indicators**, a scanner and leaderboard, a parameter optimizer, a paper-trading account, and a bar-replay trainer.

## Quick start

1. Install Python 3.9+ and run: `pip install yfinance pandas jugaad-data`
2. In this folder run: `python download_data.py`
   - It downloads the **maximum daily history** for every Nifty 100 stock plus the Nifty 50, Nifty 100, Bank Nifty and India VIX indices (typically 1996–2002 → today).
   - Sources: Yahoo Finance (split/dividend adjusted) first, then the NSE website via jugaad-data as a fallback. The live constituent list is fetched from NSE archives.
   - Re-run `python download_data.py --update` each evening to add the new day.
3. Double-click `index.html`, or run `start.bat` / `start.sh`. No server or internet is needed; the chart library is bundled.

Without step 2 the app opens with only the 1-year Nifty 50 / Nifty 100 index files you uploaded.

## Publishing it as a website

The app is a static site (HTML + JS + data files), so any static host works.

**Option A: GitHub Pages, auto-updating (recommended).** Push this folder to a GitHub repository. Then go to *Settings → Pages → Source* and choose **GitHub Actions**. The included workflow (`.github/workflows/publish.yml`) runs every weekday at 18:17 IST. It downloads full history for all Nifty 100 stocks and indices on GitHub's servers and publishes the site at `https://<your-username>.github.io/<repo>/`. You don't need to commit any data files. To publish immediately, use *Actions → Update data and publish site → Run workflow*.

**Option B: one-off upload of your local data.** After running `python download_data.py`, drag the whole folder (including `data/`) onto https://app.netlify.com/drop. Re-upload whenever you refresh the data.

Note: the data comes from Yahoo Finance and NSE. Their terms restrict redistributing their data, so check them before publishing to the public.

## Tabs

- **Backtest**: pick a stock and strategy, tune parameters, costs (STT/charges 0.12% per side by default), slippage, stop-loss, target, ATR trailing stop, max hold and date range. You get a candlestick chart with trade markers, any indicators, an equity curve vs buy & hold, drawdown, 24 metrics, and a trade list with CSV export.
- **Strategies**: a searchable library with each strategy's originator and an explanation.
- **Scanner**: run one strategy on all stocks, all strategies on one stock, or every strategy on every stock (leaderboard). It shows each stock's **signal for the next session**.
- **Optimizer**: a 2-parameter grid search with a heat-map. Use From/To dates for in-sample/out-of-sample checks.
- **Paper Trading**: a ₹10 L virtual account with market, limit and stop orders. Pending orders fill against new bars when you update the data. **Strategy autopilot** trades a strategy's latest signals across all stocks. Data is saved in browser storage.
- **Bar Replay**: step through history one bar at a time without seeing the future, trade manually, and optionally show a strategy's hint.
- **Data**: shows coverage per symbol and lets you import any CSV (NSE, broker, or Kaggle format).

## Backtest rules (to avoid look-ahead)
Signals are computed on the **close** of bar *t* and filled at the **open** of bar *t+1*. Stops and targets are checked intrabar against the high and low, with gap-through fills at the open. The default is long-only because overnight shorting isn't allowed in the Indian cash market. Quantities are whole shares.

## Caveats
- Yahoo data is adjusted for splits and dividends; NSE fallback data is not.
- The universe is today's Nifty 100, so long backtests carry **survivorship bias** (stocks that dropped out of the index aren't included).
- Some "famous trader" systems are technical approximations of discretionary methods (e.g. CAN SLIM, Jhunjhunwala, Lynch). The descriptions say so.
- This is for education and paper trading only, not investment advice.

## Strategies (164)

### Trend

1. **Golden Cross / Death Cross (50/200 SMA)** (Classic (popularised by Dow theorists, used by many funds)): Go long when the 50-day SMA crosses above the 200-day SMA (golden cross); exit/short when it crosses below (death cross). Slow, low-turnover filter that keeps you in big bull trends and out of most bear markets.
2. **EMA 9/21 Crossover** (Popular swing-trader setup): Long when the 9 EMA crosses above the 21 EMA, short when it crosses below. Faster than SMA crossovers, catches swing moves but whipsaws in ranges.
3. **Seykota Exponential MA Crossover** (Ed Seykota (Market Wizards)): Ed Seykota's textbook trend system: long while a fast EMA (15) is above a slow EMA (150), short when below. "The trend is your friend except at the end where it bends."
4. **Triple Moving Average (4-9-18)** (R.C. Allen): R.C. Allen's 4-9-18 day method: long only when 4 > 9 > 18 SMA are stacked bullishly, short when stacked bearishly, otherwise flat.
5. **Faber 10-Month SMA Timing (200-day)** (Mebane Faber, "A Quantitative Approach to Tactical Asset Allocation"): Hold the asset when price closes above its 10-month (~200-day) SMA, move to cash when below. Famous for cutting drawdowns roughly in half vs buy-and-hold.
6. **Price vs 50 SMA** (Classic): Long while the close is above the 50-day SMA, short below it. Simple medium-term trend filter.
7. **MACD Signal Line Crossover** (Gerald Appel): Gerald Appel's MACD (12,26,9): long when the MACD line crosses above its signal line, short when it crosses below.
8. **MACD Zero-Line Cross** (Gerald Appel): Long when the MACD line is above zero (12 EMA above 26 EMA), short below. Slower and fewer whipsaws than the signal-line version.
9. **Supertrend (10,3)** (Olivier Seban): ATR-based trailing band. Long when price closes above the Supertrend line, short when it flips below. Extremely popular among Indian traders on Nifty/BankNifty.
10. **Parabolic SAR Stop-and-Reverse** (J. Welles Wilder Jr.): Wilder's Parabolic Stop And Reverse: always in the market, long when price is above the SAR dots, short when below. The stop accelerates as the trend extends.
11. **ADX + DMI Trend** (J. Welles Wilder Jr.): Wilder's Directional Movement System: trade only when ADX > 25 (trend is strong). Long when +DI > -DI, short when -DI > +DI. Flat when ADX is weak.
12. **Ichimoku Kinko Hyo Cloud Breakout** (Goichi Hosoda): Long when price is above the cloud, Tenkan > Kijun, and the cloud is bullish (Span A > Span B); short on the mirror condition; exit when price re-enters the cloud.
13. **Ichimoku Tenkan/Kijun Cross** (Goichi Hosoda): Long when Tenkan-sen crosses above Kijun-sen while price is above the cloud; exit on the reverse cross.
14. **Williams Alligator** (Bill Williams, "Trading Chaos"): Long when Lips > Teeth > Jaw (the alligator "eats" upward), short when Lips < Teeth < Jaw, flat when the lines are tangled (alligator sleeping).
15. **Hull MA Slope** (Alan Hull): Long when the Hull Moving Average is rising, short when falling. HMA is designed to be smooth yet nearly lag-free.
16. **KAMA Adaptive Trend** (Perry Kaufman, "Trading Systems and Methods"): Kaufman's Adaptive Moving Average speeds up in trends and flattens in noise. Long when close > KAMA and KAMA rising; exit when close < KAMA.
17. **TEMA 10/30 Crossover** (Patrick Mulloy): Triple-EMA crossover (Mulloy, 1994) – less lag than plain EMAs.
18. **DEMA 20/50 Crossover** (Patrick Mulloy): Double-EMA crossover: long when DEMA20 > DEMA50.
19. **Guppy Multiple Moving Average** (Daryl Guppy): Two ribbons of EMAs: traders (3,5,8,10,12,15) and investors (30,35,40,45,50,60). Long when every short EMA is above every long EMA; short on the reverse; else flat.
20. **Aroon Up/Down Cross** (Tushar Chande): Long when Aroon Up > 70 and above Aroon Down, short when Aroon Down > 70 and above Aroon Up.
21. **Vortex Indicator Cross** (Etienne Botes & Douglas Siepman): Long when VI+ crosses above VI-, short when VI- crosses above VI+.
22. **TRIX Signal Cross** (Jack Hutson): Long when TRIX (triple-smoothed EMA rate of change) crosses above its 9-period signal, short on the cross below.
23. **Know Sure Thing (KST)** (Martin Pring): Martin Pring's weighted multi-timeframe ROC. Long when KST is above its signal line, short when below.
24. **Schaff Trend Cycle** (Doug Schaff): Long when STC rises above 25, exit when it falls below 75. Faster MACD with stochastic smoothing.
25. **Linear Regression Slope** (Quant classic): Long when the 50-day linear-regression slope is positive, short when negative.
26. **Heikin-Ashi Trend** (Munehisa Homma (Japanese technique)): Long after 2 consecutive bullish Heikin-Ashi candles with no lower wick; exit after 2 bearish HA candles.
27. **Dow Theory Higher-Highs/Higher-Lows** (Charles Dow / William Hamilton): Uptrend = a 20-day high made while the last 20-day low is above the previous one. Long on confirmed higher-high + higher-low structure, exit on a lower low.
28. **Elder Impulse System** (Dr. Alexander Elder, "Come Into My Trading Room"): Green bar = 13 EMA rising AND MACD histogram rising; red bar = both falling. Long on green, short on red, flat (blue) otherwise.
29. **Weinstein Stage 2 (30-week MA)** (Stan Weinstein, "Secrets for Profiting in Bull and Bear Markets"): Buy the breakout into Stage 2: price above a rising 150-day (30-week) SMA with volume above average. Exit when price closes below the 150-day SMA (Stage 3/4).
30. **Minervini Trend Template** (Mark Minervini, "Trade Like a Stock Market Wizard"): Long only when: price > 50 > 150 > 200 SMA, 200 SMA rising for 1 month, price ≥ 30% above 52-week low and within 25% of 52-week high. Exit when price closes below the 50-day SMA.
31. **Multi-Timeframe Trend Alignment** (Common institutional filter): Long when close > 20 EMA > 50 EMA > 200 EMA (short, medium and long trends aligned). Exit when close < 20 EMA.
32. **Zero-Lag EMA Trend** (John Ehlers & Ric Way): Long when close is above the 20-period zero-lag EMA, short when below.
33. **VWMA vs SMA (Volume Confirmation)** (Buff Dormeier): Long when the 20-day volume-weighted MA is above the 20-day SMA (volume is confirming up moves), short when below.

### Breakout

34. **Turtle Trading System 1 (20/10 Donchian)** (Richard Dennis & William Eckhardt (The Turtles)): The original Turtle System 1: buy a breakout to a new 20-day high, exit on a 10-day low. Mirror for shorts. Pair with a 2-ATR stop in the settings for the full rules.
35. **Turtle Trading System 2 (55/20 Donchian)** (Richard Dennis & William Eckhardt (The Turtles)): Turtle System 2: enter on a 55-day breakout, exit on a 20-day opposite breakout. Catches only the biggest trends.
36. **Donchian 4-Week Rule** (Richard Donchian ("father of trend following")): Donchian's 4-week rule: always in the market – long when price exceeds the prior 4-week (20-day) high, short when it breaks the prior 4-week low.
37. **Darvas Box Breakout** (Nicolas Darvas, "How I Made $2,000,000 in the Stock Market"): Price consolidates in a "box" (new 52-week-high region, then a range). Buy when price breaks above the box top on above-average volume; stop at the box bottom.
38. **Livermore Pivotal Point Breakout** (Jesse Livermore, "How to Trade in Stocks"): Livermore bought only when a stock broke out to new high ground through a "pivotal point" with strong volume, and cut losses quickly. Buy a 60-day high with volume > 1.5× average; exit on a 20-day low.
39. **52-Week High Momentum** (George & Hwang (2004), used by O'Neil & Minervini): Stocks at 52-week highs tend to keep rising (anchoring bias). Buy a close at a new 52-week high; exit when price falls 15% from the 52-week high or below the 100 SMA.
40. **CAN SLIM Style Base Breakout** (William J. O'Neil (IBD), "How to Make Money in Stocks"): Technical side of CAN SLIM: buy when price breaks to a new 50-day high from within 15% of its 52-week high on volume ≥ 1.5× average, in a market uptrend (above 200 SMA). Sell on a 7–8% loss or close under the 50-day line.
41. **Bollinger Band Breakout** (John Bollinger): Long when price closes above the upper Bollinger Band (momentum breakout), exit when it closes back below the middle band. Mirror for shorts.
42. **Keltner Channel Breakout** (Chester Keltner (1960), Linda Raschke variant): Long when close > upper Keltner Channel (EMA20 + 2 ATR), exit at the EMA20. Mirror for shorts.
43. **TTM Squeeze Breakout** (John Carter, "Mastering the Trade"): Volatility "squeeze": Bollinger Bands inside Keltner Channels. When the squeeze fires (BB expands outside KC), trade in the direction of momentum (close vs 20 SMA). Exit when momentum fades.
44. **NR7 Breakout** (Toby Crabel, "Day Trading with Short Term Price Patterns"): NR7 = the narrowest daily range of the last 7 days (volatility contraction). Buy a break above the NR7 bar's high on the next bar, hold 5 days.
45. **NR4 + Inside Bar Breakout** (Toby Crabel): An inside bar that is also the narrowest range of 4 days (NR4/ID). Buy a close above its high, hold 3 days.
46. **Inside Bar Breakout** (Price-action classic (Al Brooks, Nial Fuller)): After an inside bar (range inside the previous bar) in an uptrend (above 50 EMA), buy a close above the mother bar's high; exit on a close below the mother bar's low or after 10 bars.
47. **Larry Williams Volatility Breakout** (Larry Williams (1987 World Cup Championship, +11,376%)): Buy when today's close exceeds today's open + 0.6 × yesterday's range (a daily-bar approximation of his intraday breakout). Exit at the next profitable close or after 3 days.
48. **Gap-and-Go (Breakaway Gap)** (Classic momentum day-trader setup): Buy when the stock gaps up > 2% above yesterday's high and closes near its high (top 25% of the range). Hold 5 days.
49. **Pocket Pivot** (Gil Morales & Chris Kacher (O'Neil associates)): Up-day volume greater than the highest down-day volume of the prior 10 days, with price above the 10 and 50 SMA. Early-entry signal within a base. Exit below the 50 SMA.
50. **Volatility Contraction Pattern (VCP)** (Mark Minervini): Approximation of Minervini's VCP: in an uptrend (above 150 SMA), 10-day ATR has contracted to < 60% of the 50-day ATR, then price breaks a 20-day high. Exit below the 50 SMA.
51. **Cup & Handle Breakout (approx.)** (William J. O'Neil): Approximation: price recovered to within 5% of a 6-month high after a 12–35% correction (the cup), had a shallow 5–15% pullback over 5–20 days (the handle), then breaks the handle high on volume. Exit 8% stop or 50 SMA.
52. **ATR Channel Breakout** (Trend-following CTA style (Chesapeake Capital)): Long when close > 50-day SMA + 2 ATR(20); exit when close < 50 SMA. Mirror for shorts.
53. **Fractal Breakout** (Bill Williams): Buy when price closes above the most recent up-fractal (confirmed 5-bar swing high) while above the Alligator teeth; exit below the latest down-fractal.
54. **Floor Pivot R1 Breakout** (Floor traders (classic pivot points)): Long when close breaks above yesterday's R1 pivot, exit when it falls back below the pivot P. Mirror below S1.
55. **Wide-Range Bar Breakout** (Toby Crabel / Linda Raschke): Range expansion: today's range > 2× the 20-day average range and close in the top 20% → buy, hold 5 days.

### Mean Reversion

56. **RSI 30/70 Reversal** (J. Welles Wilder Jr. (1978)): Classic RSI: buy when RSI(14) crosses up through 30 (leaving oversold), sell when it crosses down through 70.
57. **Connors RSI(2) Pullback** (Larry Connors, "Short Term Trading Strategies That Work"): In a long-term uptrend (close > 200 SMA), buy when 2-period RSI drops below 10. Exit when close rises above the 5-day SMA. One of the most-tested mean-reversion edges.
58. **Cumulative RSI(2)** (Larry Connors & Cesar Alvarez): Sum of the last 2 days' RSI(2) below 35 while above the 200 SMA → buy; exit when RSI(2) > 65.
59. **Connors RSI (CRSI) Strategy** (Connors Research): Buy when the composite Connors RSI (RSI3 + streak RSI + ROC percentile) falls below 10 above the 200 SMA; exit when CRSI > 70.
60. **Double 7's** (Larry Connors): Above the 200 SMA, buy at a 7-day closing low; sell at a 7-day closing high.
61. **3-Day High/Low Method** (Larry Connors): Above the 200 SMA and below the 5 SMA, buy after 3 consecutive lower highs AND lower lows; exit when close > 5 SMA.
62. **R3 Strategy** (Larry Connors): Above the 200 SMA, RSI(2) drops 3 days in a row with the first drop starting below 60 and today below 10 → buy. Exit when RSI(2) > 70.
63. **%b Strategy** (Larry Connors / John Bollinger): Above the 200 SMA, buy after 3 consecutive closes with Bollinger %b < 0.2; exit when %b > 0.8.
64. **Bollinger Band Mean Reversion** (John Bollinger): Buy a close below the lower band, sell at the middle band. Short above the upper band, cover at the middle.
65. **Double Bollinger Bands** (Kathy Lien): Two sets of bands (1σ and 2σ). Buy when price closes above the +1σ band, entering the +1σ to +2σ "buy zone"; exit when it falls back below the 20 SMA.
66. **RSI(14) 40-Pullback in Uptrend** (Andrew Cardwell (RSI range rules)): Cardwell: in bull markets RSI holds 40–80. Above the 200 SMA, buy when RSI(14) dips under 40; exit when RSI > 70.
67. **Stochastic Oversold Cross** (George Lane): Buy when %K crosses above %D below 20; sell when %K crosses below %D above 80.
68. **Stochastic RSI Reversal** (Tushar Chande & Stanley Kroll): Buy when StochRSI %K crosses above 20, sell when it crosses below 80.
69. **Williams %R Oversold** (Larry Williams): Buy when %R(14) crosses up through -80; sell when it crosses down through -20.
70. **CCI ±100 Reversal** (Donald Lambert): Buy when CCI(20) crosses back above -100; exit when CCI crosses below +100.
71. **Money Flow Index 20/80** (Gene Quong & Avrum Soudack): Volume-weighted RSI. Buy when MFI crosses above 20, sell when it crosses below 80.
72. **Z-Score Mean Reversion** (Statistical arbitrage desks): Buy when the 20-day z-score of price is below -2, exit when it returns above 0. Short at +2.
73. **Internal Bar Strength (IBS)** (Quantitative research (Pagonidis 2014)): IBS = (C−L)/(H−L). Buy when IBS < 0.2 (closed near the low), exit when IBS > 0.8.
74. **Raschke 80-20** (Linda Bradford Raschke, "Street Smarts"): Yesterday opened in the top 20% of its range and closed in the bottom 20%. Buy today if price trades back above yesterday's low after taking it out. Hold 2–4 days.
75. **Turtle Soup** (Linda Raschke & Larry Connors, "Street Smarts"): Fades failed Turtle breakouts: price makes a new 20-day low (the prior 20-day low was ≥4 days old) but closes back above that prior low → buy, hold 5 days.
76. **Larry Williams "Oops!"** (Larry Williams): Today opens with a gap below yesterday's low, then rallies to close above yesterday's low (trapped sellers) → buy, hold 3 days.
77. **Holy Grail (ADX Pullback)** (Linda Raschke): When ADX(14) > 30 and +DI > -DI (strong uptrend), buy the first pullback to the 20 EMA; exit at the recent 20-day high or if close < 20 EMA − 1 ATR.
78. **The "Anti" Setup** (Linda Raschke): Stochastic (7,10) %D trending up while %K pulls back then hooks up → buy in direction of the slow trend. Exit after 4 days.
79. **Keltner Channel Fade** (Chester Keltner): Buy closes below the lower Keltner Channel (EMA20 − 2 ATR), exit at the EMA.
80. **Consecutive Down Days** (Quant classic): Above the 200 SMA, buy after 4 consecutive down closes; exit on the first up close.
81. **Gap Down Fade** (Market-maker / floor trader setup): Buy a gap down of more than 2% when the stock is above its 200 SMA; sell at the close of the next day.
82. **Fibonacci 61.8% Retracement** (Leonardo Fibonacci / Elliott wave traders): In an uptrend (above 200 SMA), buy when price retraces to the 50–61.8% zone of the last 60-day swing (low→high) and closes up; exit at the swing high or below the 78.6% level.
83. **DPO Cycle Reversal** (Detrended Price Oscillator (cycle analysts)): Buy when DPO(20) crosses up from below its −1 stdev level; exit when DPO > 0.
84. **Ehlers Fisher Transform Reversal** (John Ehlers): Buy when the Fisher Transform crosses up from below −1.5; sell when it crosses down from above +1.5.
85. **VWAP Reversion** (Institutional execution traders): Buy when price is 1.5 ATR below the 20-day rolling VWAP; exit at VWAP.
86. **Chande Momentum Oscillator ±50** (Tushar Chande): Buy when CMO(14) crosses up through −50, sell when it crosses down through +50.
87. **Ultimate Oscillator Bullish Setup** (Larry Williams): Buy when the Ultimate Oscillator crosses above 30 after being oversold; sell above 70.
88. **RSI Bullish Divergence** (Wilder / Constance Brown): Price makes a lower 20-day low while RSI(14) makes a higher low and RSI < 40 → buy. Exit when RSI > 65.
89. **MACD Bullish Divergence** (Gerald Appel / Thomas Aspray): Price at a 30-day low but MACD histogram higher than at the previous low → buy. Exit when MACD crosses below signal.

### Momentum

90. **RSI 50 Momentum** (Momentum traders): Long while RSI(14) > 55, short while < 45, hold previous state in between.
91. **Rate of Change Momentum (12-1)** (Jegadeesh & Titman (1993) momentum anomaly): Long when the 12-month return (skipping the last month) is positive and above 10%; flat otherwise. Rebalanced monthly.
92. **Absolute Momentum (Dual Momentum leg)** (Gary Antonacci, "Dual Momentum Investing"): Antonacci's absolute-momentum rule: hold when the 12-month return beats the risk-free rate (~6.5%/yr in India), else cash. Monthly check.
93. **Awesome Oscillator Zero Cross** (Bill Williams): Long when AO crosses above zero, short when below.
94. **Awesome Oscillator Saucer** (Bill Williams): AO above zero, two red bars (falling) followed by a green bar → buy. Exit on AO cross below zero.
95. **CCI +100 Trend (Woodie's CCI)** (Ken Wood (Woodie's CCI Club)): Long when CCI(14) crosses above +100, exit when it drops below 0. Short below −100, cover above 0.
96. **MACD Histogram Reversal** (Thomas Aspray): Long when the MACD histogram turns up from below zero, exit when it turns down above zero.
97. **PPO Signal Cross** (Percentage Price Oscillator): Long when PPO is above its 9-EMA signal and above zero; flat otherwise.
98. **True Strength Index Cross** (William Blau): Long when TSI crosses above its 7-EMA signal, exit when it crosses below.
99. **Relative Vigor Index Cross** (John Ehlers): Long when RVI crosses above its signal line, short when below.
100. **Coppock Curve Buy Signal** (Edwin Coppock (Barron's, 1962)): Designed for long-term bottoms: buy when the Coppock Curve turns up from below zero; exit when it turns down from above zero.
101. **Elder-Ray Bull/Bear Power** (Dr. Alexander Elder): 13 EMA rising, Bear Power negative but rising → buy. Exit when Bull Power falls below zero.
102. **Elder Triple Screen** (Dr. Alexander Elder, "Trading for a Living"): Screen 1 (tide): weekly trend = 26-week EMA (130-day) rising. Screen 2 (wave): daily Force Index(2) turns negative = pullback. Screen 3: buy. Exit when Force Index(13) turns negative and tide turns down.
103. **Force Index Trend** (Dr. Alexander Elder): Long when the 13-period Force Index is above zero, short when below.
104. **Momentum (10) Zero Cross** (Classic): Long when the 10-day price momentum crosses above zero, short below.
105. **Stochastic Pop** (Jake Bernstein / David Steckler): Buy when %K pops above 80 (strong momentum) with ADX > 20; exit when %K falls below 50.
106. **Mass Index Reversal Bulge** (Donald Dorsey): Reversal bulge: Mass Index rises above 27 then falls below 26.5 → trade in the direction of the 9 EMA slope. Hold 10 days.
107. **KST Above Zero** (Martin Pring): Long while KST is above both zero and its signal line; flat otherwise.
108. **Relative Strength vs Market (self-normalised)** (O'Neil RS Rating idea): Long when the 6-month ROC is in the top 30% of its own 3-year range (proxy for strong relative strength); exit below 50%.

### Volume

109. **OBV Trend Confirmation** (Joseph Granville): Granville: "volume precedes price". Long when OBV is above its 20-EMA and price is above its 20-EMA; exit when either fails.
110. **OBV Breakout Leads Price** (Joseph Granville): Buy when OBV makes a new 50-day high before price does (price still below its 50-day high). Exit when OBV falls below its 50-EMA.
111. **Chaikin Money Flow** (Marc Chaikin): Long when CMF(20) > +0.05 (accumulation), exit when < −0.05 (distribution).
112. **Chaikin Oscillator Cross** (Marc Chaikin): Long when the Chaikin Oscillator crosses above zero with price above the 50 SMA; exit on the cross below zero.
113. **Accumulation/Distribution Trend** (Marc Chaikin): Long when the A/D line is above its 50-day average, flat otherwise.
114. **Klinger Volume Oscillator** (Stephen Klinger): Long when the KVO crosses above its 13-EMA signal and price is above the 100 SMA; exit on the cross below.
115. **Ease of Movement** (Richard W. Arms Jr.): Long when the 14-day EMV crosses above zero, exit below zero.
116. **Volume Spike Breakout** (Tape readers / Richard Wyckoff): Up day on volume > 2.5× its 50-day average that closes in the top third of the range → buy. Exit after 10 days or on a close below the spike bar's low.
117. **Wyckoff Spring** (Richard D. Wyckoff): Price undercuts a 40-day trading-range low on higher volume, then closes back inside the range → buy (spring). Exit at the range top or on a new low.
118. **Volume-Price Trend** (Classic): VPT = cumulative volume × % change. Long when VPT is above its 20-EMA, short below.
119. **Rolling VWAP Trend** (Institutional benchmark): Long while price is above the 50-day rolling VWAP, flat below.

### Volatility

120. **ATR Trailing Stop Trend** (J. Welles Wilder Jr. (Volatility System)): Wilder's Volatility System: stop-and-reverse with a trailing stop 3 × ATR(7) from the extreme close.
121. **Chandelier Exit Trend** (Chuck LeBeau): Long when close > 22-day high − 3 ATR (chandelier long stop) and above the 50 EMA; exit on a close below the chandelier.
122. **Bollinger Squeeze** (John Bollinger, "Bollinger on Bollinger Bands"): When Bandwidth hits a 6-month low (the "squeeze"), trade the subsequent breakout of the bands. Exit at the middle band.
123. **Low Volatility Regime** (Low-volatility anomaly (Haugen & Baker)): Hold the stock only when its 20-day historical volatility is below its 1-year median and price is above the 100 SMA.
124. **Volatility Spike Buy** (Contrarian "buy when there's blood in the streets" – Baron Rothschild): Buy when 10-day historical volatility is > 2× its 1-year average (panic) and price is down > 10% from its 20-day high; hold 20 days.
125. **Choppiness-Filtered EMA Trend** (E.W. Dreiss): Trade the 20/50 EMA cross only when the Choppiness Index < 50 (trending market); flat when choppy.
126. **Efficiency Ratio Trend** (Perry Kaufman): Long when the 20-day efficiency ratio > 0.3 and price rose over the period; flat otherwise.
127. **Ulcer Index Risk Filter** (Peter Martin): Hold above the 50 SMA only while the Ulcer Index (drawdown pain) is below 5; cash otherwise.

### Candlestick

128. **Bullish Engulfing** (Steve Nison, "Japanese Candlestick Charting Techniques"): Bullish candle whose body engulfs the prior bearish body, after a 5-day decline → buy, hold 5 days.
129. **Hammer Reversal** (Steve Nison): Lower wick ≥ 2× body, small upper wick, at a 10-day low → buy, hold 5 days.
130. **Morning Star** (Steve Nison): Three-bar reversal: long bearish candle, small-bodied star, then a bullish candle closing above the midpoint of the first → buy, hold 7 days.
131. **Three White Soldiers** (Japanese candlestick (Munehisa Homma)): Three consecutive long bullish candles each closing higher near its high → buy, hold 10 days.
132. **Piercing Line** (Steve Nison): After a bearish candle, price opens below its low and closes above its midpoint → buy, hold 5 days.
133. **Pin Bar at Support** (Price action (Martin Pring / Nial Fuller)): Bullish pin bar (lower wick > 66% of range) touching the 50 EMA in an uptrend → buy, hold 7 days.
134. **Dragonfly Doji Reversal** (Japanese candlestick): Doji (body < 10% of range) with a long lower shadow at a 20-day low → buy on next bar, hold 5 days.
135. **Bullish Harami** (Steve Nison): Small bullish candle contained within a large prior bearish body, at a 10-day low → buy, hold 5 days.
136. **Key Outside Reversal Day** (Classic chartist (Edwards & Magee)): Today makes a lower low than yesterday but closes above yesterday's high → buy, hold 5 days.
137. **Tweezer Bottom** (Japanese candlestick): Two consecutive bars with near-identical lows (within 0.2%) at a 20-day low, second bar bullish → buy, hold 5 days.
138. **Bullish Marubozu Momentum** (Japanese candlestick): Full-bodied bullish candle (body > 90% of range, range > 1.5 ATR) → buy, hold 5 days.
139. **2-Bar Higher-Low Pullback** (Al Brooks price-action ("H2")): In an uptrend (20 EMA > 50 EMA), the second attempt to resume the trend after a pullback (H2: high breaks prior high twice) → buy, hold 5 days.

### Seasonal

140. **Turn-of-the-Month Effect** (Ariel (1987), Lakonishok & Smidt): Hold the stock from the last 2 trading days of the month to the 3rd trading day of the next month (salary/fund inflows). Cash otherwise.
141. **Turnaround Tuesday** (Larry Connors / Toby Crabel): If Monday closes down (and below Friday by > 1%), buy at the Tuesday open; exit at the Tuesday close (hold 1 bar).
142. **Sell in May (Halloween Indicator)** (Bouman & Jacobsen (2002)): Hold from 1 November to 30 April; stay in cash May–October.
143. **Week-Start Weakness Buy** (Weekend effect (French 1980)): Buy at the close of a down Friday, sell after Monday/next session.
144. **Diwali-to-Budget Seasonal (India)** (Indian market folklore (Muhurat → Union Budget rally)): Long from 15 October to 31 January each year (festive season through Budget), cash otherwise.
145. **Monthly Momentum Rebalance** (Classic monthly time-series momentum (Moskowitz, Ooi, Pedersen)): At each month-end, hold next month if the past 3-month return is positive, else cash.

### Benchmark

146. **Buy & Hold (Benchmark)** (Warren Buffett / Jack Bogle philosophy): Buy on the first day and never sell. Every other strategy should be compared with this.

### Famous Systems

147. **Gann HiLo Activator** (W.D. Gann (Robert Krausz version)): Long when close > 3-bar SMA of highs (shifted), short when close < 3-bar SMA of lows.
148. **Gann Swing Chart (3-day)** (W.D. Gann): Gann 3-day swing: trend turns up after 3 consecutive higher highs; turns down after 3 consecutive lower lows.
149. **Paul Tudor Jones 200-Day Rule** (Paul Tudor Jones): "My metric for everything I look at is the 200-day moving average." Long above it; exit below it with a 2% buffer to reduce whipsaws.
150. **Druckenmiller Momentum + Trend** (Stanley Druckenmiller style): Go with strong trends with conviction: long when 6-month ROC > 20% and price > 50 SMA > 200 SMA; exit when ROC < 0 or price < 200 SMA.
151. **Jhunjhunwala Long-Term Trend Investor** (Rakesh Jhunjhunwala style (approximation)): Long-term conviction holding: buy when price is above its 200-day SMA after a 20%+ correction from its 1-year high (buying quality on dips), exit only on a close 25% below the entry-time 1-year high.
152. **Peter Lynch "Tenbagger" Trend Hold** (Peter Lynch style (technical approximation)): Buy after a 6-month base breakout (new 126-day high) and hold for the long term – exit only when price closes below the 200-day SMA ("let your winners run").
153. **Raschke First Cross (3-10 Oscillator)** (Linda Raschke): Raschke's 3/10 oscillator (3 SMA − 10 SMA with a 16 SMA signal): buy the first cross of the fast line above the slow line after a pullback in a trend (price > 50 EMA).
154. **Larry Williams %R + Trend** (Larry Williams, "Long-Term Secrets to Short-Term Trading"): Buy when %R(10) < −90 while the 100 SMA is rising; exit when %R > −20.
155. **Turtle with 2N Stop** (Richard Dennis (Turtle money-management)): 20-day breakout entry, exit on either a 10-day low or a 2N (2 × ATR20) stop from entry – the full Turtle risk rule.
156. **O'Neil Follow-Through Day** (William J. O'Neil): After a 10%+ correction, a day 4+ days after the low that rises > 1.5% on higher volume confirms a new uptrend → buy. Exit on close below the 50 SMA.
157. **Bollinger-Trend Hybrid (BB + 200)** (John Bollinger's "Method I"): Bollinger's Method I: after a squeeze, go with the band break, but only in the direction of the 200 SMA trend. Exit on the parabolic SAR flip.
158. **Van Tharp Random Entry + Trailing Stop** (Van K. Tharp, "Trade Your Way to Financial Freedom"): Tharp's famous experiment: enter on a coin flip (seeded, deterministic) and use a 3 × ATR trailing stop. Shows that exits and position sizing matter more than entries.
159. **EMA Ribbon Pullback (8/21/55)** (Fibonacci EMA traders): Uptrend when 8 > 21 > 55 EMA. Buy when price pulls back to touch the 21 EMA and closes above it; exit when 8 EMA < 21 EMA.
160. **RSI + MACD Confluence** (Retail favourite): Long when MACD crosses above its signal while RSI(14) is between 40 and 60 (room to run); exit when RSI > 75 or MACD crosses down.
161. **Supertrend + 200 EMA Filter** (Indian intraday/swing community favourite): Long when Supertrend(10,3) is bullish AND price is above the 200 EMA. Exit on Supertrend flip.
162. **Bollinger + RSI Reversal** (Swing-trading classic): Buy when price closes below the lower Bollinger Band AND RSI(14) < 30; exit at the upper band or RSI > 70.
163. **ADX Trend + EMA Pullback** (Wilder / Raschke hybrid): ADX > 25 and price above 50 EMA: buy when RSI(3) dips below 20; exit when RSI(3) > 80.
164. **Stage-2 52-Week Breakout + Volume** (Weinstein + O'Neil hybrid): Buy a new 52-week closing high on 2× average volume while above a rising 200 SMA; trailing exit at the 10-week (50-day) low.

## Indicators (64)

Simple Moving Average (SMA) · Exponential Moving Average (EMA) · Weighted Moving Average (WMA) · Hull Moving Average (HMA) · Double EMA (DEMA) · Triple EMA (TEMA) · Zero-Lag EMA · Kaufman Adaptive MA (KAMA) · Volume Weighted MA (VWMA) · Rolling VWAP · Bollinger Bands · Keltner Channels · Donchian Channels · Moving Average Envelopes · Supertrend · Parabolic SAR · Ichimoku Cloud · Williams Alligator · Chandelier Exit · Linear Regression Line · Pivot Points (Classic) · Relative Strength Index (RSI) · MACD · Stochastic Oscillator · Stochastic RSI · Commodity Channel Index (CCI) · Williams %R · ADX / DMI · Average True Range (ATR) · On-Balance Volume (OBV) · Accumulation/Distribution Line · Chaikin Oscillator · Chaikin Money Flow (CMF) · Money Flow Index (MFI) · Rate of Change (ROC) · Momentum · TRIX · Aroon · Awesome Oscillator · Ultimate Oscillator · Vortex Indicator · Elder Force Index · Elder Ray (Bull/Bear Power) · Know Sure Thing (KST) · Coppock Curve · Detrended Price Oscillator · Percentage Price Oscillator · Chande Momentum Oscillator · Ehlers Fisher Transform · Schaff Trend Cycle · Choppiness Index · Ease of Movement · Mass Index · Ulcer Index · Historical Volatility (annualised %) · Z-Score · True Strength Index · Relative Vigor Index · Klinger Volume Oscillator · Connors RSI · Bollinger Bandwidth · Bollinger %B · Kaufman Efficiency Ratio · Linear Regression Slope
