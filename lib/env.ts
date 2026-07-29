/**
 * What a real deployment must have, and what happens when it does not.
 *
 * The local JSON store is a gift in development — clone, `npm run dev`, and the
 * app works before any cloud exists. Deployed, it is a hazard: no sign-in, one
 * shared set of figures for every visitor, and a filesystem that a serverless
 * host throws away between requests. A typo in one environment variable is all
 * it takes to turn a private ledger into a public one.
 *
 * So in production the fallback does not exist. A missing variable stops the
 * request with a message naming what is missing, rather than quietly serving
 * somebody else's money to whoever asked.
 */

export const isProduction = process.env.NODE_ENV === 'production';

/** Required for the app to have accounts at all. */
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/**
 * Required for anyone to sign up: codes are minted by us and sent over our own
 * SMTP, so without mail the first screen of the app is a dead end.
 */
const REQUIRED_FOR_SIGNUP = ['MAIL_USER', 'GOOGLE_APP_PASSWORD'] as const;

function present(name: string): boolean {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '';
}

/** Names of the variables a production deployment is missing. */
export function missingProductionEnv(): string[] {
  const missing = REQUIRED.filter((name) => {
    if (name === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') {
      return !present(name) && !present('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    return !present(name);
  }) as string[];

  return [...missing, ...REQUIRED_FOR_SIGNUP.filter((name) => !present(name))];
}

export class ProductionEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `This deployment is not configured: ${missing.join(', ')} ${
        missing.length === 1 ? 'is' : 'are'
      } missing. Refusing to serve, because the alternative is running on the ` +
        'local file store with no accounts and no isolation between visitors.',
    );
    this.name = 'ProductionEnvError';
  }
}

/**
 * Called on the paths that would otherwise fall back — reading data, and the
 * proxy that decides whether anyone needs to sign in. Checked per request
 * rather than at import, so a build without secrets still succeeds and only a
 * misconfigured *deployment* fails.
 */
export function assertProductionEnv(): void {
  if (!isProduction) return;
  const missing = missingProductionEnv();
  if (missing.length > 0) throw new ProductionEnvError(missing);
}
