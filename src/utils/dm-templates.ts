export const dmTemplates = {
  // Wallet credentials (DM #1)
  walletCredentials: (username: string, wallet: any, password: string, encryptedKey: string, count: number) => `🎉 Welcome to Spredd Markets, @${username}!

Your Hedera wallet has been created successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 YOUR WALLET DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account Alias (use this to receive):
${wallet.accountAlias}

Public Key:
${wallet.publicKey}

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

  // Setup guide (DM #2)
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
💰 STEP 3: GET USDC
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 METHOD A: Buy on Exchange

Best options:
- Binance: binance.com
- Crypto.com: crypto.com
- Gate.io: gate.io

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

Full guide: spreddmarkets.io/guide
Videos: youtube.com/@spreddmarkets
Discord: discord.gg/spreddmarkets

Need help? Reply here! 💪`,

  // Pre-launch reminder
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
☐ Following @SpreddMarkets?

Reply "help" if you need guidance!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 EARLY USER BONUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

First 500 users with 10+ USDC:
→ 2x AIRDROP at launch! 💰

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set your reminder! ⏰`,

  // Launch day
  launchDay: (username: string, amount: number, accountId: string) => `🎉 IT'S HERE! @${username}

Spredd Markets is NOW LIVE! 🚀

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 YOUR AIRDROP
━━━━━━━━━━━━━━━━━━━━━━━━━━━

We just sent you: ${amount} USDC! 🎁

Your account is ACTIVATED! ✅
Account ID: ${accountId}

Check HashPack now!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 START TRADING
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Visit: spreddmarkets.io
2. Connect HashPack
3. Start predicting! 📈

Let's go! 🔥`,

  // Help menu
  helpMenu: (username: string) => `👋 Hey @${username}! How can we help?

Reply with a number:

1️⃣ Setup - HashPack guide
2️⃣ USDC - How to get USDC
3️⃣ Security - Security tips
4️⃣ Lost Key - I lost my key
5️⃣ Trading - How to trade
6️⃣ Human - Talk to support

Or visit: spreddmarkets.io/help`,
};
