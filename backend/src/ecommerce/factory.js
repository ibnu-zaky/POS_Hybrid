"use strict";

const DummyAdapter = require("./dummy-adapter");

const ADAPTERS = {
  dummy: DummyAdapter,
  // Placeholder — implementasi nyata menyusul
  tokopedia: null,
  shopee: null,
  woocommerce: null,
};

function getAdapter(marketplace, config = {}) {
  const AdapterClass = ADAPTERS[marketplace];
  if (!AdapterClass) {
    throw new Error(`Adapter untuk marketplace "${marketplace}" belum tersedia`);
  }
  return new AdapterClass(config);
}

module.exports = { getAdapter, ADAPTERS };
