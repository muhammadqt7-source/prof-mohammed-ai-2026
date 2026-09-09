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
  app.use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-anonymous-user-id',
        'X-Anonymous-User-Id',
        'x-user-id',
        'X-Requested-With',
        'Accept',
        'Cache-Control',
        'Pragma',
      ],
      exposedHeaders: ['x-anonymous-user-id', 'X-Anonymous-User-Id'],
    })
  );
  app.use(express.json({ limit: '1mb' }));

  // API Router FIRST
  app.use('/api', apiRouter);

  // Root Health Check for Container Ingress & Cloud Run Probes
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

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
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          // Never cache index.html or html files so WebView/browser always fetches the latest deployment
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
          } else if (filePath.match(/\.[a-f0-9]{8,}\.(js|css|png|jpg|svg|woff2?)$/i)) {
            // Vite hashed assets are safe to cache long term
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            // Unhashed files (manifest.json, favicon, etc.)
            res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
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

  // Prevent server crashes on unexpected runtime exceptions or unhandled promise rejections
  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught Exception intercepted:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Rejection intercepted at:', promise, 'reason:', reason);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
