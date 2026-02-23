import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routeFilePath = path.resolve(
  process.cwd(),
  "app/(chat)/api/chat/route.ts"
);

test("EventTrip selection-required branch streams candidates without package cards", () => {
  const source = fs.readFileSync(routeFilePath, "utf8");

  assert.match(
    source,
    /if\s*\(!pipelineResult\.selectionRequired\)\s*{\s*writer\.write\(\{\s*type:\s*"data-eventtripPackages"/s
  );
  assert.match(
    source,
    /I found multiple matching events\. Choose one event to continue pricing\./
  );
});
