type PostgresEnv = {
  [key: string]: string | undefined;
  POSTGRES_URL?: string;
};

type ResolveOptions = {
  required?: boolean;
};

export function resolvePostgresUrl(
  env: PostgresEnv = process.env,
  options: ResolveOptions = {}
): string | null {
  const required = options.required ?? true;
  const url = env.POSTGRES_URL?.trim();

  if (url) {
    return url;
  }

  if (required) {
    throw new Error(
      "POSTGRES_URL is required. Configure Supabase Postgres connection string."
    );
  }

  return null;
}
