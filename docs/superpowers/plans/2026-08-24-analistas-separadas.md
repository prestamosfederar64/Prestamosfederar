# Separación de analistas Magali/Victoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate `index.html`'s single shared shop list into two fully independent, switchable analyst contexts (Magali/Victoria) — data, markers, filters, stats — with a safe one-time migration of existing `localStorage` data, richer combinable filters (text/zone/status/date range), and a robust map autofit, without adding frameworks or breaking existing functionality.

**Architecture:** Extract all DOM-free logic (analyst config/validation, v1→v2 migration, filter matchers, date-range comparison) into a new zero-dependency module `js/core.js` that works both in the browser (`window.Core`) and in plain Node (`module.exports`) so it can be unit-tested with Node's built-in `assert` — no test framework added. `index.html` keeps its single inline `<script>` for DOM/Leaflet wiring, now driven by a `state` object (`activeAnalyst`, per-analyst shop data, per-analyst in-memory filters) instead of a single global `shops` array.

**Tech Stack:** Vanilla HTML/CSS/JS, Leaflet 1.9.4 (unchanged, via existing CDN `<script>` tags), Node.js built-in `assert` for logic tests (dev-only, not shipped to the page). No new runtime dependencies.

Full design rationale: `docs/superpowers/specs/2026-08-24-analistas-separadas-design.md`.

---

## File Structure

- **Create:** `js/core.js` — pure functions with no DOM/`window` dependency: `ANALYSTS`, `isValidAnalystId`, `getSafeActiveAnalyst`, `migrateLegacyData`, `inRange`, `toEpoch`, `matchesDateRange`, `normalizeText`, `matchesSearch`, `matchesZone`, `matchesStatus`, `filterMatchers`, `applyFilters`. Exposed as `window.Core` in the browser and via `module.exports` in Node.
- **Create:** `tests/core.test.js` — plain Node script (no framework) exercising every function in `js/core.js` via `assert`; run with `node tests/core.test.js`.
- **Modify:** `index.html` — add `<script src="js/core.js"></script>`, add CSS for the analyst selector/migration banner/filter badges/mobile filter toggle/map empty state, add the analyst tabs + active-analyst label to the header, extend the filters card (Zona/Desde/Hasta/counter/badges/clear button, remove the old free-text "Analista" filter), replace the "Analista responsable" form field with "Zona", add a map empty-state element, and rewrite the inline `<script>` to use `js/core.js` plus the new per-analyst `state` object, `L.layerGroup()` markers, and the three-way map autofit.

---

## Task 1: Core module scaffold + test harness

**Files:**
- Create: `js/core.js`
- Create: `tests/core.test.js`

- [ ] **Step 1: Create the empty, dual-environment core module**

`js/core.js`:
```js
(function (root) {
  "use strict";

  var Core = {};

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  } else {
    root.Core = Core;
  }
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 2: Create the test runner skeleton**

`tests/core.test.js`:
```js
const assert = require("assert");
const Core = require("../js/core.js");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test("Core module loads", () => {
  assert.strictEqual(typeof Core, "object");
});

if (process.exitCode) {
  console.error("\nAlgunas pruebas fallaron.");
} else {
  console.log("\nTodas las pruebas pasaron.");
}
```

- [ ] **Step 3: Run the harness to confirm it works end to end**

Run: `node tests/core.test.js`
Expected:
```
ok - Core module loads

Todas las pruebas pasaron.
```

- [ ] **Step 4: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "chore: scaffold dual-environment core module and test harness"
```

---

## Task 2: Analyst config and safe active-analyst validation

**Files:**
- Modify: `js/core.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/core.test.js` (before the `if (process.exitCode)` block):
```js
test("ANALYSTS contains exactly magali and victoria", () => {
  assert.deepStrictEqual(Object.keys(Core.ANALYSTS).sort(), ["magali", "victoria"]);
  assert.strictEqual(Core.ANALYSTS.magali.name, "Magali");
  assert.strictEqual(Core.ANALYSTS.victoria.name, "Victoria");
});

test("isValidAnalystId accepts only magali/victoria", () => {
  assert.strictEqual(Core.isValidAnalystId("magali"), true);
  assert.strictEqual(Core.isValidAnalystId("victoria"), true);
  assert.strictEqual(Core.isValidAnalystId("juan"), false);
  assert.strictEqual(Core.isValidAnalystId(""), false);
  assert.strictEqual(Core.isValidAnalystId(null), false);
  assert.strictEqual(Core.isValidAnalystId(undefined), false);
});

test("getSafeActiveAnalyst falls back to magali on invalid input", () => {
  assert.strictEqual(Core.getSafeActiveAnalyst("victoria"), "victoria");
  assert.strictEqual(Core.getSafeActiveAnalyst("magali"), "magali");
  assert.strictEqual(Core.getSafeActiveAnalyst("pedro"), "magali");
  assert.strictEqual(Core.getSafeActiveAnalyst(null), "magali");
  assert.strictEqual(Core.getSafeActiveAnalyst(undefined), "magali");
  assert.strictEqual(Core.getSafeActiveAnalyst(""), "magali");
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `node tests/core.test.js`
Expected: `FAIL - ANALYSTS contains exactly magali and victoria` (and the other two new tests also fail) with `TypeError` (Cannot read properties of undefined).

- [ ] **Step 3: Implement**

In `js/core.js`, replace `var Core = {};` with:
```js
  var ANALYSTS = {
    magali: { id: "magali", name: "Magali" },
    victoria: { id: "victoria", name: "Victoria" }
  };

  function isValidAnalystId(id) {
    return id === "magali" || id === "victoria";
  }

  function getSafeActiveAnalyst(stored) {
    return isValidAnalystId(stored) ? stored : "magali";
  }

  var Core = {
    ANALYSTS: ANALYSTS,
    isValidAnalystId: isValidAnalystId,
    getSafeActiveAnalyst: getSafeActiveAnalyst
  };
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `node tests/core.test.js`
Expected: every line starts with `ok -`, ending with `Todas las pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add analyst config and safe active-analyst validation"
```

---

## Task 3: v1 → v2 migration logic

