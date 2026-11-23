import crypto from 'node:crypto';
import type express from 'express';
import type {
  ActiveFault,
  AiIntelligenceSnapshot,
  DataQualityIssue,
  GridAlert,
  InfrastructureAsset,
  UserRole
} from '../src/types/grid.ts';

const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET_KEY;
  if (configured && configured !== 'CHANGE_ME_IN_PRODUCTION_USE_ENV_SECRET' && configured.length >= 16) {
    return configured;
  }
  return EPHEMERAL_DEV_SECRET;
}

export function isDemoModeEnabled(): boolean {
  return process.env.ENABLE_DEMONSTRATION_MODE !== 'false';
}

export interface ServerUserAccount {
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
}

export interface JwtClaims {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
  jti: string;
  iat: number;
  exp: number;
}

const registeredUsers = new Map<string, ServerUserAccount>();
const revokedRefreshJtis = new Set<string>();

export function hashUserPassword(password: string, existingSalt?: string): string {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyUserPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const candidate = hashUserPassword(password, parts[1]);
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export function registerServerUser(params: {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}): { ok: true; user: ServerUserAccount } | { ok: false; error: string; status: number } {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Valid email address is required.', status: 400 };
  }
  if (registeredUsers.has(email)) {
    return { ok: false, error: `Account "${email}" is already registered.`, status: 409 };
  }
  try {
    const user: ServerUserAccount = {
      username: params.username.trim(),
      email,
      fullName: params.fullName.trim(),
      role: params.role,
      passwordHash: hashUserPassword(params.password)
    };
    registeredUsers.set(email, user);
    return { ok: true, user };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid password.',
      status: 400
    };
  }
}

export function authenticateServerUser(identifier: string, password: string): ServerUserAccount | null {
  const lookup = identifier.trim().toLowerCase();
  if (!lookup || !password) return null;
  let found = registeredUsers.get(lookup);
  if (!found) {
    for (const acc of registeredUsers.values()) {
      if (acc.username.toLowerCase() === lookup) {
        found = acc;
        break;
      }
    }
  }
  if (!found) return null;
  if (!verifyUserPassword(password, found.passwordHash)) return null;
  return found;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64').toString('utf8');
}

export function signJwtToken(params: {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
  ttlSeconds: number;
}): { token: string; expiresAtMs: number; jti: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + params.ttlSeconds;
  const jti = crypto.randomBytes(12).toString('hex');
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: params.sub,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      tokenType: params.tokenType,
      jti,
      iat: nowSec,
      exp: expSec
    } satisfies JwtClaims)
  );
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest()
  );
  return {
    token: `${header}.${payload}.${signature}`,
    expiresAtMs: expSec * 1000,
    jti
  };
}

export function verifyJwtToken(
  token: string,
  expectedType: 'access' | 'refresh'
): { valid: true; claims: JwtClaims } | { valid: false; error: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Malformed JWT token.' };
    const [header, payload, sig] = parts;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest()
    );
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid JWT signature.' };
    }
    const claims = JSON.parse(base64UrlDecode(payload)) as JwtClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp <= nowSec) {
      return { valid: false, error: 'JWT token has expired.' };
    }
    if (claims.tokenType !== expectedType) {
      return { valid: false, error: `Expected ${expectedType} token.` };
    }
    if (expectedType === 'refresh' && revokedRefreshJtis.has(claims.jti)) {
      return { valid: false, error: 'Refresh token has been revoked.' };
    }
    return { valid: true, claims };
  } catch {
    return { valid: false, error: 'Invalid JWT token.' };
  }
}

export function revokeRefreshJwt(token: string): void {
  const verified = verifyJwtToken(token, 'refresh');
  if (verified.valid) {
    revokedRefreshJtis.add(verified.claims.jti);
  }
}

export function extractBearerFromRequest(req: express.Request): JwtClaims | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const raw = header.slice('Bearer '.length).trim();
  const verified = verifyJwtToken(raw, 'access');
  return verified.valid ? verified.claims : null;
}

// ----------------------------------------------------------------------------
// Monitoring, Rate Limiting & Security Headers
// ----------------------------------------------------------------------------

export interface MonitoringEventLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: 'API' | 'AUTH' | 'AI' | 'WEBSOCKET' | 'DEMO';
  message: string;
  statusCode?: number;
  latencyMs?: number;
}

export class ServerMonitoringStore {
  public readonly startedAtMs = Date.now();
  public totalRequests = 0;
  public errorCount = 0;
  public failedLoginAttempts = 0;
  public aiRecalculationsCount = 1;
  private totalLatencyMs = 0;
  public readonly recentLogs: MonitoringEventLog[] = [];

