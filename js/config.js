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
  contactEmail: 'anshumancirm@gmail.com',

  // Your name or business name, shown as the site owner in the Terms page.
  ownerName: 'Anshuman Rai',

  // UPI donations. id example: 'yourname@okhdfcbank'. name = the name shown in the payer's UPI app.
  upi: { id: '7024249992@ibl', name: 'Anshuman Rai' },

  // Broker referral links ("Open a demat account"). Paste your personal referral URL for each.
  // Only brokers with a url are shown. You can add or remove entries.
  brokers: [
    { name: 'Zerodha', url: '' },
    { name: 'Upstox', url: '' },
    { name: 'INDmoney', url: 'Use code ANSHBBLVIND or https://indmoney.onelink.me/RmHC/o8bpguca ' },
    { name: 'Groww', url: 'https://app.groww.in/v3cO/0eh95v0b' },
  ],

  // Show the short "educational use only" notice to first-time visitors.
  showDisclaimerOnFirstVisit: true,
};
