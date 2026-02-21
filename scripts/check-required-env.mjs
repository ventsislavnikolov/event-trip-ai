import { readFileSync } from "node:fs";
import { parse as parseDotenv } from "dotenv";

const PROFILES = {
  local: {
    required: ["AUTH_SECRET", "POSTGRES_URL"],
    optional: [
      "AI_GATEWAY_API_KEY",
      "REDIS_URL",
      "BLOB_READ_WRITE_TOKEN",
      "EVENTTRIP_INTENT_PRIMARY_MODEL",
      "EVENTTRIP_INTENT_FALLBACK_MODEL",
      "TICKETMASTER_API_KEY",
      "SEATGEEK_CLIENT_ID",
      "SEATGEEK_CLIENT_SECRET",
      "TRAVELPAYOUTS_API_TOKEN",
      "TRAVELPAYOUTS_MARKER",
    ],
  },
  "vercel-preview": {
    required: ["AUTH_SECRET", "POSTGRES_URL"],
    optional: [
      "AI_GATEWAY_API_KEY",
      "REDIS_URL",
      "BLOB_READ_WRITE_TOKEN",
      "EVENTTRIP_INTENT_PRIMARY_MODEL",
      "EVENTTRIP_INTENT_FALLBACK_MODEL",
      "TICKETMASTER_API_KEY",
      "SEATGEEK_CLIENT_ID",
      "SEATGEEK_CLIENT_SECRET",
      "TRAVELPAYOUTS_API_TOKEN",
      "TRAVELPAYOUTS_MARKER",
    ],
  },
  "vercel-production": {
    required: ["AUTH_SECRET", "POSTGRES_URL"],
    optional: [
      "AI_GATEWAY_API_KEY",
      "REDIS_URL",
      "BLOB_READ_WRITE_TOKEN",
      "EVENTTRIP_INTENT_PRIMARY_MODEL",
      "EVENTTRIP_INTENT_FALLBACK_MODEL",
      "TICKETMASTER_API_KEY",
      "SEATGEEK_CLIENT_ID",
      "SEATGEEK_CLIENT_SECRET",
      "TRAVELPAYOUTS_API_TOKEN",
      "TRAVELPAYOUTS_MARKER",
    ],
  },
  providers: {
    required: [
      "TICKETMASTER_API_KEY",
      "SEATGEEK_CLIENT_ID",
      "SEATGEEK_CLIENT_SECRET",
      "TRAVELPAYOUTS_API_TOKEN",
      "TRAVELPAYOUTS_MARKER",
    ],
    optional: [],
  },
};

function normalizeProfileName(value) {
  const normalized = (value || "").trim().toLowerCase();

  if (normalized in PROFILES) {
    return normalized;
  }

  return null;
}

function isProvided(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function loadLocalEnvFile(envFilePath) {
  try {
    const fileContents = readFileSync(envFilePath, "utf8");
    return parseDotenv(fileContents);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    throw error;
  }
}

function resolveEnvironmentForProfile({ env, profile, envFilePath }) {
  if (profile !== "local") {
    return env;
  }

  const localEnvValues = loadLocalEnvFile(envFilePath);

  // Shell-exported values should win over file values.
  return {
    ...localEnvValues,
    ...env,
  };
}

export function evaluateEnvironment({ env, profile }) {
  const normalizedProfile = normalizeProfileName(profile);

  if (!normalizedProfile) {
    throw new Error(
      `Unknown profile '${profile}'. Expected one of: ${Object.keys(PROFILES).join(", ")}.`
    );
  }

  const definition = PROFILES[normalizedProfile];
  const missingRequired = definition.required.filter(
    (key) => !isProvided(env[key])
  );

  return {
    profile: normalizedProfile,
    required: definition.required,
    optional: definition.optional,
    missingRequired,
    ok: missingRequired.length === 0,
  };
}

export function formatFailureMessage(result) {
  return [
    `Missing required environment variables for profile '${result.profile}':`,
    ...result.missingRequired.map((key) => `- ${key}`),
    "",
    "Set missing values in your local shell/.env.local or in Vercel env configuration.",
    "Reference: docs/runbooks/vercel-secrets-policy.md",
  ].join("\n");
}

export function runCli({
  argv = process.argv.slice(2),
  env = process.env,
  envFilePath = ".env.local",
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const requestedProfile = argv[0] || "local";
  const resolvedProfile = normalizeProfileName(requestedProfile);

  let evaluation;

  try {
    const resolvedEnv = resolveEnvironmentForProfile({
      env,
      profile: resolvedProfile,
      envFilePath,
    });

    evaluation = evaluateEnvironment({
      env: resolvedEnv,
      profile: requestedProfile,
    });
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (!evaluation.ok) {
    stderr(formatFailureMessage(evaluation));
    return 1;
  }

  stdout(
    `Environment check passed for profile '${evaluation.profile}'. Required keys present: ${evaluation.required.join(", ")}.`
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runCli());
}