  recordLog(entry: Omit<MonitoringEventLog, 'id' | 'timestamp'>): void {
    this.recentLogs.unshift({
      id: `mon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry
    });
    if (this.recentLogs.length > 50) {
      this.recentLogs.length = 50;
    }
  }

  recordRequest(statusCode: number, latencyMs: number, path: string): void {
    this.totalRequests += 1;
    this.totalLatencyMs += latencyMs;
    if (statusCode >= 500) {
      this.errorCount += 1;
      this.recordLog({
        level: 'ERROR',
        category: 'API',
        message: `HTTP ${statusCode} on ${path}`,
        statusCode,
        latencyMs: Math.round(latencyMs * 100) / 100
      });
    }
  }

  get avgLatencyMs(): number {
    if (this.totalRequests === 0) return 0;
    return Math.round((this.totalLatencyMs / this.totalRequests) * 100) / 100;
  }

  get uptimeSeconds(): number {
    return Math.round((Date.now() - this.startedAtMs) / 1000);
  }
}

interface RateBucket {
  count: number;
  resetAtMs: number;
}

const rateBuckets = new Map<string, RateBucket>();

export function createSlidingRateLimiter(params: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}): express.RequestHandler {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${params.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = rateBuckets.get(key);
    if (!existing || now > existing.resetAtMs) {
      rateBuckets.set(key, { count: 1, resetAtMs: now + params.windowMs });
      return next();
    }
    if (existing.count >= params.maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((existing.resetAtMs - now) / 1000)));
      return res.status(429).json({
        error: 'Too many requests. Rate limit exceeded.',
        retryAfterSeconds: Math.ceil((existing.resetAtMs - now) / 1000)
      });
    }
    existing.count += 1;
    return next();
  };
}

export function securityHeadersMiddleware(): express.RequestHandler {
  const configuredOrigins = (
    process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const origin = req.headers.origin;
    if (origin && (configuredOrigins.includes(origin) || origin.startsWith('http://localhost:'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  };
}

export function buildSeedAlerts(params: {
  faults: ActiveFault[];
  assets: InfrastructureAsset[];
  issues: DataQualityIssue[];
  aiSnapshot: AiIntelligenceSnapshot;
}): GridAlert[] {
  const assetById = new Map(params.assets.map((a) => [a.canonicalId, a]));
  const alerts: GridAlert[] = [];

  for (const fault of params.faults) {
    if (fault.status === 'RESTORED') continue;
    const asset = assetById.get(fault.affectedAssetId);
    const location = asset
      ? `${asset.area}, ${asset.district}, ${asset.state}`
      : fault.affectedSubstationId || 'Grid Region';
    alerts.push({
      id: `ALT-${fault.faultCode}`,
      title: fault.title,
      assetId: fault.affectedAssetId,
      assetName: fault.affectedAssetName,
      locationLabel: location,
      severity: fault.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      category: 'OUTAGE_FAULT',
      timestamp: fault.detectedAt,
      recommendedAction:
        'Open Event Reconstruction & run What-If Load Transfer simulation before Manager review.',
      acknowledged: false,
      targetView: 'map',
      source: fault.source
    });
  }

  for (const rec of params.aiSnapshot.recommendations.slice(0, 3)) {
    const asset = assetById.get(rec.assetId);
    const location = asset
      ? `${asset.area}, ${asset.district}, ${asset.state}`
      : 'Regional Grid';
    alerts.push({
      id: `ALT-AI-${rec.id}`,
      title: `AI Health Warning: ${rec.assetName} (Score ${rec.healthScore}/100)`,
      assetId: rec.assetId,
      assetName: rec.assetName,
      locationLabel: location,
      severity: rec.priority === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      category: 'AI_RISK',
      timestamp: rec.createdAt,
      recommendedAction: rec.recommendation,
      acknowledged: false,
      targetView: rec.targetView,
      source: rec.source
    });
  }

  for (const issue of params.issues.filter((i) => i.status === 'DETECTED')) {
    const asset = assetById.get(issue.canonicalAssetId);
    const location = asset
      ? `${asset.area}, ${asset.district}, ${asset.state}`
      : 'Canonical Registry';
    alerts.push({
      id: `ALT-DQI-${issue.id}`,
      title: `Data Integrity Conflict: ${issue.conflictingValueA} vs ${issue.conflictingValueB}`,
      assetId: issue.canonicalAssetId,
      assetName: issue.assetName,
      locationLabel: location,
      severity: 'MEDIUM',
      category: 'DATA_INTEGRITY',
      timestamp: issue.detectedAt,
      recommendedAction:
        'Verify canonical identifier in Data Integrity Workbench before issuing switching orders.',
      acknowledged: false,
      targetView: 'integrity',
      source: issue.source
    });
  }

  alerts.push({
    id: 'ALT-SYS-WS-READY',
    title: 'Real-Time SCADA & WebSocket Telemetry Pipeline Operational',
    assetId: 'SUB-TG-06U',
    assetName: 'Madhapur 132/33 kV Substation (DEMO)',
    locationLabel: 'HITEC City, Hyderabad, Telangana',
    severity: 'INFO',
    category: 'SYSTEM_SECURITY',
    timestamp: new Date().toISOString(),
    recommendedAction:
      'Live WebSocket stream active with RBAC JWT token enforcement enabled.',
    acknowledged: true,
    targetView: 'overview',
    source: 'DEMO'
  });

  return alerts;
}
