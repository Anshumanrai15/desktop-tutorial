// ════════════════════════════════════════════════════════════════════
//  SITE SETTINGS: edit this file to turn on donations and referral links.
//  On GitHub: open this file → click the ✏️ pencil → edit → "Commit changes".
//  The site republishes itself in about 2 minutes.
//
//  Anything left empty ('') stays hidden on the site.
// ════════════════════════════════════════════════════════════════════
window.NPT_CONFIG = {
  siteName: 'Nifty Paper Trader',

  // Shown on the Terms and Privacy pages so users can reach you.
  // Example: 'support@niftypapertrader.in'
  contactEmail: '',

  // Your name or business name, shown as the site owner in the Terms page.
  ownerName: '',

  // UPI donations. id example: 'yourname@okhdfcbank'. name = the name shown in the payer's UPI app.
  upi: { id: '', name: '' },

  // Broker referral links ("Open a demat account"). Paste your personal referral URL for each.
  // Only brokers with a url are shown. You can add or remove entries.
  brokers: [
    { name: 'Zerodha', url: '' },
    { name: 'Upstox', url: '' },
    { name: 'Angel One', url: '' },
    { name: 'Groww', url: '' },
  ],

  // Show the short "educational use only" notice to first-time visitors.
  showDisclaimerOnFirstVisit: true,
};
