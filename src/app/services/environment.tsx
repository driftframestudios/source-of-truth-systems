import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EnvironmentId, EnvironmentProfile, DataClass } from '../types/access';
import { ENVIRONMENTS, getEnvironment as environmentProfile } from './accessService';
import { useTheme } from '../theme/ThemeProvider';
import type { StatusPalette } from '../theme/palettes';

// ============================================================
// Environment context.
//
// The active environment tints the chrome, gates write actions,
// and controls whether PHI-class fields are masked. Views read
// `env` for the profile and use `canWrite` / `maskValue` as the
// single choke points for environment-driven behavior.
// ============================================================

interface EnvironmentContextValue {
  readonly env: EnvironmentProfile;
  readonly all: ReadonlyArray<EnvironmentProfile>;
  setEnv: (id: EnvironmentId) => void;
  /** Reads the accepted environment at command time, including before the next render. */
  getEnvironment: () => EnvironmentProfile;
  /** Whether a write of the given data class is permitted right now. */
  canWrite: (dataClass?: DataClass) => boolean;
  /** Masks a value when the environment requires PII masking. */
  maskValue: (value: string | undefined, revealed?: boolean) => string;
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);
const ENVIRONMENT_TONE: Record<EnvironmentId, keyof StatusPalette> = {
  dev: 'info', res: 'violet', stg: 'success', val: 'warning', prod: 'danger',
};

export function EnvironmentProvider({
  children,
  initial = 'res',
}: {
  children: ReactNode;
  initial?: EnvironmentId;
}) {
  const [id, setId] = useState<EnvironmentId>(initial);
  const acceptedId = useRef(initial);
  const env = useMemo(() => environmentProfile(id), [id]);

  const setEnv = useCallback((next: EnvironmentId) => {
    if (!ENVIRONMENTS.some((profile) => profile.id === next)) return;
    acceptedId.current = next;
    setId(next);
  }, []);
  const getEnvironment = useCallback(() => environmentProfile(acceptedId.current), []);

  const canWrite = useCallback(() => env.writesEnabled, [env]);

  const maskValue = useCallback(
    (value: string | undefined, revealed = false): string => {
      if (value == null || value === '') return '—';
      if (!env.piiMasked || revealed) return value;
      // Keep the last 2 chars for orientation, mask the rest.
      if (value.length <= 2) return '••';
      return `${'•'.repeat(Math.max(2, value.length - 2))}${value.slice(-2)}`;
    },
    [env],
  );

  const value = useMemo<EnvironmentContextValue>(
    () => ({ env, all: ENVIRONMENTS, setEnv, getEnvironment, canWrite, maskValue }),
    [env, setEnv, getEnvironment, canWrite, maskValue],
  );

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}

export function useEnvironment(): EnvironmentContextValue {
  const ctx = useContext(EnvironmentContext);
  const { theme } = useTheme();
  const appearance = useMemo(() => {
    if (!ctx) return null;
    const paint = (profile: EnvironmentProfile) => ({ ...profile, accent: theme.status[ENVIRONMENT_TONE[profile.id]] });
    // Environment identity and write policy stay in their existing provider;
    // only its presentation accent follows the active foreground palette.
    return { ...ctx, env: paint(ctx.env), all: ctx.all.map(paint) };
  }, [ctx, theme.status]);
  if (!appearance) throw new Error('useEnvironment must be used within an EnvironmentProvider');
  return appearance;
}
