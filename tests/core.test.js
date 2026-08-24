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
