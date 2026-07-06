import { test, expect } from "../fixtures/test";

import { checkApiHealth } from "../fixtures/api";
import {
  createWorkspace,
  getReadiness,
  listWorkspaces,
  seedSampleWorkspace,
} from "../fixtures/workspace";

test.describe.serial("fixtures and isolated data", () => {
  test("API health check helper works", async ({ request }) => {
    await checkApiHealth(request);
  });

  test("workspace list starts empty on fresh E2E database", async ({ request }) => {
    const list = await listWorkspaces(request);
    expect(list.total).toBe(0);
    expect(list.workspaces).toHaveLength(0);
  });

  test("seed-sample creates the bundled demo workspace", async ({ request }) => {
    const detail = await seedSampleWorkspace(request);
    expect(detail.workspace.id).toBeTruthy();
    expect(detail.current_version.worksheet.working_name).toBe("Validation OS");
    expect(detail.assumptions.length).toBeGreaterThan(0);

    const list = await listWorkspaces(request);
    expect(list.total).toBe(1);
    expect(list.workspaces[0]?.working_name).toBe("Validation OS");
  });

  test("createWorkspace and getReadiness are repeatable", async ({ request }) => {
    const detail = await createWorkspace(request, {
      worksheet: { working_name: "E2E Fixture Workspace" },
    });
    const readiness = await getReadiness(request, detail.workspace.id);
    expect(readiness.checks.length).toBeGreaterThan(0);
    expect(typeof readiness.can_run_judges).toBe("boolean");

    const list = await listWorkspaces(request);
    expect(list.total).toBe(2);
    const names = list.workspaces.map((ws) => ws.working_name);
    expect(names).toContain("Validation OS");
    expect(names).toContain("E2E Fixture Workspace");
  });
});
