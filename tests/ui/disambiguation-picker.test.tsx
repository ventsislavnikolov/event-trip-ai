import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DisambiguationPicker } from "../../components/eventtrip/disambiguation-picker";

test("renders disambiguation candidates", () => {
  const html = renderToStaticMarkup(
    <DisambiguationPicker
      candidates={[
        {
          id: "evt-1",
          name: "Tomorrowland 2026",
          location: "Boom, Belgium",
          startsAt: "2026-07-18",
        },
        {
          id: "evt-2",
          name: "Tomorrowland Winter 2026",
          location: "Alpe d'Huez, France",
          startsAt: "2026-03-21",
        },
      ]}
      onSelect={() => undefined}
    />
  );

  assert.match(html, /multiple matches/i);
  assert.match(html, /Tomorrowland 2026/);
  assert.match(html, /Tomorrowland Winter 2026/);
  assert.match(html, /Boom, Belgium/);
});
