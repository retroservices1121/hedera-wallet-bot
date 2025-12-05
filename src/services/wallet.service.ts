// ============================================
// FIX: Update createWallet to return raw private key too
// Add this to src/services/wallet.service.ts
// ============================================

// Update the return type
async createWallet(userId: string, username: string): Promise<{ 
  wallet: WalletRecord; 
  password: string;
  rawPrivateKey: string; // Add this
}> {
  try {
    logger.info(`Creating wallet for user ${username} (${userId})`);
    
    const walletData = await this.generateWallet();
    const password = generatePassword(12);
    const encryptedKey = encryptPrivateKey(walletData.privateKey, password);
    const passwordHash = hashPassword(password);

    // Store the raw private key before inserting
    const rawPrivateKey = walletData.privateKey;

    logger.info(`Inserting wallet into database for ${username}...`);
    logger.info(`Wallet data - accountId: ${walletData.accountId || 'null'}, accountAlias: ${walletData.accountAlias}`);

    const result = await pool.query(
      `INSERT INTO wallets (
        twitter_user_id, twitter_username, private_key_encrypted,
        public_key, account_id, account_alias, evm_address, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId, 
        username, 
        encryptedKey, 
        walletData.publicKey, 
        walletData.accountId || null,
        walletData.accountAlias, 
        walletData.evmAddress, 
        passwordHash
      ]
    );

    logger.info(`Database insert successful for ${username}`);

    await this.logAudit(userId, "WALLET_CREATED", {
      username,
      account_id: walletData.accountId || null,
      account_alias: walletData.accountAlias,
      on_chain: !!walletData.accountId,
    });

    logger.info(`✅ Wallet created for ${username}: ${walletData.accountId || walletData.accountAlias}`);

    return {
      wallet: result.rows[0],
      password,
      rawPrivateKey, // Return the raw private key
    };
  } catch (error: any) {
    // ... existing error handling ...
  }
}
