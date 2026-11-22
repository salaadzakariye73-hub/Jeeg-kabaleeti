import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase } from './server/db';
import { apiRouter } from './server/routes';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  await initDatabase();

  const app = express();
  app.set('trust proxy', 1);

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Strict CORS when external frontend origin is configured
  const allowedOrigin = process.env.CORS_ORIGIN?.trim();
  if (allowedOrigin) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && origin === allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.use(express.json({ limit: '5mb' }));
  app.use('/api', apiRouter);

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Automatic scheduled database backup every 6 hours + initial startup checkpoint if none in last 6h
  try {
    const recentBackups = await db.listBackups(1);
    const lastTs = recentBackups[0]?.createdAt ? new Date(recentBackups[0].createdAt).getTime() : 0;
    if (Date.now() - lastTs > 6 * 60 * 60 * 1000) {
      await db.runAutomaticBackup('SYSTEM_CHECKPOINT');
    }
  } catch (err) {
    console.warn('[Backup] Initial checkpoint skipped:', err);
  }

  const backupTimer = setInterval(async () => {
    try {
      await db.runAutomaticBackup('AUTOMATIC_SCHEDULED');
    } catch (err) {
      console.error('[Backup] Scheduled backup failed:', err);
    }
  }, 6 * 60 * 60 * 1000);
  backupTimer.unref();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MSh Server] Running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
