# 🎯 Hedera Wallet Bot - Spredd Markets

Automated Hedera wallet creation bot.

## Features

- 🎨 Free Hedera wallet generation
- 🔐 Encrypted private key delivery via DM
- 🚀 Enterprise Twitter API rate limits
- 💾 PostgreSQL persistent storage
- 📊 Health monitoring & metrics
- 🛡️ Rate limiting & security
- 📬 Scheduled DM campaigns
- 🤖 Interactive auto-responses

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (or use Railway)
- Virtuals GAME API key
- Twitter account

### Installation

\`\`\`bash
# Clone repository
git clone https://github.com/yourusername/hedera-wallet-bot.git
cd hedera-wallet-bot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Build
npm run build

# Initialize database
npm run setup-db

# Start bot
npm start
\`\`\`

## Deployment to Railway

1. Push to GitHub
2. Connect Railway to your repo
3. Add PostgreSQL database in Railway
4. Set environment variables
5. Deploy automatically!

Full guide: See DEPLOYMENT.md

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GAME_API_KEY | Yes | Virtuals API key |
| GAME_TWITTER_ACCESS_TOKEN | Yes | Twitter access token |
| DATABASE_URL | Yes | PostgreSQL connection |
| USDC_TOKEN_ID | Yes | Hedera USDC token ID |

## API Endpoints

- `GET /health` - Health check
- `GET /metrics` - Bot metrics

## Development

\`\`\`bash
# Run in dev mode
npm run dev

# Test database connection
npm run test-connection
\`\`\`

## License

MIT

## Support

- Discord: [Your Discord]
- Twitter: @SpreddMarkets
- Email: support@spreddmarkets.io
