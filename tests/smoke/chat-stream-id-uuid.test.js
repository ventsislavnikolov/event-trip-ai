import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routeFilePath = path.resolve(
  process.cwd(),
  "app/(chat)/api/chat/route.ts"
);

function extractStreamBlock(source, variableName) {
  const streamDeclaration = `const ${variableName} = createUIMessageStream<ChatMessage>({`;
  const startIndex = source.indexOf(streamDeclaration);
  if (startIndex < 0) {
    return null;
  }

  const nextReturnIndex = source.indexOf(
    "return createUIMessageStreamResponse",
    startIndex
  );
  if (nextReturnIndex < 0) {
    return source.slice(startIndex);
  }

  return source.slice(startIndex, nextReturnIndex);
}

test("EventTrip response streams set generateId for UUID-safe message persistence", () => {
  const source = fs.readFileSync(routeFilePath, "utf8");

  const followUpBlock = extractStreamBlock(source, "followUpStream");
  const eventTripBlock = extractStreamBlock(source, "eventTripResultStream");

  assert.ok(followUpBlock, "followUpStream declaration was not found");
  assert.ok(
    /generateId:\s*generateUUID/.test(followUpBlock),
    "followUpStream is missing generateId: generateUUID"
  );

  assert.ok(eventTripBlock, "eventTripResultStream declaration was not found");
  assert.ok(
    /generateId:\s*generateUUID/.test(eventTripBlock),
    "eventTripResultStream is missing generateId: generateUUID"
  );
});
