// ============================================
// src/utils/dm-templates.ts
// ALL DM MESSAGE TEMPLATES
// ============================================

export const dmTemplates = {
  // ============================================
  // DM #1: Wallet Credentials (Immediate)
  // ============================================
  walletCredentials: (
    username: string,
    wallet: any,
    password: string,
    encryptedKey: string,
    count: number
  ) => `🎉 Welcome to Spredd Markets, @${username}!

Your Hedera wallet has been created successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 YOUR WALLET DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account Alias (use this to receive):
${wallet.account_alias}

Public Key:
${wallet.public_key}

🔐 ENCRYPTED PRIVATE KEY:
${encryptedKey}

🔓 DECRYPTION PASSWORD:
${password}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL - DO THIS NOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Screenshot this OR copy to password manager
2. NEVER share your private key with anyone
3. Delete this DM after saving (security!)
4. Test with small amounts first

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check your DMs in 5 minutes!
We'll send you:
✅ HashPack setup guide
✅ How to get USDC
✅ Security tips

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're user #${count}! 🎯
Early users get BONUS rewards! 🎁

Questions? Reply anytime! 🚀`,

  // ============================================
  // DM #2: Setup Guide (5 minutes later)
  // ============================================
  setupGuide: (username: string) => `👋 Hey @${username}!

Now that you have your wallet, here's your complete setup guide:

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 STEP 1: DOWNLOAD HASHPACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Chrome: chrome.google.com/webstore
→ Search "HashPack"

📱 Mobile:
iOS: App Store → "HashPack Wallet"
Android: Play Store → "HashPack"

Takes 1 minute ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 STEP 2: IMPORT YOUR WALLET
━━━━━━━━━━━━━━━━━━━━━━━━━━━

In HashPack:
1. Click "Import Existing Wallet"
2. Select "Import by Private Key"
3. Paste your private key from previous DM
4. Set strong password
5. Done! ✅

⚠️ Don't click "Create New" - you already have one!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 STEP 3: REKEY ACCOUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
We don't save your Private Key, but we recommend you rekey your account

In HashPack:
1. Click Settings
2. Click "Advanced Tools"
3. Click "Rekey Account"
4. Follow the prompts

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 STEP 4: GET USDC
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 METHOD A: Buy on Exchange

Best options:
• Binance: binance.com
• Crypto.com: crypto.com
• Gate.io: gate.io

How to withdraw:
1. Buy USDC
2. Go to "Withdraw"
3. Select "USDC"
4. ⚠️ Choose "HEDERA" network
5. Paste your Account Alias
6. Confirm!

Arrives in 3-5 seconds ⚡

💱 METHOD B: Swap on DEX

1. Visit: saucerswap.finance
2. Connect HashPack
3. Swap HBAR → USDC
4. Fee: ~$0.001!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SECURITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO:
✅ Save key in password manager
✅ Use strong password
✅ Test with small amounts
✅ Double-check addresses

DON'T:
❌ Share private key
❌ Store in phone notes
❌ Click suspicious links
❌ Trust "support" DMs

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 RESOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Discord: discord.gg/fPSubt3TE7

Need help? Reply here! 💪`,

  // ============================================
  // DM #3: Pre-Launch Reminder (7 days before)
  // ============================================
  preLaunchReminder: (username: string, launchDate: string) => `🚨 LAUNCH ALERT: @${username}

Spredd Markets launches in 7 DAYS! 🚀
Launch Date: ${launchDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PRE-LAUNCH CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Are you ready? Check these off:

☐ Imported wallet to HashPack?
☐ Got USDC in your wallet?
☐ Joined our Discord?
☐ Following @spreddterminal?

Reply "help" if you need guidance!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 QUICK SETUP (if not done)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Download HashPack: hashpack.app
2. Import with your private key
3. Get USDC from exchange or DEX

Need your key? It's in our first DM!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 EARLY USER BONUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

First 500 users with 5 USDC:
→ 2x AIRDROP at launch! 💰

Make sure you're ready!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 SAVE THE DATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${launchDate}

What happens:
✨ Platform goes live
✨ USDC airdrops sent
✨ Trading begins


Set your reminder! ⏰

Questions? Reply here! 👇`,

  // ============================================
  // DM #4: Launch Day Announcement
  // ============================================
  launchDay: (username: string, amount: number, accountId: string) => `🎉 IT'S HERE! @${username}

Spredd Markets is NOW LIVE! 🚀

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 YOUR AIRDROP
━━━━━━━━━━━━━━━━━━━━━━━━━━━

We just sent you: ${amount} USDC! 🎁

Your account is now ACTIVATED! ✅
Account ID: ${accountId}

Check your HashPack wallet!
(Refresh if you don't see it immediately)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 START TRADING NOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Visit: spredd.markets
2. Click "Connect Wallet"
3. Select "HashPack"
4. Approve connection in wallet
5. Start predicting! 📈

Takes 30 seconds!


━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 QUICK TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Start with small bets to learn
• Check market analytics first
• Join Discord for alpha

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Let's go! May the best predictor win! 🔥`,

  // ============================================
  // DM #5: Help Menu (Interactive)
  // ============================================
  helpMenu: (username: string) => `👋 Hey @${username}! How can we help?

Reply with a number:

1️⃣ Setup - How to set up HashPack
2️⃣ USDC - How to get USDC
3️⃣ Security - Security tips
4️⃣ Lost Key - I lost my private key
5️⃣ Trading - How to start trading
6️⃣ Wallet Issues - Troubleshooting
7️⃣ Fees - Understanding fees
8️⃣ Human - Talk to support team

Or visit: spredd.markets/help`,

  // ============================================
  // Additional Interactive Responses
  // ============================================
  
  setupHelp: (username: string) => `📱 HASHPACK SETUP GUIDE

Hey @${username}! Here's how to set up:

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: DOWNLOAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Browser Extension:
chrome.google.com/webstore
→ Search "HashPack"

📱 Mobile App:
iOS: App Store → "HashPack Wallet"
Android: Play Store → "HashPack"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: IMPORT (Not Create!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open HashPack
2. Click "Import Existing Wallet"
3. Select "Import by Private Key"
4. Paste your private key
5. Set strong password
6. Done! ✅

⚠️ Don't click "Create New Wallet"

Need your key? It's in our first DM!
Lost it? Reply "lost key"

Still stuck? Reply "human" 💬`,

  usdcHelp: (username: string) => `💰 HOW TO GET USDC

Hey @${username}! Here are your options:

━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 1: EXCHANGE (Easiest)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Best exchanges:
• Binance (binance.com)
• Crypto.com (crypto.com)
• Gate.io (gate.io)

Steps:
1. Create account
2. Buy USDC (credit card/bank)
3. Go to "Withdraw"
4. Select "USDC"
5. ⚠️ Choose "HEDERA" network
6. Paste your Account Alias
7. Confirm!

Arrives in 3-5 seconds! ⚡

━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 2: DEX SWAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Already have other crypto?

1. Visit saucerswap.finance
2. Connect HashPack
3. Swap HBAR → USDC
4. Fee: ~$0.001

Super cheap and fast! 🚀

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL WARNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━

When withdrawing from exchanges:

✅ SELECT: "Hedera" or "HBAR"
❌ NEVER: "Ethereum" or "BSC"

Wrong network = LOST FUNDS!

More questions? Reply here! 💬`,

  lostKey: (username: string) => `😔 LOST PRIVATE KEY

Hey @${username}, we understand this is frustrating.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Private keys CANNOT be recovered.
This is a core principle of crypto security.

We cannot access your wallet without it.
No one can - that's by design! 🔐

━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CHECK THESE PLACES FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━

□ Password manager (1Password, Bitwarden)
□ Email (search "hedera wallet")
□ Screenshots folder
□ Cloud notes (Apple Notes, Google Keep)
□ Browser history (Twitter DMs)
□ Written notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 IF YOU CAN'T FIND IT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option 1: Create New Wallet
Reply "new wallet" and we'll create one

Option 2: Wait for Launch
If you haven't received USDC yet:
→ Your account isn't active
→ No funds to lose
→ Just get a new wallet!

If you DID receive USDC:
→ Contact support team
→ Reply "human"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ PREVENT THIS NEXT TIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Save in password manager
✅ Write on paper → store in safe
✅ Multiple backups
✅ Test recovery before adding funds

We're here to help! Reply with what you need 💙`,

  humanSupport: (username: string) => `🙋 HUMAN SUPPORT

Hey @${username}! We're connecting you with our team.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ RESPONSE TIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Business Hours: Within 1 hour
After Hours: Within 4 hours
Weekends: Within 8 hours

A real person will reply to this DM! 💬

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 WHILE YOU WAIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Immediate help:
• Discord: discord.gg/fPSubt3TE7
• Twitter: @spreddterminal

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your message has been flagged for our team.
We'll respond ASAP! 🏃‍♂️`,
};

export default dmTemplates;
