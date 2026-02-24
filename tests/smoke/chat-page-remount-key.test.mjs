import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const pageFilePath = path.resolve(
  process.cwd(),
  "app/(chat)/chat/[id]/page.tsx"
);

test("chat detail page keys Chat component by chat id", () => {
  const source = fs.readFileSync(pageFilePath, "utf8");

  assert.match(source, /<Chat[\s\S]*key=\{chat\.id\}/);
});
