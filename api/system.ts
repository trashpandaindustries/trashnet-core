import { Router, Request, Response } from 'express';
import os from 'os';
import { requireAuth } from './auth.js';
import { pool } from './db.js';
import fs from 'fs';
import path from 'path';

export const systemRouter = Router();

// Get settings helper
async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const settings: Record<string, any> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function getSystemStats() {
  // node:os stats
  const cpus = os.cpus();
  const loadavg = os.loadavg();
  const totalmem = os.totalmem();
  const freemem = os.freemem();
  const uptime = os.uptime();

  let disk = { total: 0, free: 0, used: 0 };
  try {
    const STORAGE_ROOT = process.env.STORAGE_MOUNT_PATH || path.join(process.cwd(), 'assets');
    const stat = await fs.promises.statfs(STORAGE_ROOT);
    const total = stat.blocks * stat.bsize;
    // bavail is the free blocks available to unprivileged user
    const free = stat.bavail * stat.bsize;
    disk = {
      total,
      free,
      used: total - free
    };
  } catch (err) {
    console.error('Failed to statfs storage root', err);
  }

  // Basic representation
  return {
    cpuLoad: loadavg, // [1m, 5m, 15m]
    memory: {
      total: totalmem,
      free: freemem,
      used: totalmem - freemem
    },
    disk: disk,
    uptime: uptime
  };
}

let cachedDockerData: any = null;
let lastDockerFetch = 0;

export async function getDockerServices() {
  const now = Date.now();
  if (cachedDockerData && (now - lastDockerFetch < 30000)) {
     return cachedDockerData;
  }

  try {
    const settings = await getSettings();
    const portainerUrl = settings.portainer_url;
    const portainerEnv = settings.portainer_env || 1;
    const portainerToken = settings.portainer_token;
    const labelFilter = settings.docker_label_filter || 'dashboard.show=true';
    const ignoreSsl = settings.portainer_ignore_ssl === 'true' || settings.portainer_ignore_ssl === true;
    
    if (ignoreSsl) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    if (!portainerUrl || !portainerToken) {
      cachedDockerData = { status: 'unconfigured', services: [] };
      lastDockerFetch = now;
      return cachedDockerData;
    }
    
    const res = await fetch(`${portainerUrl}/api/endpoints/${portainerEnv}/docker/containers/json?all=1`, {
      headers: { 'X-API-Key': portainerToken }
    });

    if (!res.ok) {
       cachedDockerData = { status: 'error', error: await res.text(), services: [] };
       lastDockerFetch = now;
       return cachedDockerData;
    }
    
    const containers = await res.json() as any[];
    const [filterKey, filterValue] = labelFilter.split('=');
    
    const services = containers.filter(c => {
       const labels = c.Labels || {};
       if (filterKey && filterValue) {
           return labels[filterKey] === filterValue;
       }
       return true;
    }).map(c => {
       const labels = c.Labels || {};
       let name = labels['dashboard.name'] || (c.Names && c.Names.length > 0 ? c.Names[0] : 'unknown');
       if (name.startsWith('/')) name = name.slice(1);
       const link = labels['dashboard.url'] || null;
       const icon = labels['dashboard.icon'] || null;
       const description = labels['dashboard.description'] || null;

       return {
         id: c.Id,
         name,
         state: c.State,
         status: c.Status,
         link,
         icon,
         description
       };
    });
    
    cachedDockerData = { status: 'ok', services };
    lastDockerFetch = now;
    return cachedDockerData;
  } catch (error: any) {
    console.error('Docker fetch error', error);
    cachedDockerData = { status: 'error', error: error.message, services: [] };
    lastDockerFetch = now;
    return cachedDockerData;
  }
}

systemRouter.use(requireAuth);

systemRouter.get('/stats', async (req: Request, res: Response) => {
  const stats = await getSystemStats();
  res.json(stats);
});

systemRouter.get('/docker', async (req: Request, res: Response) => {
  const result = await getDockerServices();
  res.json(result);
});
