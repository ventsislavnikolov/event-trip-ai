import { expect, type Page, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

const PLAYWRIGHT_AUTH_SECRET =
  process.env.AUTH_SECRET ?? "playwright-test-auth-secret";

function createMockUIMessageStream(text: string): string {
  return [
    'data: {"type":"start","messageId":"assistant-smoke-1"}',
    "",
    'data: {"type":"text-start","id":"text-smoke-1"}',
    "",
    `data: {"type":"text-delta","id":"text-smoke-1","delta":"${text}"}`,
    "",
    'data: {"type":"text-end","id":"text-smoke-1"}',
    "",
    'data: {"type":"finish","finishReason":"stop"}',
    "",
  ].join("\n");
}

async function authenticateTestSession(page: Page) {
  const token = await encode({
    token: {
      id: "playwright-guest-user",
      type: "guest",
      email: "guest-123",
    },
    secret: PLAYWRIGHT_AUTH_SECRET,
    salt: "authjs.session-token",
  });

  await page.context().setExtraHTTPHeaders({
    Authorization: `Bearer ${token}`,
  });
}

test.describe("Core Flow Smoke", () => {
  test("happy path: prompt submission renders assistant response", async ({
    page,
  }) => {
    await authenticateTestSession(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          "x-vercel-ai-ui-message-stream": "v1",
        },
        body: createMockUIMessageStream("Mocked trip estimate is ready."),
      });
    });

    await page.goto("/");

    await page
      .getByTestId("multimodal-input")
      .fill("Tomorrowland from Sofia for 2 travelers budget 1200");
    await page.getByTestId("send-button").click();

    await expect(page.locator("[data-role='assistant']").first()).toContainText(
      "Mocked trip estimate is ready.",
      { timeout: 15_000 }
    );
  });

  test("degraded path: chat API failure surfaces user-visible error", async ({
    page,
  }) => {
    await authenticateTestSession(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "offline:chat",
            message: "Provider timeout",
          },
        }),
      });
    });

    await page.goto("/");

    await page.getByTestId("multimodal-input").fill("Test degraded mode");
    await page.getByTestId("send-button").click();

    await expect(page.getByText(/error|failed|trouble/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
