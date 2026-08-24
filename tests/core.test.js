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

if (process.exitCode) {
  console.error("\nAlgunas pruebas fallaron.");
} else {
  console.log("\nTodas las pruebas pasaron.");
}
