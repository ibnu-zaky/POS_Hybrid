"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { roundHalfUp, round2, toRupiah, percentOf, computeTotals } = require("@pos/core");

test("core money: roundHalfUp half-away-from-zero (bukan Math.round)", () => {
  assert.equal(roundHalfUp(2.5), 3);
  assert.equal(roundHalfUp(-2.5), -3); // Math.round(-2.5) === -2, dilarang
  assert.equal(roundHalfUp(2.4), 2);
  assert.equal(roundHalfUp(-2.4), -2);
});

test("core money: round2", () => {
  assert.equal(round2(1.234), 1.23);
  assert.equal(round2(1.235), 1.24);
  assert.equal(round2(-1.235), -1.24);
});

test("core money: toRupiah menolak pecahan dan NaN", () => {
  assert.equal(toRupiah("10000.00"), 10000);
  assert.equal(toRupiah(5000), 5000);
  assert.throws(() => toRupiah("10000.50"), /integer/);
  assert.throws(() => toRupiah("abc"), /Invalid rupiah/);
});

test("core money: percentOf aritmetika integer", () => {
  assert.equal(percentOf(10000, 11), 1100);
  assert.equal(percentOf(999, 11), 110);
  assert.equal(percentOf(0, 11), 0);
});

test("core money: computeTotals tetap konsisten", () => {
  const result = computeTotals([{ quantity: 2, unit_price: 10000 }], { taxPct: 11 });
  assert.equal(result.subtotal, 20000);
  assert.equal(result.taxAmount, 2200);
  assert.equal(result.grandTotal, 22200);
});
