export type DemoScenario =
  | "default"
  | "empty"
  | "slow"
  | "missing-detail"
  | "read-failure"
  | "write-failure"
  | "auth-failure";

const STORAGE_KEY = "snippets-demo:scenario:v1";

const VALID_SCENARIOS: ReadonlySet<string> = new Set<DemoScenario>([
  "default",
  "empty",
  "slow",
  "missing-detail",
  "read-failure",
  "write-failure",
  "auth-failure",
]);

let memoryScenario: DemoScenario = "default";

function isScenario(value: string | null): value is DemoScenario {
  return value !== null && VALID_SCENARIOS.has(value);
}

function stripScenarioFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("scenario")) return;
  url.searchParams.delete("scenario");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function persist(scenario: DemoScenario): void {
  memoryScenario = scenario;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, scenario);
  } catch {
    memoryScenario = scenario;
  }
}

export function getScenario(): DemoScenario {
  if (typeof window === "undefined") return memoryScenario;

  const fromUrl = new URLSearchParams(window.location.search).get("scenario");
  if (isScenario(fromUrl)) {
    persist(fromUrl);
    return fromUrl;
  }

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return isScenario(stored) ? stored : "default";
  } catch {
    return memoryScenario;
  }
}

export function setScenario(scenario: DemoScenario): void {
  if (typeof window === "undefined") return;
  stripScenarioFromUrl();
  persist(scenario);
}

export function clearScenario(): void {
  memoryScenario = "default";
  if (typeof window === "undefined") return;
  stripScenarioFromUrl();
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    memoryScenario = "default";
  }
}

export const SCENARIO_LABELS: Readonly<Record<DemoScenario, string>> = {
  default: "Default",
  empty: "Empty library",
  slow: "Slow reads",
  "missing-detail": "Missing detail",
  "read-failure": "Read failure",
  "write-failure": "Rejected write",
  "auth-failure": "Auth failure",
};
