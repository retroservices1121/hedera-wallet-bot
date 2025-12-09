// ============================================
// NEW FILE: src/routes/claim.ts
// API endpoint for claim.spredd.markets
// ============================================

import express, { Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Decrypt claim token
 */
function decryptClaimToken(token: string): any {
  try {
    const secret = config.claimTokenSecret || config.encryptionKey;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [encrypted, authTag] = decoded.split(':');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(secret.slice(0, 32)),
      Buffer.from(secret.slice(0, 12))
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error({ error }, "Failed to decrypt claim token");
    throw new Error("Invalid or expired token");
  }
}

/**
 * GET /claim/:token - Retrieve wallet credentials
 */
router.get("/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    // Decrypt and validate token
    const data = decryptClaimToken(token);
    
    // Check if expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      logger.warn({ token, username: data.username }, "Claim token expired");
      return res.status(410).json({ 
        error: "Link Expired",
        message: "This link expired after 1 hour for security. You'll need to create a new wallet.",
        action: "Mention your bot on Twitter to create a new wallet with a fresh claim link."
      });
    }

    // Track that user accessed their claim link
    if (data.userId) {
      try {
        // You'll need to import WalletService in this file
        const { WalletService } = await import("../services/wallet.service");
        const walletService = new WalletService();
        await walletService.markClaimLinkAccessed(data.userId);
      } catch (error) {
        logger.error({ error }, "Failed to track claim link access");
      }
    }

    logger.info({ username: data.username }, "Wallet credentials claimed successfully");

    // Return credentials with raw private key for wallet import
    return res.json({
      success: true,
      credentials: {
        accountId: data.accountId,
        accountAlias: data.accountAlias,
        password: data.password,
        privateKey: data.privateKey, // Raw private key for HashPack import
      },
      importInstructions: {
        hashpack: "Use the Private Key to import into HashPack",
        blade: "Use the Private Key to import into Blade Wallet",
        metamask: "Use the Private Key to import into MetaMask"
      },
      warning: "Save these credentials immediately. This page will not work after refresh."
    });

  } catch (error: any) {
    logger.error({ error }, "Failed to process claim request");
    
    return res.status(400).json({
      error: "Invalid or expired token",
      message: "This link may have expired or been used already. Please contact support if you need help."
    });
  }
});

/**
 * GET / - Claim page HTML
 */
router.get("/", (_req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Claim Your Wallet - Spredd Markets</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
          color: #667eea;
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .subtitle {
          color: #666;
          margin: 0 0 30px 0;
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          font-size: 14px;
        }
        .credential-box {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .credential-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .credential-value {
          font-family: 'Courier New', monospace;
          font-size: 16px;
          color: #212529;
          word-break: break-all;
          margin-bottom: 15px;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          margin-top: 10px;
        }
        button:hover {
          background: #5568d3;
        }
        .error {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .success {
          color: #28a745;
          font-size: 18px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎉 Claim Your Wallet</h1>
        <p class="subtitle">Spredd Markets - Hedera Mainnet</p>
        
        <div id="loading">
          <p>Loading your credentials...</p>
        </div>
        
        <div id="content" style="display: none;">
          <div class="warning">
            ⚠️ <strong>CRITICAL:</strong> This link expires 1 HOUR after creation for security. Save your credentials immediately!
          </div>
          
          <div class="credential-box">
            <div class="credential-label">Account ID</div>
            <div class="credential-value" id="accountId"></div>
            
            <div class="credential-label">Private Key (for HashPack/Blade)</div>
            <div class="credential-value" id="privateKey" style="font-size: 12px;"></div>
            
            <div class="credential-label">Password</div>
            <div class="credential-value" id="password"></div>
          </div>
          
          <button onclick="copyToClipboard()">📋 Copy All Credentials</button>
          <button onclick="downloadCredentials()">💾 Download as Text File</button>
          
          <div class="warning" style="margin-top: 20px;">
            💡 <strong>To import into HashPack or Blade:</strong><br>
            1. Open the wallet app<br>
            2. Select "Import Account"<br>
            3. Paste your Private Key<br>
            <br>
            ⚠️ If this link expired, mention the bot again on Twitter to create a new wallet.
          </div>
        </div>
        
        <div id="error" style="display: none;" class="error"></div>
      </div>
      
      <script>
        const token = window.location.pathname.split('/').pop();
        
        async function loadCredentials() {
          try {
            const response = await fetch(\`/claim/\${token}\`);
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.message || 'Failed to load credentials');
            }
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('content').style.display = 'block';
            document.getElementById('accountId').textContent = data.credentials.accountId || data.credentials.accountAlias;
            document.getElementById('privateKey').textContent = data.credentials.privateKey;
            document.getElementById('password').textContent = data.credentials.password;
            
          } catch (error) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = error.message;
          }
        }
        
        function copyToClipboard() {
          const accountId = document.getElementById('accountId').textContent;
          const privateKey = document.getElementById('privateKey').textContent;
          const password = document.getElementById('password').textContent;
          const text = \`Hedera Wallet Credentials\\n\\nAccount: \${accountId}\\nPrivate Key: \${privateKey}\\nPassword: \${password}\\n\\nTo import into HashPack/Blade:\\n1. Open the wallet app\\n2. Select "Import Account"\\n3. Paste the Private Key above\`;
          
          navigator.clipboard.writeText(text).then(() => {
            alert('✅ Credentials copied to clipboard!');
          });
        }
        
        function downloadCredentials() {
          const accountId = document.getElementById('accountId').textContent;
          const privateKey = document.getElementById('privateKey').textContent;
          const password = document.getElementById('password').textContent;
          const text = \`Hedera Wallet Credentials\\n\\nAccount: \${accountId}\\nPrivate Key: \${privateKey}\\nPassword: \${password}\\n\\nTo import into HashPack/Blade:\\n1. Open the wallet app\\n2. Select "Import Account"\\n3. Paste the Private Key above\\n\\nSpredd Markets - https://spredd.markets\`;
          
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'hedera-wallet-credentials.txt';
          a.click();
        }
        
        loadCredentials();
      </script>
    </body>
    </html>
  `);
});

export default router;
