import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/routes.js';
import { db } from './src/server/db.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable proxy trust for multi-instance load balancers (Cloud Run, ALB, Nginx)
  app.set('trust proxy', 1);

  // Global Middlewares (Compression, CORS, JSON)
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // API Router FIRST
  app.use('/api', apiRouter);

  // Background campaign expiry interval (every 30 seconds)
  setInterval(() => {
    try {
      db.checkAndExpireCampaigns();
    } catch (e) {
      console.error('Error in background campaign check:', e);
    }
  }, 30000);

  // Development vs Production Frontend Serving with caching headers
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
          // Never cache index.html so users always get fresh releases
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Professor Mohammad Mahdi AI server listening on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown handling for multi-instance lifecycle
  const gracefulShutdown = () => {
    try {
      db.flushSync();
    } catch (err) {
      console.error('Error flushing DB during shutdown:', err);
    }
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
