import { Router } from 'express';
import { pool } from './db.js';
import fs from 'fs';
import path from 'path';

export const filesRouter = Router();

// For local testing in the container/sandbox, default to process.cwd() if STORAGE_MOUNT_PATH not set
const STORAGE_ROOT = process.env.STORAGE_MOUNT_PATH || path.join(process.cwd(), 'assets');

// Ensure the storage dir exists
if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Helper to reliably check if path is inside root
function isSubPathOf(childDir: string, parentDir: string) {
    const relative = path.relative(parentDir, childDir);
    const isSubdir = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    return isSubdir || relative === '';
}

function resolveAndValidatePath(requestedPath: string) {
    // Prevent usage of NULL bytes
    if (requestedPath.indexOf('\0') !== -1) {
        throw new Error('Path traversal attempt blocked');
    }
    const normalizedTarget = path.normalize(path.join(STORAGE_ROOT, requestedPath));
    
    if (!isSubPathOf(normalizedTarget, STORAGE_ROOT)) {
        throw new Error('Path traversal attempt blocked');
    }
    
    return normalizedTarget;
}

async function logAudit(userId: string, action: string, requestedPath: string, req: any) {
    const ip = req.ip || req.connection?.remoteAddress || null;
    const ua = req.get('User-Agent') || null;
    try {
        await pool.query(`
            INSERT INTO file_audit_log (user_id, action, path, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, action, requestedPath, ip, ua]);
    } catch (e) {
        console.error("Audit log failed", e);
    }
}

filesRouter.get('/', async (req, res) => {
    try {
        const userId = (req as any).user?.sub;
        const reqPath = typeof req.query.path === 'string' ? req.query.path : '/';
        const targetPath = resolveAndValidatePath(reqPath);
        
        await logAudit(userId, 'list', reqPath, req);

        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        const stat = await fs.promises.stat(targetPath);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: 'Not a directory' });
        }

        const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
        
        const filesWithStats = await Promise.all(entries.map(async (entry) => {
            const isDir = entry.isDirectory();
            const ext = path.extname(entry.name).toLowerCase();
            const type = isDir ? 'directory' : (ext.replace('.', '') || 'unknown');
            
            try {
                const fileStat = await fs.promises.stat(path.join(targetPath, entry.name));
                return {
                    name: entry.name,
                    isDir,
                    size: fileStat.size,
                    type,
                    lastModified: fileStat.mtime
                };
            } catch {
                return {
                    name: entry.name,
                    isDir,
                    size: 0,
                    type,
                    lastModified: new Date()
                };
            }
        }));

        // Sort: directories first, then alphabetically
        filesWithStats.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
        });

        res.json({ files: filesWithStats, currentPath: reqPath });
    } catch (e: any) {
        if (e.message === 'Path traversal attempt blocked') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.status(500).json({ error: 'Failed to read directory' });
    }
});

filesRouter.post('/reindex', async (req, res) => {
    try {
        const user = (req as any).user;
        if (user?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }
        
        let indexedCount = 0;
        const start = Date.now();

        async function crawl(dirPath: string) {
            let entries;
            try {
                entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            } catch (err) {
                console.error(`Failed to read directory ${dirPath}`, err);
                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    await crawl(fullPath);
                } else if (entry.isFile()) {
                    const relativePath = path.relative(STORAGE_ROOT, fullPath);
                    // Store POSIX path starting with /
                    const dbPath = '/' + relativePath.split(path.sep).join('/');
                    const ext = path.extname(entry.name).toLowerCase().replace('.', '') || null;
                    
                    try {
                        const stat = await fs.promises.stat(fullPath);
                        await pool.query(`
                            INSERT INTO file_index (path, filename, extension, size_bytes, modified_at)
                            VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (path) DO UPDATE SET
                                filename = EXCLUDED.filename,
                                extension = EXCLUDED.extension,
                                size_bytes = EXCLUDED.size_bytes,
                                modified_at = EXCLUDED.modified_at,
                                indexed_at = NOW()
                        `, [dbPath, entry.name, ext, stat.size, stat.mtime]);
                        indexedCount++;
                    } catch (err) {
                        console.error(`Failed to index file ${dbPath}`, err);
                    }
                }
            }
        }

        await crawl(STORAGE_ROOT);
        
        const durationMs = Date.now() - start;
        res.json({ indexed: indexedCount, durationMs });
    } catch (e) {
        console.error("Reindex error:", e);
        res.status(500).json({ error: 'Failed to reindex files' });
    }
});

filesRouter.get('/download', async (req, res) => {
    try {
        const userId = (req as any).user?.sub;
        const reqPath = typeof req.query.path === 'string' ? req.query.path : '/';
        const isPreview = req.query.preview === 'true';
        const targetPath = resolveAndValidatePath(reqPath);

        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stat = await fs.promises.stat(targetPath);
        if (!stat.isFile()) {
            return res.status(400).json({ error: 'Not a file' });
        }

        // Action is logged as preview or download based on file type whitelist and query intent
        const action = isPreview ? 'preview' : 'download';
        await logAudit(userId, action, reqPath, req);

        if (action === 'download') {
            res.download(targetPath);
        } else {
            res.sendFile(targetPath);
        }
    } catch (e: any) {
        if (e.message === 'Path traversal attempt blocked') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.status(500).json({ error: 'Failed to download file' });
    }
});