**Files:**
- Modify: `js/core.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/core.test.js`:
```js
test("migrateLegacyData moves a valid v1 array into magali.shops", () => {
  const v1 = [{ id: "1", name: "Kiosco A" }, { id: "2", name: "Kiosco B" }];
  const result = Core.migrateLegacyData(v1);
  assert.strictEqual(result.version, 2);
  assert.strictEqual(result.analysts.magali.shops.length, 2);
  assert.deepStrictEqual(result.analysts.victoria.shops, []);
  assert.strictEqual(result.analysts.magali.shops[0].name, "Kiosco A");
});

test("migrateLegacyData handles absent v1 without crashing", () => {
  const result = Core.migrateLegacyData(null);
  assert.deepStrictEqual(result.analysts.magali.shops, []);
  assert.deepStrictEqual(result.analysts.victoria.shops, []);
});

test("migrateLegacyData handles corrupt/non-array v1 without crashing", () => {
  assert.deepStrictEqual(Core.migrateLegacyData({ not: "an array" }).analysts.magali.shops, []);
  assert.deepStrictEqual(Core.migrateLegacyData("garbage string").analysts.magali.shops, []);
  assert.deepStrictEqual(Core.migrateLegacyData(undefined).analysts.magali.shops, []);
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `node tests/core.test.js`
Expected: the three new `migrateLegacyData` tests fail with `TypeError` (`Core.migrateLegacyData is not a function`).

- [ ] **Step 3: Implement**

Add to `js/core.js`, above the `var Core = {` block:
```js
  function migrateLegacyData(parsedV1) {
    var legacyShops = Array.isArray(parsedV1) ? parsedV1 : [];
    return {
      version: 2,
      analysts: {
        magali: { shops: legacyShops.slice() },
        victoria: { shops: [] }
      }
    };
  }
```

Add `migrateLegacyData: migrateLegacyData,` to the returned `Core` object.

- [ ] **Step 4: Run to verify all tests pass**

Run: `node tests/core.test.js`
Expected: all `ok -` lines, `Todas las pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add idempotent v1 to v2 legacy data migration"
```

---

## Task 4: Reusable numeric range + date range matching

**Files:**
- Modify: `js/core.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/core.test.js`:
```js
test("inRange respects both bounds inclusive", () => {
  assert.strictEqual(Core.inRange(5, 1, 10), true);
  assert.strictEqual(Core.inRange(1, 1, 10), true);
  assert.strictEqual(Core.inRange(10, 1, 10), true);
  assert.strictEqual(Core.inRange(0, 1, 10), false);
  assert.strictEqual(Core.inRange(11, 1, 10), false);
});

test("inRange with only one bound set", () => {
  assert.strictEqual(Core.inRange(50, 10, null), true);
  assert.strictEqual(Core.inRange(5, 10, null), false);
  assert.strictEqual(Core.inRange(5, null, 10), true);
  assert.strictEqual(Core.inRange(15, null, 10), false);
});

test("inRange with no bounds always true for a real value", () => {
  assert.strictEqual(Core.inRange(123, null, null), true);
});

test("matchesDateRange: no filter set includes everything", () => {
  assert.strictEqual(Core.matchesDateRange("2026-08-15", "", ""), true);
  assert.strictEqual(Core.matchesDateRange("", "", ""), true);
});

test("matchesDateRange: shop without visitDate excluded when a filter is active", () => {
  assert.strictEqual(Core.matchesDateRange("", "2026-08-01", ""), false);
  assert.strictEqual(Core.matchesDateRange("", "", "2026-08-31"), false);
  assert.strictEqual(Core.matchesDateRange(null, "2026-08-01", "2026-08-31"), false);
});

test("matchesDateRange: inclusive range with both bounds", () => {
  assert.strictEqual(Core.matchesDateRange("2026-08-01", "2026-08-01", "2026-08-31"), true);
  assert.strictEqual(Core.matchesDateRange("2026-08-31", "2026-08-01", "2026-08-31"), true);
  assert.strictEqual(Core.matchesDateRange("2026-08-15", "2026-08-01", "2026-08-31"), true);
  assert.strictEqual(Core.matchesDateRange("2026-07-31", "2026-08-01", "2026-08-31"), false);
  assert.strictEqual(Core.matchesDateRange("2026-09-01", "2026-08-01", "2026-08-31"), false);
});

test("matchesDateRange: only from or only to", () => {
  assert.strictEqual(Core.matchesDateRange("2026-09-01", "2026-08-01", ""), true);
  assert.strictEqual(Core.matchesDateRange("2026-07-01", "2026-08-01", ""), false);
  assert.strictEqual(Core.matchesDateRange("2026-07-01", "", "2026-08-01"), true);
  assert.strictEqual(Core.matchesDateRange("2026-09-01", "", "2026-08-01"), false);
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `node tests/core.test.js`
Expected: all `inRange`/`matchesDateRange` tests fail with `TypeError` (function not defined).

- [ ] **Step 3: Implement**

Add to `js/core.js`, above the `var Core = {` block:
```js
  function inRange(value, min, max) {
    if (value == null || Number.isNaN(value)) return false;
    if (min != null && !Number.isNaN(min) && value < min) return false;
    if (max != null && !Number.isNaN(max) && value > max) return false;
    return true;
  }

  function toEpoch(dateStr) {
    if (!dateStr) return null;
    var t = new Date(dateStr + "T00:00:00").getTime();
    return Number.isNaN(t) ? null : t;
  }

  function matchesDateRange(dateStr, from, to) {
    var fromEpoch = toEpoch(from);
    var toEpochValue = toEpoch(to);
    if (fromEpoch == null && toEpochValue == null) return true;

    var valueEpoch = toEpoch(dateStr);
    if (valueEpoch == null) return false;

    return inRange(valueEpoch, fromEpoch, toEpochValue);
  }
```

Add `inRange: inRange, toEpoch: toEpoch, matchesDateRange: matchesDateRange,` to the returned `Core` object.

- [ ] **Step 4: Run to verify all tests pass**

Run: `node tests/core.test.js`
Expected: all `ok -` lines, `Todas las pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add reusable inRange helper and date range matching"
```

---

## Task 5: Accent/case-insensitive text search

**Files:**
- Modify: `js/core.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/core.test.js`:
```js
test("matchesSearch is case and accent insensitive with partial match", () => {
  const shop = { name: "Farmacia Central", address: "Av. San Martín 1450", category: "Farmacia" };
  assert.strictEqual(Core.matchesSearch(shop, "san martin"), true);
  assert.strictEqual(Core.matchesSearch(shop, "SAN MARTIN"), true);
  assert.strictEqual(Core.matchesSearch(shop, "  san   martin  "), true);
  assert.strictEqual(Core.matchesSearch(shop, "farmacia"), true);
  assert.strictEqual(Core.matchesSearch(shop, "kiosco"), false);
});

test("matchesSearch with empty query matches everything", () => {
  assert.strictEqual(Core.matchesSearch({ name: "X" }, ""), true);
  assert.strictEqual(Core.matchesSearch({ name: "X" }, "   "), true);
});

test("matchesSearch tolerates missing fields", () => {
  assert.strictEqual(Core.matchesSearch({ name: "Kiosco" }, "kiosco"), true);
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `node tests/core.test.js`
Expected: the three `matchesSearch` tests fail with `TypeError` (function not defined).

- [ ] **Step 3: Implement**

Add to `js/core.js`, above the `var Core = {` block:
```js
  function normalizeText(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  var SEARCH_FIELDS = ["name", "category", "address", "zone", "contact", "notes"];

  function matchesSearch(shop, query) {
    var q = normalizeText(query);
    if (!q) return true;
    var haystack = normalizeText(
      SEARCH_FIELDS.map(function (field) { return shop[field]; }).join(" ")
    );
    return haystack.indexOf(q) !== -1;
  }
```

Add `normalizeText: normalizeText, matchesSearch: matchesSearch,` to the returned `Core` object.

- [ ] **Step 4: Run to verify all tests pass**

Run: `node tests/core.test.js`
Expected: all `ok -` lines, `Todas las pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add accent and case-insensitive text search"
```

---

## Task 6: Zone matching with address fallback

**Files:**
- Modify: `js/core.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/core.test.js`:
```js
test("matchesZone uses zone field with partial, case-insensitive match", () => {
  const shop = { zone: "Centro", address: "Calle Falsa 123" };
  assert.strictEqual(Core.matchesZone(shop, "centro"), true);
  assert.strictEqual(Core.matchesZone(shop, "CENTRO"), true);
  assert.strictEqual(Core.matchesZone(shop, "norte"), false);
});

test("matchesZone falls back to address when zone is empty", () => {
  const shop = { zone: "", address: "Zona Centro, Paraná" };
  assert.strictEqual(Core.matchesZone(shop, "centro"), true);
});

test("matchesZone with empty query matches everything", () => {
  assert.strictEqual(Core.matchesZone({ zone: "Centro" }, ""), true);
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `node tests/core.test.js`
Expected: the three `matchesZone` tests fail with `TypeError` (function not defined).

- [ ] **Step 3: Implement**

Add to `js/core.js`, above the `var Core = {` block:
```js
  function matchesZone(shop, zoneQuery) {
    var q = normalizeText(zoneQuery);
    if (!q) return true;
    var source = shop.zone && String(shop.zone).trim() ? shop.zone : shop.address;
    return normalizeText(source).indexOf(q) !== -1;
  }
```

Add `matchesZone: matchesZone,` to the returned `Core` object.

- [ ] **Step 4: Run to verify all tests pass**

Run: `node tests/core.test.js`
Expected: all `ok -` lines, `Todas las pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add zone matching with address fallback"
```

---

## Task 7: Status matching and combined applyFilters

**Files:**
- Modify: `js/core.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/core.test.js`:
```js
test("matchesStatus: empty status means Todos", () => {
  assert.strictEqual(Core.matchesStatus({ status: "pendiente" }, ""), true);
  assert.strictEqual(Core.matchesStatus({ status: "pendiente" }, "pendiente"), true);
  assert.strictEqual(Core.matchesStatus({ status: "pendiente" }, "acuerdo"), false);
});

test("applyFilters combines all matchers with AND", () => {
  const shop = {
    name: "Farmacia Centro",
    category: "Farmacia",
    address: "Av. San Martín 1450",
    zone: "Centro",
    status: "interesado",
    visitDate: "2026-08-10",
    contact: "",
    notes: ""
  };

  const matchingFilters = {
    search: "farmacia",
    zone: "centro",
    status: "interesado",
    dateRange: { from: "2026-08-01", to: "2026-08-31" }
  };
  assert.strictEqual(Core.applyFilters(shop, matchingFilters), true);

  assert.strictEqual(Core.applyFilters(shop, Object.assign({}, matchingFilters, { status: "acuerdo" })), false);
  assert.strictEqual(Core.applyFilters(shop, Object.assign({}, matchingFilters, { dateRange: { from: "2026-09-01", to: "2026-09-30" } })), false);
  assert.strictEqual(Core.applyFilters(shop, Object.assign({}, matchingFilters, { zone: "norte" })), false);
});

test("applyFilters with no filters set matches everything", () => {
  const shop = { name: "X", category: "", address: "", zone: "", status: "pendiente", visitDate: "", contact: "", notes: "" };
  const filters = { search: "", zone: "", status: "", dateRange: { from: "", to: "" } };
  assert.strictEqual(Core.applyFilters(shop, filters), true);
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `node tests/core.test.js`
Expected: `matchesStatus` and `applyFilters` tests fail with `TypeError` (function not defined).

- [ ] **Step 3: Implement**

Add to `js/core.js`, above the `var Core = {` block:
```js
  function matchesStatus(shop, status) {
    return !status || shop.status === status;
  }

  var filterMatchers = {
    search: function (shop, value) { return matchesSearch(shop, value); },
    zone: function (shop, value) { return matchesZone(shop, value); },
    status: function (shop, value) { return matchesStatus(shop, value); },
    dateRange: function (shop, value) {
      var range = value || {};
      return matchesDateRange(shop.visitDate, range.from, range.to);
    }
  };

  function applyFilters(shop, filters) {
    var f = filters || {};
    return Object.keys(filterMatchers).every(function (key) {
      return filterMatchers[key](shop, f[key]);
    });
  }
```

Add `matchesStatus: matchesStatus, filterMatchers: filterMatchers, applyFilters: applyFilters,` to the returned `Core` object.

- [ ] **Step 4: Run to verify all tests pass**

Run: `node tests/core.test.js`
Expected: all `ok -` lines, `Todas las pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add status matching and centralized applyFilters"
```

`js/core.js` is now feature-complete for this plan. The remaining tasks wire it into `index.html`.

---

## Task 8: Load `js/core.js` in the page

**Files:**
- Modify: `index.html:534`

- [ ] **Step 1: Add the script tag**

In `index.html`, find:
```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
```

Replace with:
```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script src="js/core.js"></script>
```

- [ ] **Step 2: Verify no console errors on load**

Run: `python -m http.server 8765` from the repo root (or any static server), open `http://localhost:8765/index.html` in a browser, open devtools console.
Expected: page loads exactly as before (no visible change yet), zero console errors, and `window.Core` is defined (type `Core` in the console to confirm).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: load js/core.js in the page"
```

---

## Task 9: CSS for the new UI pieces

**Files:**
- Modify: `index.html` (inside the existing `<style>` block, right before the `@media(max-width:900px)` rule at `index.html:349`)

- [ ] **Step 1: Insert the new CSS rules**

In `index.html`, find:
```css
    @media(max-width:900px){
```

Insert immediately before it:
```css
    .analyst-tabs{
      display:flex;
      gap:6px;
      background:rgba(255,255,255,.12);
      padding:4px;
      border-radius:12px;
    }

    .analyst-tab{
      border:0;
      background:transparent;
      color:#fff;
      opacity:.75;
      padding:9px 16px;
      border-radius:9px;
      font-size:13px;
      font-weight:700;
      cursor:pointer;
      transition:.2s ease;
    }

    .analyst-tab.active{
      background:#fff;
      color:#13213f;
      opacity:1;
    }

    .analyst-active-label{
      margin:6px 0 0;
      font-size:13px;
      font-weight:700;
      opacity:.9;
    }

    .migration-banner{
      background:#fef3c7;
      color:#92400e;
      border:1px solid #f5d78e;
      border-radius:12px;
      padding:12px 16px;
      margin:0 18px;
      font-size:13px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }

    .migration-banner button{
      background:transparent;
      border:0;
      color:#92400e;
      font-size:18px;
      cursor:pointer;
      padding:0 4px;
    }

    .filters-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
    }

    .filters-toggle{
      display:none;
    }

    .results-count{
      font-size:12px;
      color:var(--muted);
      font-weight:700;
      margin:2px 0 4px;
    }

    .active-filter-badges{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin-top:6px;
    }

    .filter-badge{
      background:#eef2ff;
      color:#3730a3;
      border-radius:999px;
      padding:4px 10px;
      font-size:11px;
      font-weight:700;
    }

    .map-empty-state{
      display:none;
      text-align:center;
      color:var(--muted);
      font-size:13px;
      padding:10px;
    }

    .map-empty-state.show{
      display:block;
    }

```

- [ ] **Step 2: Add the mobile filters-toggle rule inside the existing 600px media query**

In `index.html`, find:
```css
    @media(max-width:600px){
      header{padding:16px}
      .layout{padding:12px;gap:12px}
      .form-grid{grid-template-columns:1fr}
      .full{grid-column:auto}
      #map{height:480px;min-height:480px}
      .stats{grid-template-columns:repeat(2,1fr)}
    }
```

Replace with:
```css
    @media(max-width:600px){
      header{padding:16px}
      .layout{padding:12px;gap:12px}
      .form-grid{grid-template-columns:1fr}
      .full{grid-column:auto}
      #map{height:480px;min-height:480px}
      .stats{grid-template-columns:repeat(2,1fr)}
      .filters-toggle{display:inline-flex}
      .filters-body.collapsed{display:none}
    }
```

- [ ] **Step 3: Verify the page still renders with no console errors**

Reload `http://localhost:8765/index.html`. Expected: identical visual output to before (new CSS classes aren't referenced by any HTML yet), zero console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style: add CSS for analyst selector, migration banner, filter badges and mobile filter toggle"
```

---

## Task 10: Header — analyst selector and active-analyst label

**Files:**
- Modify: `index.html:367-377`

- [ ] **Step 1: Replace the header markup**

In `index.html`, find:
```html
  <header>
    <div>
      <h1>Plan de Acción Comercial</h1>
      <p>Recorridas, flyers y acuerdos con comercios</p>
    </div>

    <div class="header-actions">
      <button class="btn-light" id="exportBtn">Exportar datos</button>
      <button class="btn-primary" id="addBtn">+ Agregar comercio</button>
    </div>
  </header>
```

Replace with:
```html
  <header>
    <div>
      <h1>Plan de Acción Comercial</h1>
      <p>Recorridas, flyers y acuerdos con comercios</p>
      <p class="analyst-active-label">Analista activa: <span id="activeAnalystLabel">Magali</span></p>
    </div>

    <div class="header-actions">
      <div class="analyst-tabs" id="analystTabs" role="tablist" aria-label="Analista activa">
        <button type="button" class="analyst-tab" data-analyst="magali" role="tab">Magali</button>
        <button type="button" class="analyst-tab" data-analyst="victoria" role="tab">Victoria</button>
      </div>
      <button class="btn-light" id="exportBtn">Exportar datos</button>
      <button class="btn-primary" id="addBtn">+ Agregar comercio</button>
    </div>
  </header>
```

- [ ] **Step 2: Verify visually**

Reload the page. Expected: a segmented "Magali | Victoria" control and an "Analista activa: Magali" line appear in the header; clicking the tabs does nothing yet (no JS wired); zero console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add analyst selector markup to header"
```

---

## Task 11: Filters card — Zona/Desde/Hasta/counter/badges, remove free-text Analista filter

**Files:**
- Modify: `index.html:403-426`

- [ ] **Step 1: Replace the filters card markup**

In `index.html`, find:
```html
      <section class="card">
        <h3>Filtros</h3>
        <div class="filters">
          <div>
            <label>Buscar comercio</label>
            <input id="searchInput" placeholder="Nombre, rubro o dirección" />
          </div>
          <div>
            <label>Estado</label>
            <select id="statusFilter">
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="visitado">Visitado</option>
              <option value="interesado">Interesado</option>
              <option value="acuerdo">Acuerdo logrado</option>
              <option value="no-interesado">No interesado</option>
            </select>
          </div>
          <div>
            <label>Analista</label>
            <input id="analystFilter" placeholder="Ej: Juan" />
          </div>
        </div>
      </section>
```

Replace with:
```html
      <section class="card">
        <div class="filters-header">
          <h3>Filtros</h3>
          <button type="button" class="btn-secondary filters-toggle" id="filtersToggle">Mostrar filtros</button>
        </div>
        <div class="filters filters-body collapsed" id="filtersBody">
          <div>
            <label>Buscar comercio</label>
            <input id="searchInput" placeholder="Nombre, dirección, zona, teléfono, observaciones..." />
          </div>
          <div>
            <label>Zona</label>
            <input id="zoneFilter" placeholder="Ej: Centro" />
          </div>
          <div>
            <label>Estado</label>
            <select id="statusFilter">
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="visitado">Visitado</option>
              <option value="interesado">Interesado</option>
              <option value="acuerdo">Acuerdo logrado</option>
              <option value="no-interesado">No interesado</option>
            </select>
          </div>
          <div>
            <label>Desde</label>
            <input id="dateFromFilter" type="date" />
          </div>
          <div>
            <label>Hasta</label>
            <input id="dateToFilter" type="date" />
          </div>
          <button type="button" class="btn-secondary" id="clearFiltersBtn">Limpiar filtros</button>
        </div>
        <div class="results-count" id="resultsCount">0 comercios encontrados</div>
        <div class="active-filter-badges" id="activeFilterBadges"></div>
      </section>
```

- [ ] **Step 2: Verify visually**

Reload the page. Expected: filters card now shows Buscar/Zona/Estado/Desde/Hasta/Limpiar filtros, plus a "0 comercios encontrados" line (static, not wired yet); on a narrow window (≤600px) a "Mostrar filtros" button appears and the filter inputs are hidden until clicked... note: the click handler isn't wired yet, that's expected at this step. Zero console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: expand filters card with zone, date range, counter and badges"
```

---

## Task 12: Form — replace "Analista responsable" with "Zona", add map empty-state element

**Files:**
- Modify: `index.html:474-479` (Analista responsable field)
- Modify: `index.html:444-446` (map wrapper)

- [ ] **Step 1: Replace the Analista responsable field with Zona**

In `index.html`, find:
```html
        <div>
          <label>Analista responsable</label>
          <input id="analyst" placeholder="Nombre del analista" />
        </div>
```

Replace with:
```html
        <div>
          <label>Zona</label>
          <input id="zone" placeholder="Ej: Centro, Zona Norte..." />
        </div>
```

- [ ] **Step 2: Add the map empty-state element**

In `index.html`, find:
```html
      <div id="map"></div>
    </main>
```

Replace with:
```html
      <div id="map"></div>
      <div class="map-empty-state" id="mapEmptyState">No se encontraron comercios con estos filtros.</div>
    </main>
```

- [ ] **Step 3: Verify visually**

Reload the page, click "+ Agregar comercio". Expected: the form shows a "Zona" field where "Analista responsable" used to be; no "No se encontraron..." text visible under the map (the element exists but is hidden by default via `.map-empty-state{display:none}`); zero console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: replace free-text analyst field with zone, add map empty-state element"
```

---

## Task 13: Rewrite the app script — state model, migration, filters, markers, autofit

This is the integrative task: the old script uses a single global `shops` array and `markers` Map. Every function that touches shop data needs to move to the new per-analyst `state` object in the same pass, otherwise the app is left in a broken, inconsistent state. This task replaces the entire inline `<script>` body in one step, then verifies the whole app end to end.

**Files:**
- Modify: `index.html:537-836` (entire inline script body, between `(() => {` and `})();`)

- [ ] **Step 1: Replace the whole script body**

In `index.html`, find the full block starting at:
```js
(() => {
  const STORAGE_KEY = "federar_plan_comercial_v1";
```
and ending at:
```js
  if(shops.length){
    const valid = shops.filter(s => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
    if(valid.length){
      const bounds = L.latLngBounds(valid.map(s => [s.lat,s.lng]));
      map.fitBounds(bounds.pad(.2));
    }
  }
})();
```

Replace the entire block with:
```js
(() => {
  const STORAGE_KEY_V1 = "federar_plan_comercial_v1";
  const STORAGE_KEY_V2 = "federar_plan_comercial_v2";
  const ACTIVE_ANALYST_KEY = "federar_active_analyst";
  const MIGRATION_NOTICE_KEY = "federar_migration_notice_shown";

  const statusColors = {
    "pendiente":"#64748b",
    "visitado":"#f97316",
    "interesado":"#eab308",
    "acuerdo":"#16a34a",
    "no-interesado":"#dc2626"
  };

  const statusLabels = {
    "pendiente":"Pendiente",
    "visitado":"Visitado",
    "interesado":"Interesado",
    "acuerdo":"Acuerdo logrado",
    "no-interesado":"No interesado"
  };

  function emptyFilters(){
    return { search:"", zone:"", status:"", dateRange:{from:"", to:""} };
  }

  function readV2(){
    let raw;
    try{ raw = localStorage.getItem(STORAGE_KEY_V2); }catch(e){ return null; }
    if(!raw) return null;
    try{
      const parsed = JSON.parse(raw);
      const shopsOf = a => parsed && parsed.analysts && parsed.analysts[a] && Array.isArray(parsed.analysts[a].shops);
      return (parsed && shopsOf("magali") && shopsOf("victoria")) ? parsed : null;
    }catch(e){
      return null;
    }
  }

  function readLegacyV1(){
    let raw;
    try{ raw = localStorage.getItem(STORAGE_KEY_V1); }catch(e){ return null; }
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(e){ return null; }
  }

  let pendingMigrationCount = 0;

  function loadState(){
    const existing = readV2();
    if(existing) return existing;

    const legacy = readLegacyV1();
    const migrated = Core.migrateLegacyData(legacy);
    const migratedCount = migrated.analysts.magali.shops.length;

    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));

    if(migratedCount > 0){
      let noticeShown;
      try{ noticeShown = localStorage.getItem(MIGRATION_NOTICE_KEY); }catch(e){ noticeShown = "1"; }
      if(!noticeShown){
        pendingMigrationCount = migratedCount;
        try{ localStorage.setItem(MIGRATION_NOTICE_KEY, "1"); }catch(e){}
      }
    }

    return migrated;
  }

  function showMigrationNoticeIfPending(){
    if(!pendingMigrationCount) return;
    const banner = document.createElement("div");
    banner.className = "migration-banner";
    const text = document.createElement("span");
    text.textContent = `Se migraron ${pendingMigrationCount} comercio${pendingMigrationCount === 1 ? "" : "s"} existentes a la analista Magali (compatibilidad con datos previos).`;
    banner.appendChild(text);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Cerrar aviso");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => banner.remove());
    banner.appendChild(closeBtn);
    document.querySelector(".app").insertBefore(banner, document.querySelector(".layout"));
    pendingMigrationCount = 0;
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state.data));
  }

  function loadActiveAnalyst(){
    let stored;
    try{ stored = localStorage.getItem(ACTIVE_ANALYST_KEY); }catch(e){ stored = null; }
    return Core.getSafeActiveAnalyst(stored);
  }

  function saveActiveAnalyst(id){
    try{ localStorage.setItem(ACTIVE_ANALYST_KEY, id); }catch(e){}
  }

  const state = {
    activeAnalyst: loadActiveAnalyst(),
    data: loadState(),
    filtersByAnalyst: {
      magali: emptyFilters(),
      victoria: emptyFilters()
    },
    pendingLatLng: null
  };

  function getActiveShops(){
    return state.data.analysts[state.activeAnalyst].shops;
  }

  function getCurrentFilters(){
    return state.filtersByAnalyst[state.activeAnalyst];
  }

  const microcentroBounds = L.latLngBounds(
    [-31.7425, -60.5425],
    [-31.7215, -60.5155]
  );

  const map = L.map("map", {
    maxBounds: microcentroBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 14
  }).setView([-31.73304, -60.52977], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // Recorte operativo del microcentro de Paraná.
  // El mapa queda limitado a esta zona para facilitar la recorrida comercial.
  L.rectangle(microcentroBounds, {
    color: "#1f5eff",
    weight: 2,
    fillColor: "#1f5eff",
    fillOpacity: 0.035,
    dashArray: "6 6",
    interactive: false
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);
  let markerIndex = new Map();

  function makeMarker(shop){
    return L.circleMarker([shop.lat, shop.lng], {
      radius: 9,
      color: "#ffffff",
      weight: 2,
      fillColor: statusColors[shop.status] || statusColors.pendiente,
      fillOpacity: 1
    });
  }

  function popupHtml(shop){
    const safe = value => String(value || "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));

    return `
      <div style="min-width:220px">
        <strong style="font-size:15px">${safe(shop.name)}</strong><br>
        <span style="color:#64748b;font-size:12px">${safe(shop.category || "Sin rubro")}</span>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:8px 0">
        <b>Estado:</b> ${safe(statusLabels[shop.status] || shop.status)}<br>
        <b>Zona:</b> ${safe(shop.zone || "-")}<br>
        <b>Flyers:</b> ${Number(shop.flyers || 0)}<br>
        <b>Dirección:</b> ${safe(shop.address || "-")}<br>
        <button data-edit="${shop.id}" style="margin-top:10px;width:100%;padding:8px;border:0;border-radius:8px;background:#1f5eff;color:#fff;font-weight:700;cursor:pointer">Editar</button>
      </div>
    `;
  }

  function refreshMarkers(filtered){
    markersLayer.clearLayers();
    markerIndex = new Map();

    filtered.forEach(shop => {
      if(!Number.isFinite(Number(shop.lat)) || !Number.isFinite(Number(shop.lng))) return;
      const marker = makeMarker(shop);
      marker.bindPopup(popupHtml(shop));
      marker.on("popupopen", () => {
        setTimeout(() => {
          const btn = document.querySelector(`[data-edit="${shop.id}"]`);
          if(btn) btn.addEventListener("click", () => openEdit(shop.id), {once:true});
        }, 0);
      });
      markersLayer.addLayer(marker);
      markerIndex.set(shop.id, marker);
    });
  }

  function fitMapToResults(filtered){
    const withCoords = filtered.filter(s => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
    const emptyState = document.getElementById("mapEmptyState");

    if(withCoords.length === 0){
      emptyState.classList.add("show");
      return;
    }

    emptyState.classList.remove("show");

    if(withCoords.length === 1){
      map.setView([withCoords[0].lat, withCoords[0].lng], 16);
      return;
    }

    const bounds = L.latLngBounds(withCoords.map(s => [s.lat, s.lng]));
    map.fitBounds(bounds.pad(.2));
  }

  function getFilteredShops(){
    const filters = getCurrentFilters();
    return getActiveShops().filter(shop => Core.applyFilters(shop, filters));
  }

  function renderList(filtered){
    const list = document.getElementById("shopList");
    list.innerHTML = "";

    if(!filtered.length){
      list.innerHTML = '<div class="empty">No hay comercios para mostrar.</div>';
      return;
    }

    filtered.forEach(shop => {
      const item = document.createElement("div");
      item.className = "shop-item";
      item.innerHTML = `
        <strong>${escapeHtml(shop.name)}</strong>
        <div class="meta">
          <span>${escapeHtml(shop.category || "Sin rubro")}</span>
          <span class="badge badge-${shop.status}">${statusLabels[shop.status] || shop.status}</span>
        </div>
      `;
      item.addEventListener("click", () => {
        if(markerIndex.has(shop.id)){
          map.setView([shop.lat, shop.lng], Math.max(map.getZoom(), 16));
          markerIndex.get(shop.id).openPopup();
        }else{
          openEdit(shop.id);
        }
      });
      list.appendChild(item);
    });
  }

  function renderStats(filtered){
    const shops = getActiveShops();
    document.getElementById("statTotal").textContent = shops.length;
    document.getElementById("statVisited").textContent = shops.filter(s => s.status !== "pendiente").length;
    document.getElementById("statDeals").textContent = shops.filter(s => s.status === "acuerdo").length;
    document.getElementById("statFlyers").textContent = shops.reduce((sum,s) => sum + Number(s.flyers || 0), 0);

    document.getElementById("resultsCount").textContent =
      `${filtered.length} comercio${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"}`;
  }

  function renderActiveFilterBadges(){
    const filters = getCurrentFilters();
    const badges = [];
    if(filters.search) badges.push(`Búsqueda: ${filters.search}`);
    if(filters.zone) badges.push(`Zona: ${filters.zone}`);
    if(filters.status) badges.push(`Estado: ${statusLabels[filters.status] || filters.status}`);
    if(filters.dateRange.from || filters.dateRange.to){
      badges.push(`Fechas: ${filters.dateRange.from || "…"} a ${filters.dateRange.to || "…"}`);
    }

    document.getElementById("activeFilterBadges").innerHTML =
      badges.map(b => `<span class="filter-badge">${escapeHtml(b)}</span>`).join("");
  }

  function renderAnalystUI(){
    document.querySelectorAll(".analyst-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.analyst === state.activeAnalyst);
    });
    document.getElementById("activeAnalystLabel").textContent = Core.ANALYSTS[state.activeAnalyst].name;
  }

  function syncFilterInputsFromState(){
    const filters = getCurrentFilters();
    document.getElementById("searchInput").value = filters.search;
    document.getElementById("zoneFilter").value = filters.zone;
    document.getElementById("statusFilter").value = filters.status;
    document.getElementById("dateFromFilter").value = filters.dateRange.from;
    document.getElementById("dateToFilter").value = filters.dateRange.to;
  }

  function renderAll(){
    const filtered = getFilteredShops();
    renderAnalystUI();
    renderStats(filtered);
    renderList(filtered);
    renderActiveFilterBadges();
    refreshMarkers(filtered);
    fitMapToResults(filtered);
  }

  function escapeHtml(value){
    return String(value || "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function openNew(latlng=null){
    document.getElementById("shopForm").reset();
    document.getElementById("shopId").value = "";
    document.getElementById("modalTitle").textContent = "Agregar comercio";
    document.getElementById("deleteBtn").style.display = "none";
    document.getElementById("flyers").value = 0;
    document.getElementById("status").value = "pendiente";

    const coords = latlng || state.pendingLatLng || map.getCenter();
    document.getElementById("lat").value = coords.lat;
    document.getElementById("lng").value = coords.lng;

    document.getElementById("shopModal").classList.add("show");
  }

  function openEdit(id){
    const shop = getActiveShops().find(s => s.id === id);
    if(!shop) return;

    document.getElementById("shopId").value = shop.id;
    document.getElementById("name").value = shop.name || "";
    document.getElementById("category").value = shop.category || "";
    document.getElementById("address").value = shop.address || "";
    document.getElementById("zone").value = shop.zone || "";
    document.getElementById("status").value = shop.status || "pendiente";
    document.getElementById("flyers").value = Number(shop.flyers || 0);
    document.getElementById("contact").value = shop.contact || "";
    document.getElementById("visitDate").value = shop.visitDate || "";
    document.getElementById("followUp").value = shop.followUp || "";
    document.getElementById("agreement").value = shop.agreement || "";
    document.getElementById("notes").value = shop.notes || "";
    document.getElementById("lat").value = shop.lat;
    document.getElementById("lng").value = shop.lng;

    document.getElementById("modalTitle").textContent = "Editar comercio";
    document.getElementById("deleteBtn").style.display = "inline-block";
    document.getElementById("shopModal").classList.add("show");
  }

  function closeModal(){
    document.getElementById("shopModal").classList.remove("show");
    state.pendingLatLng = null;
  }

  function switchAnalyst(id){
    if(!Core.isValidAnalystId(id) || id === state.activeAnalyst) return;
    state.activeAnalyst = id;
    saveActiveAnalyst(id);
    syncFilterInputsFromState();
    renderAll();
  }

  document.getElementById("analystTabs").addEventListener("click", e => {
    const btn = e.target.closest(".analyst-tab");
    if(btn) switchAnalyst(btn.dataset.analyst);
  });

  document.getElementById("shopForm").addEventListener("submit", e => {
    e.preventDefault();

    const id = document.getElementById("shopId").value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const shops = getActiveShops();
    const existingIndex = shops.findIndex(s => s.id === id);
    const shop = {
      id,
      name: document.getElementById("name").value.trim(),
      category: document.getElementById("category").value.trim(),
      address: document.getElementById("address").value.trim(),
      zone: document.getElementById("zone").value.trim(),
      status: document.getElementById("status").value,
      flyers: Math.max(0, Number(document.getElementById("flyers").value || 0)),
      contact: document.getElementById("contact").value.trim(),
      visitDate: document.getElementById("visitDate").value,
      followUp: document.getElementById("followUp").value,
      agreement: document.getElementById("agreement").value.trim(),
      notes: document.getElementById("notes").value.trim(),
      lat: Number(document.getElementById("lat").value),
      lng: Number(document.getElementById("lng").value)
    };

    if(existingIndex >= 0) shops[existingIndex] = shop;
    else shops.push(shop);

    saveState();
    renderAll();
    closeModal();

    map.setView([shop.lat, shop.lng], Math.max(map.getZoom(), 15));
  });

  document.getElementById("deleteBtn").addEventListener("click", () => {
    const id = document.getElementById("shopId").value;
    if(!id) return;
    if(!confirm("¿Eliminar este comercio?")) return;

    const analyst = state.data.analysts[state.activeAnalyst];
    analyst.shops = analyst.shops.filter(s => s.id !== id);
    saveState();
    renderAll();
    closeModal();
  });

  document.getElementById("addBtn").addEventListener("click", () => openNew());
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);

  document.getElementById("shopModal").addEventListener("click", e => {
    if(e.target.id === "shopModal") closeModal();
  });

  map.on("click", e => {
    state.pendingLatLng = e.latlng;
    openNew(e.latlng);
  });

  document.getElementById("searchInput").addEventListener("input", e => {
    getCurrentFilters().search = e.target.value;
    renderAll();
  });

  document.getElementById("zoneFilter").addEventListener("input", e => {
    getCurrentFilters().zone = e.target.value;
    renderAll();
  });

  document.getElementById("statusFilter").addEventListener("change", e => {
    getCurrentFilters().status = e.target.value;
    renderAll();
  });

  document.getElementById("dateFromFilter").addEventListener("change", e => {
    getCurrentFilters().dateRange.from = e.target.value;
    renderAll();
  });

  document.getElementById("dateToFilter").addEventListener("change", e => {
    getCurrentFilters().dateRange.to = e.target.value;
    renderAll();
  });

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    state.filtersByAnalyst[state.activeAnalyst] = emptyFilters();
    syncFilterInputsFromState();
    renderAll();
  });

  document.getElementById("filtersToggle").addEventListener("click", () => {
    const body = document.getElementById("filtersBody");
    const collapsed = body.classList.toggle("collapsed");
    document.getElementById("filtersToggle").textContent = collapsed ? "Mostrar filtros" : "Ocultar filtros";
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(getActiveShops(),null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan_comercial_federar_${state.activeAnalyst}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  syncFilterInputsFromState();
  renderAll();
  showMigrationNoticeIfPending();
})();
```

- [ ] **Step 2: Verify no console errors and basic functionality**

Reload `http://localhost:8765/index.html`. Expected:
- Zero console errors.
- Header shows "Magali" tab active by default, "Analista activa: Magali".
- Clicking "Victoria" switches the tab, clears the (empty) list, shows "0 comercios encontrados", markers layer is empty.
- Clicking the map opens the "Agregar comercio" modal with a "Zona" field (no "Analista responsable").
- Saving a new comercio makes it appear in the list, on the map, and in the stats, only under the analyst that was active when it was saved.
- Switching back to Magali does not show Victoria's comercio, and vice versa.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: rewrite app script for per-analyst state, centralized filters, layerGroup markers and map autofit"
```

---

## Task 14: End-to-end manual verification with temporary test data

**Files:** none (browser console only — no files created or committed for this task)

- [ ] **Step 1: Seed temporary test data via the browser console**

With `http://localhost:8765/index.html` open and devtools console active, paste and run:
```js
(() => {
  const seed = {
    version: 2,
    analysts: {
      magali: {
        shops: [
          { id:"m1", name:"Kiosco Plaza", category:"Kiosco", address:"San Martín 1450", zone:"Centro", status:"interesado", flyers:5, contact:"3435551111", visitDate:"2026-08-05", followUp:"", agreement:"", notes:"Buena predisposición", lat:-31.7330, lng:-60.5297 },
          { id:"m2", name:"Farmacia Norte", category:"Farmacia", address:"Belgrano 800", zone:"Zona Norte", status:"pendiente", flyers:0, contact:"", visitDate:"", followUp:"", agreement:"", notes:"", lat:-31.7300, lng:-60.5280 },
          { id:"m3", name:"Almacén Sur", category:"Almacén", address:"9 de Julio 300", zone:"Zona Sur", status:"acuerdo", flyers:12, contact:"3435552222", visitDate:"2026-08-20", followUp:"2026-09-01", agreement:"Flyers en mostrador", notes:"Firmó acuerdo", lat:-31.7350, lng:-60.5310 }
        ]
      },
      victoria: {
        shops: [
          { id:"v1", name:"Panadería Centro", category:"Panadería", address:"Urquiza 500", zone:"Centro", status:"pendiente", flyers:0, contact:"", visitDate:"", followUp:"", agreement:"", notes:"", lat:-31.7325, lng:-60.5290 },
          { id:"v2", name:"Ferretería Este", category:"Ferretería", address:"Corrientes 1200", zone:"Zona Este", status:"no-interesado", flyers:3, contact:"3435553333", visitDate:"2026-08-10", followUp:"", agreement:"", notes:"No le interesa por ahora", lat:-31.7310, lng:-60.5260 },
          { id:"v3", name:"Verdulería Oeste", category:"Verdulería", address:"Racedo 900", zone:"Zona Oeste", status:"visitado", flyers:2, contact:"", visitDate:"2026-08-18", followUp:"", agreement:"", notes:"Volver la semana que viene", lat:-31.7340, lng:-60.5330 }
        ]
      }
    }
  };
  localStorage.setItem("federar_plan_comercial_v2", JSON.stringify(seed));
  localStorage.removeItem("federar_active_analyst");
  location.reload();
})();
```

- [ ] **Step 2: Verify separation and combined filters**

With the seeded data, check each scenario in the browser and confirm the result:
- Magali tab active by default (fallback correctly applied since `federar_active_analyst` was removed) → list shows exactly 3 comercios (Kiosco Plaza, Farmacia Norte, Almacén Sur), 3 markers on the map, "3 comercios encontrados".
- Click Victoria tab → list shows exactly the other 3 comercios (Panadería Centro, Ferretería Este, Verdulería Oeste), Magali's markers are gone from the map, no duplicates.
- Magali + Zona "Centro" → only Kiosco Plaza.
- Magali + Estado "Interesado" → only Kiosco Plaza.
- Magali + Desde 2026-08-01 + Hasta 2026-08-10 → only Kiosco Plaza (Almacén Sur's 2026-08-20 is excluded).
- Victoria + Zona "Centro" → only Panadería Centro.
- Victoria + Estado "Pendiente" → only Panadería Centro.
- Victoria + Desde 2026-08-15 + Hasta 2026-08-31 → Ferretería Este and Verdulería Oeste.
- Magali + Zona "Centro" + Estado "Interesado" + Buscar "kiosco" → single result, map centers on it at zoom 16 (not over-zoomed).
- Magali + Buscar "san martin" (no accent, matches "San Martín") → Kiosco Plaza.
- Any combination producing zero results (e.g. Magali + Zona "Inexistente") → list shows "No hay comercios para mostrar.", map shows "No se encontraron comercios con estos filtros.", map keeps a valid view (does not break), "0 comercios encontrados".
- Click "Limpiar filtros" on either analyst → all filter inputs clear, active analyst does not change, full list for that analyst returns.
- Edit a comercio (e.g. change Almacén Sur's status) → change reflects immediately in list, map marker color, and stats; switching to Victoria and back to Magali preserves the edit after a reload.
- Reload the page entirely (F5) → analyst separation and all edits persist exactly as left.

- [ ] **Step 3: Verify migration path independently**

In a private/incognito window (clean `localStorage`), run:
```js
localStorage.setItem("federar_plan_comercial_v1", JSON.stringify([
  { id:"legacy1", name:"Comercio Viejo", category:"Kiosco", address:"Calle Vieja 100", status:"pendiente", flyers:0, lat:-31.7330, lng:-60.5297 }
]));
location.reload();
```
Expected: a dismissible banner appears reading "Se migraron 1 comercio existentes a la analista Magali (compatibilidad con datos previos)."; Magali tab shows the migrated comercio; Victoria tab is empty; reloading again does not show the banner a second time; `localStorage.getItem("federar_plan_comercial_v1")` still returns the original untouched array.

- [ ] **Step 4: Verify migration robustness**

In the same clean window, run each of these independently (reload between each), and confirm the app loads without console errors and both analysts end up with an empty (but valid) shop list:
```js
localStorage.setItem("federar_plan_comercial_v1", "{not valid json");
```
```js
localStorage.removeItem("federar_plan_comercial_v1");
```
```js
localStorage.setItem("federar_plan_comercial_v1", JSON.stringify({ not: "an array" }));
```

- [ ] **Step 5: Verify active-analyst fallback**

Run:
```js
localStorage.setItem("federar_active_analyst", "pedro");
location.reload();
```
Expected: app loads with Magali active (safe fallback), no console errors.

- [ ] **Step 6: Verify responsive behavior**

Resize the browser (or devtools device toolbar) to a width ≤600px. Expected: the filters card body is hidden behind a "Mostrar filtros" button; clicking it reveals the filters and the label changes to "Ocultar filtros"; the analyst selector and shop list remain usable at this width.

- [ ] **Step 7: Clean up all temporary test data**

Run in the console (on both the normal and incognito windows used above):
```js
localStorage.removeItem("federar_plan_comercial_v1");
localStorage.removeItem("federar_plan_comercial_v2");
localStorage.removeItem("federar_active_analyst");
localStorage.removeItem("federar_migration_notice_shown");
```
Confirm the repo's `index.html` itself contains no seeded/fixture data (it never did — all test data lived only in the browser's `localStorage`, never committed).

No commit for this task — it's verification only, nothing in the working tree changes.

---

## Plan Self-Review Notes

- **Spec coverage:** Objectives 1–5 (separation, selector, independent data, migration, independent map) → Tasks 2, 3, 10, 12, 13. Objectives 6–13 (filters, search, zone, status, date range, reusable ranges, AND combination, map/list sync) → Tasks 4–7, 11, 13. Objectives 14–16 (counter, clear filters, autofit) → Task 13 (`renderStats`, `clearFiltersBtn`, `fitMapToResults`). Objective 17 (layerGroup) → Task 13 (`markersLayer`). Objective 19 (list→map selection, popup) → Task 13 (`renderList` click handler, unchanged popup behavior). Objective 20 (active filter badges) → Task 13 (`renderActiveFilterBadges`). Objectives 22/28 (centralized filtering, no duplicated per-analyst functions) → `js/core.js` `applyFilters` + single `renderAll`/`getActiveShops` used for both analysts. Objective 23 (session-only per-analyst filters) → `state.filtersByAnalyst`. Objective 25/26 (responsive, coherent design) → Tasks 9, 11 (mobile toggle), existing CSS variables/classes reused throughout. Objective 30 (safe with missing fields) → `js/core.js` matchers all guard against undefined fields; `refreshMarkers` skips shops without valid coordinates.
- **Placeholder scan:** no TBD/TODO; every step shows complete, runnable code.
- **Type consistency:** `filters` object shape (`{search, zone, status, dateRange:{from,to}}`) is identical across `emptyFilters()`, `Core.applyFilters`/`Core.filterMatchers`, `syncFilterInputsFromState`, and the filter input event handlers. `shop` object fields (`zone` added, `analyst` removed) are consistent across the form, `openEdit`, the submit handler, and `Core.matchesSearch`/`Core.matchesZone`.
