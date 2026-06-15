import { Octokit } from 'octokit';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string) {
    if (!text) return text;
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key-12345', salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Format: salt:iv:encrypted
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length === 2) {
             const ENCRYPTION_KEY = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key-12345', 'salt', 32);
             const iv = Buffer.from(textParts[0], 'hex');
             const encryptedText = Buffer.from(textParts[1], 'hex');
             const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
             let decrypted = decipher.update(encryptedText);
             decrypted = Buffer.concat([decrypted, decipher.final()]);
             return decrypted.toString();
        } else if (textParts.length === 3) {
             const salt = Buffer.from(textParts[0], 'hex');
             const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key-12345', salt, 32);
             const iv = Buffer.from(textParts[1], 'hex');
             const encryptedText = Buffer.from(textParts[2], 'hex');
             const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
             let decrypted = decipher.update(encryptedText);
             decrypted = Buffer.concat([decrypted, decipher.final()]);
             return decrypted.toString();
        }
        return '';
    } catch (e) {
        return ''; // Decryption failed
    }
}

export async function pushNoteToGithub(token: string, repoString: string, branch: string, pathPrefix: string, filename: string, content: string, message: string) {
    const octokit = new Octokit({ auth: token });
    const [owner, repo] = repoString.split('/');
    if (!owner || !repo) throw new Error('Invalid repository format. Should be owner/repo.');

    const fullPath = (pathPrefix ? (pathPrefix.endsWith('/') ? pathPrefix : pathPrefix + '/') : '') + filename;

    let sha;
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: fullPath,
            ref: branch || 'main'
        });
        if (!Array.isArray(data) && data.type === 'file') {
            sha = data.sha;
        }
    } catch (e: any) {
        if (e.status !== 404) {
            throw e;
        }
    }

    await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: fullPath,
        message,
        content: Buffer.from(content || '').toString('base64'),
        sha,
        branch: branch || 'main'
    });
}
