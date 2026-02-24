import { spawnSync } from "node:child_process";

const LOCAL_CHECKS = [
  {
    id: "lint",
    label: "Lint",
    command: "pnpm -s lint",
  },
  {
    id: "typecheck",
    label: "Typecheck",
    command: "pnpm exec tsc --noEmit",
  },
  {
    id: "smoke-and-unit",
    label: "Smoke and unit suite",
    command: [
      "node --test tests/smoke/template-baseline.test.js tests/smoke/mvp-surface.test.js tests/smoke/chat-stream-id-uuid.test.js tests/smoke/chat-selection-required-stream.test.js tests/smoke/chat-page-remount-key.test.mjs",
      "pnpm exec tsx --test \\",
      "  tests/db/connection.test.ts \\",
      "  tests/intent/parse-intent.test.ts \\",
      "  tests/intent/chat-intent-gate.test.ts \\",
      "  tests/eventtrip/history-summary.test.ts \\",
      "  tests/eventtrip/hydrate-messages.test.ts \\",
      "  tests/packages/ranking.test.ts \\",
      "  tests/providers/airport-code-resolver.test.ts \\",
      "  tests/providers/curated-index.test.ts \\",
      "  tests/providers/provider-adapters.test.ts \\",
      "  tests/providers/collector.test.ts \\",
      "  tests/ui/package-cards.test.tsx \\",
      "  tests/ui/disambiguation-picker.test.tsx \\",
      "  tests/ui/selected-event-summary.test.tsx",
    ].join("\n"),
  },
  {
    id: "build",
    label: "Production build",
    command: "pnpm build",
  },
  {
    id: "e2e-core-flow",
    label: "Core flow e2e",
    command:
      "pnpm exec playwright test tests/e2e/core-flow.test.ts --project=e2e --workers=1 --reporter=dot",
    env: {
      CI: "1",
    },
  },
];

const DEPLOY_CHECKS = [
  {
    id: "vercel-auth",
    label: "Vercel authentication",
    command: "pnpm dlx vercel whoami",
  },
  {
    id: "env-check-preview",
    label: "Preview environment keys",
    command: [
      "mkdir -p .vercel",
      "pnpm dlx vercel env pull .vercel/.env.preview --environment=preview --yes >/dev/null",
      "set -a",
      "source .vercel/.env.preview",
      "set +a",
      "pnpm -s env:check:preview",
    ].join("\n"),
  },
  {
    id: "env-check-production",
    label: "Production environment keys",
    command: [
      "mkdir -p .vercel",
      "pnpm dlx vercel env pull .vercel/.env.production --environment=production --yes >/dev/null",
      "set -a",
      "source .vercel/.env.production",
      "set +a",
      "pnpm -s env:check:production",
    ].join("\n"),
  },
];

function usage() {
  return [
    "Usage: node scripts/launch-readiness.mjs [options]",
    "",
    "Options:",
    "  --local-only   Run only local readiness checks (skip Vercel auth/env checks)",
    "  --skip-e2e     Skip Playwright core-flow e2e check",
    "  --help         Show help",
  ].join("\n");
}

export function parseLaunchReadinessArgs(argv) {
  const parsed = {
    localOnly: false,
    skipE2E: false,
    help: false,
  };

  for (const argument of argv) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--local-only") {
      parsed.localOnly = true;
      continue;
    }

    if (argument === "--skip-e2e") {
      parsed.skipE2E = true;
      continue;
    }

    if (argument === "--help") {
      parsed.help = true;
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return parsed;
}

export function buildLaunchReadinessChecks({ localOnly, skipE2E }) {
  const checks = LOCAL_CHECKS.filter(
    (check) => !(skipE2E && check.id === "e2e-core-flow")
  );

  if (!localOnly) {
    checks.push(...DEPLOY_CHECKS);
  }

  return checks;
}

function defaultRunCheck(check) {
  const result = spawnSync("zsh", ["-lc", check.command], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...(check.env ?? {}),
    },
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function formatCheckOutput(output) {
  const text = output.trim();
  if (!text) {
    return null;
  }
  const maxLength = 600;
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n... (truncated)`;
}

export function runLaunchReadiness({
  argv = process.argv.slice(2),
  runCheck = defaultRunCheck,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  let parsed;

  try {
    parsed = parseLaunchReadinessArgs(argv);
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    stderr("");
    stderr(usage());
    return 1;
  }

  if (parsed.help) {
    stdout(usage());
    return 0;
  }

  const checks = buildLaunchReadinessChecks(parsed);
  const failures = [];

  stdout(`Running ${checks.length} launch readiness checks...`);

  for (const check of checks) {
    stdout(`\n[${check.id}] ${check.label}`);

    let result;
    try {
      result = runCheck(check);
    } catch (error) {
      result = {
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      };
    }

    if (result.exitCode === 0) {
      stdout("PASS");
      continue;
    }

    stderr("FAIL");
    const output =
      formatCheckOutput(result.stderr) ?? formatCheckOutput(result.stdout);
    if (output) {
      stderr(output);
    }
    failures.push(check);
  }

  if (failures.length > 0) {
    stderr("\nFailed checks:");
    for (const check of failures) {
      stderr(`- ${check.id}: ${check.label}`);
    }
    stderr("\nResolve blockers and rerun `pnpm launch:readiness`.");
    return 1;
  }

  stdout("\nAll launch readiness checks passed.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runLaunchReadiness());
}
