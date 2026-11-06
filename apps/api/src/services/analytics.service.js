"use strict";

const { withTenantContext } = require("../config/database");
const analyticsRepository = require("../repositories/analytics.repository");

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function todayInJakarta() {
  return new Date(Date.now() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveRange({ from, to, defaultDays = 6 }) {
  const endDate = to || todayInJakarta();
  const startDate = from || addDays(endDate, -defaultDays);
  return { startDate, endDate };
}

async function getSalesByProduct({ merchantId, from, to, limit }) {
  return withTenantContext(merchantId, async (client) => {
    const { startDate, endDate } = resolveRange({ from, to });
    const data = await analyticsRepository.salesByProduct(client, {
      merchantId,
      from: startDate,
      to: endDate,
      limit: Number(limit),
    });
    return { period: { from: startDate, to: endDate }, data };
  });
}

async function getMargin({ merchantId, from, to, limit }) {
  return withTenantContext(merchantId, async (client) => {
    const { startDate, endDate } = resolveRange({ from, to });
    const data = await analyticsRepository.marginByProduct(client, {
      merchantId,
      from: startDate,
      to: endDate,
      limit: Number(limit),
    });
    return { period: { from: startDate, to: endDate }, data };
  });
}

async function getSlowMoving({ merchantId, days, limit }) {
  return withTenantContext(merchantId, async (client) => {
    const referenceDate = todayInJakarta();
    const data = await analyticsRepository.slowMovingSkus(client, {
      merchantId,
      referenceDate,
      days: Number(days),
      limit: Number(limit),
    });
    return { period: { reference_date: referenceDate, days: Number(days) }, data };
  });
}

async function getTurnover({ merchantId, from, to, limit }) {
  return withTenantContext(merchantId, async (client) => {
    const { startDate, endDate } = resolveRange({ from, to });
    const data = await analyticsRepository.turnoverByProduct(client, {
      merchantId,
      from: startDate,
      to: endDate,
      limit: Number(limit),
    });
    return {
      period: { from: startDate, to: endDate },
      note: "turnover_ratio = sold_quantity / current_stock (estimasi, bukan average stock)",
      data,
    };
  });
}

module.exports = {
  getSalesByProduct,
  getMargin,
  getSlowMoving,
  getTurnover,
};
