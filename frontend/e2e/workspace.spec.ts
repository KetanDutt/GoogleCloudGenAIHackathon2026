import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function demo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore a demo workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Prepare the product launch brief", { exact: true }),
  ).toBeVisible();
}
async function navigate(page: Page, name: string) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  const link = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name, exact: true });
  const destination = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(destination!);
}

test("private demo, responsive navigation, and keyboard-accessible pages", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await demo(page);
  for (const [name, heading] of [
    ["Tasks", "Your tasks"],
    ["Notes", "A place for your thoughts"],
    ["Calendar", "Your calendar"],
    ["Reminders", "Keep it on your radar"],
    ["AI assistant", "Let’s find a way forward."],
  ]) {
    await navigate(page, name);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("create, complete, reopen, edit and delete a task without losing dates", async ({
  page,
}) => {
  await demo(page);
  await navigate(page, "Tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Browser task with a date");
  await page.getByLabel("Due date").fill("2027-01-07T09:30");
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const checkbox = page.getByRole("checkbox", {
    name: "Mark Browser task with a date complete",
    exact: true,
  });
  await checkbox.check();
  await expect(
    page.getByRole("checkbox", {
      name: "Mark Browser task with a date incomplete",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: "Mark Browser task with a date incomplete",
      exact: true,
    }),
  ).toBeEnabled();
  await page.reload();
  await page
    .getByRole("checkbox", {
      name: "Mark Browser task with a date incomplete",
      exact: true,
    })
    .uncheck();
  await expect(checkbox).not.toBeChecked();
  await page
    .getByRole("button", { name: "Edit Browser task with a date", exact: true })
    .click();
  await expect(page.getByLabel("Due date")).toHaveValue("2027-01-07T09:30");
  await page.getByLabel("Title", { exact: true }).fill("Renamed browser task");
  await page.getByLabel("Due date").fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Renamed browser task", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Renamed browser task", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Renamed browser task", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByText("Renamed browser task", { exact: true }),
  ).toHaveCount(0);
});

test("notes can be created, searched, edited, and deleted", async ({
  page,
}) => {
  await demo(page);
  await navigate(page, "Notes");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Meeting browser test");
  await page
    .getByLabel("Your note", { exact: true })
    .fill("A clear note with useful context.");
  await page.getByRole("button", { name: "Create note", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search notes" })
    .fill("Meeting browser test");
  await page
    .getByRole("button", { name: "Open Meeting browser test", exact: true })
    .click();
  await expect(page.getByLabel("Your note", { exact: true })).toHaveValue(
    "A clear note with useful context.",
  );
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Updated source content.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Updated source content.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Meeting browser test", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No notes match that thought" }),
  ).toBeVisible();
});

