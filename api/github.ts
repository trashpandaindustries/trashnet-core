import { Octokit } from 'octokit';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key-12345', 'salt', 32);

export function encrypt(text: string) {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
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
