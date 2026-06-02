const crypto = require('crypto');

const encryptToken = (plainToken) => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex'),
            iv
        );
        const encrypted = Buffer.concat([cipher.update(plainToken), cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error('Token encryption error:', error.message);
        throw new Error('Failed to encrypt access token');
    }
};

const decryptToken = (encryptedTokenString) => {
    try {
        const [iv, encryptedToken] = encryptedTokenString.split(':');
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex'),
            Buffer.from(iv, 'hex')
        );
        let decrypted = decipher.update(Buffer.from(encryptedToken, 'hex'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Token decryption error:', error.message);
        throw new Error('Failed to decrypt access token');
    }
};

module.exports = { encryptToken, decryptToken };
