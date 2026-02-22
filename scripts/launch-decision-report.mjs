import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_COMMAND = "pnpm -s launch:readiness -- --skip-e2e";

export function extractFailedChecks(output) {
  const lines = output.split("\n");
  const failedChecks = [];
  let inFailedSection = false;

  for (const line of lines) {
    if (line.trim() === "Failed checks:") {
      inFailedSection = true;
      continue;
    }

    if (!inFailedSection) {
      continue;
    }

    if (!line.trim()) {
      break;
    }

    if (line.startsWith("- ")) {
      failedChecks.push(line.replace("- ", "").trim());
      continue;
    }

    if (line.startsWith("Resolve blockers")) {
      break;
    }
  }

  return failedChecks;
}

export function buildDecisionSummary({ exitCode, output }) {
  const failedChecks = extractFailedChecks(output);
  const decision = exitCode === 0 ? "GO" : "NO-GO";

  return {
    decision,
    failedChecks,
    exitCode,
  };
}

export function formatLaunchDecisionMarkdown({
  generatedAt,
  gitBranch,
  gitSha,
  command,
  summary,
  rawOutput,
}) {
  const failedChecksSection =
    summary.failedChecks.length > 0
      ? summary.failedChecks.map((check) => `- \`${check}\``).join("\n")
      : "- None";

  return `# Launch Decision Review

- Generated at: \`${generatedAt}\`
- Branch: \`${gitBranch}\`
- Commit: \`${gitSha}\`
- Command: \`${command}\`
- Decision: \`${summary.decision}\`
- Exit code: \`${summary.exitCode}\`

## Failed Checks

${failedChecksSection}

## Raw Output

\`\`\`text
${rawOutput.trim()}
\`\`\`
`;
}

function runCommand(command) {
  const result = spawnSync("zsh", ["-lc", command], {
    encoding: "utf8",
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const mergedOutput = [stdout, stderr].filter(Boolean).join("\n");

  return {
    exitCode: result.status ?? 1,
    output: mergedOutput,
  };
}

function readGitValue(command, fallback = "unknown") {
  const result = spawnSync("zsh", ["-lc", command], { encoding: "utf8" });
  if (result.status !== 0) {
    return fallback;
  }
  const value = result.stdout?.trim();
  return value || fallback;
}

export function runLaunchDecisionReport({
  command = DEFAULT_COMMAND,
  outputPath,
  now = new Date(),
} = {}) {
  const runResult = runCommand(command);
  const summary = buildDecisionSummary({
    exitCode: runResult.exitCode,
    output: runResult.output,
  });

  const generatedAt = now.toISOString();
  const dateLabel = generatedAt.slice(0, 10);
  const gitBranch = readGitValue("git branch --show-current");
  const gitSha = readGitValue("git rev-parse --short HEAD");
  const finalOutputPath =
    outputPath ??
    resolve(process.cwd(), `docs/runbooks/launch-decision-${dateLabel}.md`);

  const markdown = formatLaunchDecisionMarkdown({
    generatedAt,
    gitBranch,
    gitSha,
    command,
    summary,
    rawOutput: runResult.output || "(no output)",
  });

  mkdirSync(dirname(finalOutputPath), { recursive: true });
  writeFileSync(finalOutputPath, markdown, "utf8");

  return {
    ...summary,
    outputPath: finalOutputPath,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runLaunchDecisionReport();
  console.log(`Decision: ${result.decision}`);
  console.log(`Report: ${result.outputPath}`);
  process.exit(0);
}
