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

if (process.exitCode) {
  console.error("\nAlgunas pruebas fallaron.");
} else {
  console.log("\nTodas las pruebas pasaron.");
}
