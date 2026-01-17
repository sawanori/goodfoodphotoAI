import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initializeFirebase } from './firebase';
import { initializeReceiptValidator } from './services/receiptValidator';
import { generateHandler } from './routes/generate';
import subscriptionRouter from './routes/subscription';

// Load environment variables
dotenv.config();

// Initialize services
initializeFirebase();
initializeReceiptValidator();

const app = express();
const PORT = process.env.PORT || 8080;

// 許可するオリジンのリスト
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

// CORS設定
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // オリジンがない場合（モバイルアプリなど）は許可
    if (!origin) {
      return callback(null, true);
    }

    // 許可リストにあるか確認
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Expo Go からのリクエストを許可
    if (origin.startsWith('exp://')) {
      return callback(null, true);
    }

    // 本番ドメインをチェック
    if (origin.endsWith('.bananadish.app') || origin.endsWith('.run.app')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many generation requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'BananaDish API',
    version: '1.0.0',
    status: 'running',
  });
});

// API endpoints
app.post('/v1/generate', generateLimiter, ...generateHandler);
app.use('/v1/subscription', subscriptionRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'サーバーエラーが発生しました',
      retryable: true,
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`BananaDish API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
