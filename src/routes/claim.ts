// src/routes/claim.ts
import express from "express";
import crypto from "crypto";
import { config } from "../config";
import { logger } from "../utils/logger";

const router = express.Router();

function decryptClaimToken(token: string): any {
  try {
    const secret = config.claimTokenSecret || config.encryptionKey;
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
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
    return null;
  }
}

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).send(renderErrorPage("Invalid claim link"));
    }

    const data = decryptClaimToken(token);
    
    if (!data) {
      return res.status(400).send(renderErrorPage("Invalid or corrupted claim token"));
    }

    // Check if expired
    if (Date.now() > data.expiresAt) {
      return res.status(410).send(renderErrorPage(
        "This claim link has expired",
        "Claim links expire after 1 hour for security. Please create a new wallet by mentioning @spreddterminal on Twitter."
      ));
    }

    // Return success page with credentials
    return res.send(renderSuccessPage({
      accountId: data.accountId,
      accountAlias: data.accountAlias,
      privateKey: data.privateKey,
      password: data.password,
      username: data.username
    }));

  } catch (error) {
    logger.error({ error }, "Error processing claim");
    return res.status(500).send(renderErrorPage("Something went wrong"));
  }
});

function renderSuccessPage(credentials: any) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Hedera Wallet - Spredd Markets</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #05000a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
      animation: slideUp 0.5s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }

    h1 {
      color: #1a202c;
      font-size: 28px;
      margin-bottom: 8px;
    }

    .subtitle {
      color: #718096;
      font-size: 16px;
    }

    .alert {
      background: #fed7d7;
      border: 2px solid #fc8181;
      border-radius: 12px;
      padding: 16px;
      margin: 24px 0;
    }

    .alert-title {
      color: #c53030;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .alert-content {
      color: #742a2a;
      font-size: 14px;
      line-height: 1.6;
    }

    .credential-box {
      background: #f7fafc;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      transition: all 0.2s;
    }

    .credential-box:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
    }

    .credential-label {
      color: #4a5568;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .credential-value {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .credential-text {
      flex: 1;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #1a202c;
      word-break: break-all;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .copy-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .copy-btn:hover {
      background: #5a67d8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .copy-btn:active {
      transform: translateY(0);
    }

    .copy-btn.copied {
      background: #48bb78;
    }

    .instructions {
      background: #ebf8ff;
      border: 2px solid #90cdf4;
      border-radius: 12px;
      padding: 20px;
      margin-top: 24px;
    }

    .instructions-title {
      color: #2c5282;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .instructions ul {
      list-style: none;
      padding: 0;
    }

    .instructions li {
      color: #2d3748;
      font-size: 14px;
      line-height: 1.8;
      padding: 6px 0;
      padding-left: 24px;
      position: relative;
    }

    .instructions li:before {
      content: "→";
      position: absolute;
      left: 0;
      color: #4299e1;
      font-weight: bold;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      color: #718096;
      font-size: 14px;
    }

    .footer a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      .container {
        padding: 24px;
      }

      h1 {
        font-size: 24px;
      }

      .credential-value {
        flex-direction: column;
        align-items: stretch;
      }

      .copy-btn {
        width: 100%;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🔐</div>
      <h1>Your Hedera Wallet</h1>
      <p class="subtitle">@${credentials.username}</p>
    </div>

    <div class="alert">
      <div class="alert-title">
        ⚠️ Security Warning
      </div>
      <div class="alert-content">
        Save these credentials immediately. This page cannot be refreshed and the link expires in 1 hour. We do NOT store your private key.
      </div>
    </div>

    <div class="credential-box">
      <div class="credential-label">Account ID</div>
      <div class="credential-value">
        <div class="credential-text">${credentials.accountId}</div>
        <button class="copy-btn" onclick="copyToClipboard('${credentials.accountId}', this)">
          <span>📋</span> Copy
        </button>
      </div>
    </div>

    ${credentials.accountAlias ? `
    <div class="credential-box">
      <div class="credential-label">Account Alias (EVM Address)</div>
      <div class="credential-value">
        <div class="credential-text">${credentials.accountAlias}</div>
        <button class="copy-btn" onclick="copyToClipboard('${credentials.accountAlias}', this)">
          <span>📋</span> Copy
        </button>
      </div>
    </div>
    ` : ''}

    <div class="credential-box">
      <div class="credential-label">Private Key</div>
      <div class="credential-value">
        <div class="credential-text">${credentials.privateKey}</div>
        <button class="copy-btn" onclick="copyToClipboard('${credentials.privateKey}', this)">
          <span>📋</span> Copy
        </button>
      </div>
    </div>

    <div class="credential-box">
      <div class="credential-label">Password (for encrypted formats)</div>
      <div class="credential-value">
        <div class="credential-text">${credentials.password}</div>
        <button class="copy-btn" onclick="copyToClipboard('${credentials.password}', this)">
          <span>📋</span> Copy
        </button>
      </div>
    </div>

    <div class="instructions">
      <div class="instructions-title">
        💡 How to Import Your Wallet
      </div>
      <ul>
        <li><strong>HashPack:</strong> Use the Private Key to import</li>
        <li><strong>Blade Wallet:</strong> Use the Private Key to import</li>
        <li><strong>MetaMask:</strong> Use the Private Key to import</li>
      </ul>
    </div>

    <div class="footer">
      Powered by <a href="https://spredd.markets" target="_blank">Spredd Markets</a>
    </div>
  </div>

  <script>
    function copyToClipboard(text, button) {
      navigator.clipboard.writeText(text).then(() => {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<span>✓</span> Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        alert('Failed to copy. Please copy manually.');
      });
    }

    // Warn before leaving page
    window.addEventListener('beforeunload', (e) => {
      e.preventDefault();
      e.returnValue = '';
    });
  </script>
</body>
</html>`;
}

function renderErrorPage(title: string, message?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Spredd Markets</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }

    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    h1 {
      color: #1a202c;
      font-size: 28px;
      margin-bottom: 16px;
    }

    p {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .btn {
      display: inline-block;
      background: #667eea;
      color: white;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn:hover {
      background: #5a67d8;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      color: #718096;
      font-size: 14px;
    }

    .footer a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>${title}</h1>
    ${message ? `<p>${message}</p>` : ''}
    <a href="https://spredd.markets" class="btn">Go to Spredd Markets</a>
    <div class="footer">
      Need help? <a href="https://twitter.com/spreddterminal" target="_blank">@spreddterminal</a>
    </div>
  </div>
</body>
</html>`;
}

export default router;
