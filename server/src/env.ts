import { config } from 'dotenv';

// An empty variable in the shell/system environment (e.g. GROQ_API_KEY="") would otherwise
// block the value from server/.env, because dotenv never overrides existing variables.
for (const key of ['GROQ_API_KEY', 'GROQ_MODEL', 'PORT', 'HOST', 'ALLOWED_ORIGINS', 'ALLOWED_EXTENSION_IDS', 'ALLOW_LOCALHOST', 'TRUST_PROXY', 'RATE_LIMIT_PER_MINUTE']) {
  if (process.env[key] !== undefined && process.env[key]!.trim() === '') delete process.env[key];
}
config({ quiet: true });
