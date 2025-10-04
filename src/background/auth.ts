export interface AuthStatusOptions {
  includeToken?: boolean;
}

export interface AuthStatus {
  authenticated: boolean;
  premium: boolean;
  token?: string | null;
  expiresAt?: string | null;
}

export interface AuthManagerOptions {
  jwksUri?: string;
  fetcher?: typeof fetch;
}

interface JWKSKey {
  kid?: string;
  kty?: string;
  alg?: string;
  [key: string]: unknown;
}

interface JWKSResponse {
  keys?: JWKSKey[];
}

interface JwtPayload {
  exp?: number;
  sub?: string;
  plan?: string;
  tier?: string;
  premium?: boolean;
  roles?: string[];
  [key: string]: unknown;
}

function decodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    if (typeof atob === 'function') {
      return atob(padded);
    }
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch (error) {
    throw new Error('Invalid base64url payload');
  }
}

function parseJwt(token: string): JwtPayload {
  const segments = token.split('.');
  if (segments.length < 2) {
    throw new Error('JWT must have at least two segments');
  }

  const payload = segments[1];
  const decoded = decodeBase64Url(payload);
  const parsed = JSON.parse(decoded) as JwtPayload;
  return parsed;
}

function isExpired(exp?: number) {
  if (!exp) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds;
}

function computePremium(payload: JwtPayload): boolean {
  if (payload.premium === true) {
    return true;
  }
  if (typeof payload.plan === 'string' && payload.plan.toLowerCase().includes('premium')) {
    return true;
  }
  if (typeof payload.tier === 'string' && payload.tier.toLowerCase().includes('pro')) {
    return true;
  }
  if (Array.isArray(payload.roles)) {
    return payload.roles.some((role) => role.toLowerCase().includes('premium'));
  }
  return false;
}

export class AuthManager {
  private token: string | null = null;
  private expiresAt: string | null = null;
  private premium = false;
  private readonly jwksUri?: string;
  private jwks: JWKSKey[] = [];
  private readonly fetcher: typeof fetch;

  constructor(options: AuthManagerOptions = {}) {
    this.jwksUri = options.jwksUri;
    this.fetcher = options.fetcher ?? fetch;
  }

  async initialize() {
    if (this.jwksUri) {
      await this.refreshKeys().catch((error) => {
        console.warn('[ai-companion] failed to load JWKS', error);
      });
    }
  }

  async refreshKeys() {
    if (!this.jwksUri) {
      return;
    }

    const response = await this.fetcher(this.jwksUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS (${response.status})`);
    }

    const body = (await response.json()) as JWKSResponse;
    this.jwks = Array.isArray(body.keys) ? body.keys : [];
  }

  setToken(token: string) {
    const payload = parseJwt(token);
    if (isExpired(payload.exp)) {
      throw new Error('JWT is expired');
    }

    this.token = token;
    this.expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
    this.premium = computePremium(payload);
  }

  clearToken() {
    this.token = null;
    this.expiresAt = null;
    this.premium = false;
  }

  getStatus(options: AuthStatusOptions = {}): AuthStatus {
    const authenticated = Boolean(this.token && (!this.expiresAt || new Date(this.expiresAt) > new Date()));

    return {
      authenticated,
      premium: authenticated ? this.premium : false,
      token: options.includeToken ? this.token : undefined,
      expiresAt: this.expiresAt
    };
  }

  hasKey(kid: string) {
    return this.jwks.some((key) => key.kid === kid);
  }
}

export function createAuthManager(options: AuthManagerOptions = {}) {
  return new AuthManager(options);
}