test("calendar validates dates and reminders can be reopened", async ({
  page,
}) => {
  await demo(page);
  await navigate(page, "Calendar");
  const today = new Date().toISOString().slice(0, 10);
  await page.getByRole("button", { name: "New event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Browser focus event");
  await page.getByLabel("Starts", { exact: true }).fill(`${today}T14:00`);
  await page.getByLabel("Ends", { exact: true }).fill(`${today}T13:00`);
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "end time after",
  );
  await page.getByLabel("Ends", { exact: true }).fill(`${today}T15:00`);
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser focus event", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Browser focus event", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Updated focus event");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Updated focus event", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await navigate(page, "Reminders");
  await page.getByRole("button", { name: "New reminder", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Browser reminder");
  await page
    .getByRole("button", { name: "Create reminder", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Mark Browser reminder complete",
      exact: true,
    })
    .check();
  await expect(page.getByText("Browser reminder", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "Mark Browser reminder incomplete",
      exact: true,
    })
    .uncheck();
  await page
    .getByRole("button", { name: "On your radar", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Mark Browser reminder complete",
      exact: true,
    }),
  ).not.toBeChecked();
});

test("assistant previews do not write until confirmed and survive reload", async ({
  page,
}) => {
  await demo(page);
  const initial = (await (await page.request.get("/api/v1/tasks")).json())
    .total;
  await navigate(page, "AI assistant");
  await page
    .getByRole("textbox", { name: "Message your assistant" })
    .fill("Add task: Browser confirmation check");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Ready for your review", { exact: true }),
  ).toBeVisible();
  expect((await (await page.request.get("/api/v1/tasks")).json()).total).toBe(
    initial,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Confirm & save", exact: true })
    .click();
  await expect(
    page.getByText("Saved to your workspace", { exact: true }),
  ).toBeVisible();
  expect((await (await page.request.get("/api/v1/tasks")).json()).total).toBe(
    initial + 1,
  );
  await page
    .getByRole("textbox", { name: "Message your assistant" })
    .fill("Remind me to check the discarded proposal");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(
    page.getByText("Proposal discarded", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A busy mind, meet a clear plan." }),
  ).toBeVisible();
  expect((await (await page.request.get("/api/v1/tasks")).json()).total).toBe(
    initial + 1,
  );
});

test("API failures are visible and retryable rather than empty success states", async ({
  page,
}) => {
  await demo(page);
  await page.route("**/api/v1/tasks?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Temporary storage failure" }),
    }),
  );
  await navigate(page, "Tasks");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Temporary storage failure",
  );
  await page.unroute("**/api/v1/tasks?**");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("Prepare the product launch brief", { exact: true }),
  ).toBeVisible();
});

test("account signup, profile save, data export, and permanent deletion", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Your name", { exact: true }).fill("Browser User");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`browser-${crypto.randomUUID()}@example.com`);
  const password = "browser test unique passphrase";
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create your workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Browser/,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  expect(
    (await page.context().cookies()).find((cookie) =>
      cookie.name.endsWith("aiops_session"),
    )?.httpOnly,
  ).toBe(true);
  await page.goto("/profile");
  await page.getByLabel("Your name", { exact: true }).fill("Updated User");
  await page
    .getByLabel("Assistant timezone", { exact: true })
    .fill("Asia/Kolkata");
  await page.getByLabel("Avatar", { exact: true }).selectOption("5");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByText("Your preferences are saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Avatar", { exact: true })).toHaveValue("5");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export my data", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ai-ops-export.json");
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Current password", { exact: true })
    .fill(password);
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete everything", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test("key screens and dialogs meet automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await demo(page);
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeFocused();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  for (const section of [
    "Tasks",
    "Notes",
    "Calendar",
    "Reminders",
    "AI assistant",
  ]) {
    await navigate(page, section);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations, `${section} in dark mode`).toEqual([]);
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const lightAudit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(lightAudit.violations, `${section} in light mode`).toEqual([]);
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  }
});

test("keyboard workspace search navigates to the matching task", async ({
  page,
}) => {
  await demo(page);
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("searchbox", { name: "Search workspace" })
    .fill("product launch");
  await dialog
    .getByRole("button", { name: /Prepare the product launch brief/ })
    .click();
  await expect(page).toHaveURL(/\/tasks\?q=/);
  await expect(
    page.getByRole("searchbox", { name: "Search tasks" }),
  ).toHaveValue("Prepare the product launch brief");
  await expect(
    page.getByText("Prepare the product launch brief", { exact: true }),
  ).toBeVisible();
});

test("failed writes roll back feedback and expired sessions leave the private workspace", async ({
  page,
}) => {
  await demo(page);
  await navigate(page, "Tasks");
  const task = "Prepare the product launch brief";
  await page.route("**/api/v1/tasks/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Simulated write failure" }),
    });
  });
  await page
    .getByRole("checkbox", { name: `Mark ${task} complete`, exact: true })
    .check();
  await expect(
    page.getByText("Simulated write failure", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: `Mark ${task} complete`, exact: true }),
  ).not.toBeChecked();
  await page.unroute("**/api/v1/tasks/*");
  await page.context().clearCookies();
  await page
    .getByRole("button", { name: "Refresh tasks", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.getByText(task, { exact: true })).toHaveCount(0);
});
