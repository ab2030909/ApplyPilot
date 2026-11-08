import './env.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { HttpError, MODEL, analyzeJob, answerQuestion, coverLetter, extractResume, isConfigured, matchJob, optimizeResume } from './ai.js';

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';
const list = (v?: string) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const extraOrigins = list(process.env.ALLOWED_ORIGINS);
// In production, lock the API to your published extension ID(s) so other extensions can't spend your Groq quota.
const extensionIds = list(process.env.ALLOWED_EXTENSION_IDS);
const allowLocalhost = process.env.ALLOW_LOCALHOST ? process.env.ALLOW_LOCALHOST === 'true' : !isProd;

app.disable('x-powered-by');
// Behind a proxy/load balancer (Render, Railway, Fly, Nginx) so rate limiting sees the real client IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);

function originAllowed(origin: string) {
  if (origin.startsWith('chrome-extension://')) return !extensionIds.length || extensionIds.includes(origin.slice('chrome-extension://'.length));
  if (allowLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return extraOrigins.includes(origin);
}

// Only the extension, the local dashboard and explicitly allowed origins may call this API.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const ok = originAllowed(origin);
      cb(ok ? null : new Error('Origin not allowed'), ok);
    },
    methods: ['GET', 'POST'],
    maxAge: 600,
  }),
);
app.get('/', (_req, res) => res.json({ name: 'ApplyPilot AI backend', health: '/api/health' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Slow down for a minute.' } }));

// ---------------------------------------------------------------- validation
const jd = z.string().trim().min(40, 'Job description is too short (min 40 characters).').max(20000, 'Job description is too long (max 20,000 characters).');
const candidate = z.object({ profileText: z.string().max(15000).optional(), resumeText: z.string().max(40000).optional() })
  .refine((c) => (c.profileText?.trim() || c.resumeText?.trim()), { message: 'Add profile information or select a resume first.' });

const schemas = {
  analyze: z.object({ jobDescription: jd }),
  match: z.object({ jobDescription: jd, candidate }),
  cover: z.object({
    jobDescription: z.string().trim().max(20000).default(''),
    company: z.string().trim().max(200).default(''),
    title: z.string().trim().min(1, 'Job title is required.').max(200),
    tone: z.string().trim().max(40).default('Professional'),
    candidate,
  }),
  answer: z.object({
    question: z.string().trim().min(5, 'Enter the application question.').max(1500),
    jobDescription: z.string().trim().max(20000).optional(),
    company: z.string().trim().max(200).optional(),
    title: z.string().trim().max(200).optional(),
    length: z.enum(['short', 'medium', 'detailed']).default('medium'),
    candidate,
  }),
  optimize: z.object({ jobDescription: jd, candidate }),
  extract: z.object({ resumeText: z.string().trim().min(80, 'Resume text is too short.').max(40000) }),
};

const route = <S extends z.ZodType>(schema: S, handler: (body: z.infer<S>) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' });
    try {
      res.json(await handler(parsed.data));
    } catch (e) {
      next(e);
    }
  };

// ---------------------------------------------------------------- routes
app.get('/api/health', (_req, res) => res.json({ ok: true, groqConfigured: isConfigured(), model: MODEL }));
app.post('/api/analyze-job', route(schemas.analyze, (b) => analyzeJob(b.jobDescription)));
app.post('/api/match', route(schemas.match, (b) => matchJob(b.jobDescription, b.candidate)));
app.post('/api/cover-letter', route(schemas.cover, (b) => coverLetter(b)));
app.post('/api/answer', route(schemas.answer, (b) => answerQuestion(b)));
app.post('/api/optimize', route(schemas.optimize, (b) => optimizeResume(b.jobDescription, b.candidate)));
app.post('/api/extract-resume', route(schemas.extract, (b) => extractResume(b.resumeText)));

// ---------------------------------------------------------------- errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON body.' });
  if (err instanceof Error && err.message === 'Origin not allowed') return res.status(403).json({ error: 'Origin not allowed.' });
  // Log the message only: error objects from upstream SDKs can carry request payloads (user data).
  console.error('Unexpected error:', err instanceof Error ? err.message : String(err));
  res.status(500).json({ error: 'Unexpected server error.' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`ApplyPilot backend listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} (${isProd ? 'production' : 'development'})`);
  console.log(isConfigured() ? `Groq model: ${MODEL}` : 'WARNING: GROQ_API_KEY is not set (copy server/.env.example to server/.env).');
  if (isProd && !extensionIds.length) console.warn('WARNING: ALLOWED_EXTENSION_IDS is empty, so any Chrome extension can call this API.');
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`${sig} received, shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
