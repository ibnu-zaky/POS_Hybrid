"use strict";

const { withTenantContext } = require("../config/database");
const reportsRepository = require("../repositories/reports.repository");

const TIMEZONE_OFFSET = "+07:00";
const JAKARTA_DAY_MS = 24 * 60 * 60 * 1000;

function todayInJakarta() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayStartIso(dateString) {
  return new Date(`${dateString}T00:00:00${TIMEZONE_OFFSET}`).toISOString();
}

function dayEndIso(dateString) {
  return new Date(Date.parse(dayStartIso(dateString)) + JAKARTA_DAY_MS).toISOString();
}

function monthDaysIn(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveRange({ date, from, to }) {
  if (from && to) {
    return { from: dayStartIso(from), to: dayEndIso(to), label: { from, to } };
  }
  const targetDate = date || todayInJakarta();
  return { from: dayStartIso(targetDate), to: dayEndIso(targetDate), label: { date: targetDate } };
}

async function buildSummaryBlock({ merchantId, from, to }) {
  return withTenantContext(merchantId, async (client) => {
    const [summary, breakdown, topProducts] = await Promise.all([
      reportsRepository.summaryByRange(client, { merchantId, from, to }),
      reportsRepository.paymentBreakdownByRange(client, { merchantId, from, to }),
      reportsRepository.topProductsByRange(client, { merchantId, from, to, limit: 10 }),
    ]);

    return {
      summary: {
        transactions_count: summary.transactions_count,
        total_sales: summary.total_sales,
        average_ticket: summary.average_ticket,
      },
      payment_breakdown: Object.fromEntries(
        breakdown.map((row) => [row.payment_method, { total: row.total, count: row.count }]),
      ),
      top_products: topProducts,
    };
  });
}

async function getDashboard({ merchantId, date, from, to }) {
  if (!merchantId) {
    throw new Error("Merchant context required");
  }

  const range = resolveRange({ date, from, to });

  return withTenantContext(merchantId, async (client) => {
    const context = { merchantId, from: range.from, to: range.to };
    const [summary, breakdown, topProducts, hourly] = await Promise.all([
      reportsRepository.summaryByRange(client, context),
      reportsRepository.paymentBreakdownByRange(client, context),
      reportsRepository.topProductsByRange(client, { ...context, limit: 10 }),
      reportsRepository.hourlySalesByRange(client, context),
    ]);

    const hourlyByHour = new Map(hourly.map((row) => [row.hour, row]));

    return {
      period: range.label,
      summary: {
        transactions_count: summary.transactions_count,
        total_sales: summary.total_sales,
        average_ticket: summary.average_ticket,
      },
      payment_breakdown: Object.fromEntries(
        breakdown.map((row) => [row.payment_method, { total: row.total, count: row.count }]),
      ),
      top_products: topProducts,
      hourly_sales: Array.from({ length: 24 }, (_, hour) => ({
        hour: `${String(hour).padStart(2, "0")}:00`,
        sales: hourlyByHour.get(hour)?.sales || 0,
        transactions: hourlyByHour.get(hour)?.transactions || 0,
      })),
    };
  });
}

async function getDailyReport({ merchantId, date }) {
  if (!merchantId) {
    throw new Error("Merchant context required");
  }

  const targetDate = date || todayInJakarta();
  const range = { from: dayStartIso(targetDate), to: dayEndIso(targetDate) };
  const block = await buildSummaryBlock({ merchantId, ...range });

  return { period: { date: targetDate }, ...block };
}

async function getWeeklyReport({ merchantId, start }) {
  if (!merchantId) {
    throw new Error("Merchant context required");
  }

  const endDate = start || todayInJakarta();
  const startDate = addDays(endDate, -6);
  const range = { from: dayStartIso(startDate), to: dayEndIso(endDate) };

  return withTenantContext(merchantId, async (client) => {
    const context = { merchantId, from: range.from, to: range.to };
    const [summary, series] = await Promise.all([
      reportsRepository.summaryByRange(client, context),
      reportsRepository.dailySeriesByRange(client, context),
    ]);

    const seriesByDay = new Map(series.map((row) => [row.day, row]));
    const days = [];
    for (let index = 0; index < 7; index += 1) {
      const day = addDays(startDate, index);
      const row = seriesByDay.get(day);
      days.push({
        day,
        sales: row?.sales || 0,
        transactions: row?.transactions || 0,
      });
    }

    return {
      period: { from: startDate, to: endDate },
      summary: {
        transactions_count: summary.transactions_count,
        total_sales: summary.total_sales,
        average_ticket: summary.average_ticket,
      },
      days,
    };
  });
}

async function getMonthlyReport({ merchantId, month }) {
  if (!merchantId) {
    throw new Error("Merchant context required");
  }

  const targetMonth = month || todayInJakarta().slice(0, 7);
  const daysInMonth = monthDaysIn(targetMonth);
  const startDate = `${targetMonth}-01`;
  const endDate = `${targetMonth}-${String(daysInMonth).padStart(2, "0")}`;
  const range = { from: dayStartIso(startDate), to: dayEndIso(endDate) };

  return withTenantContext(merchantId, async (client) => {
    const context = { merchantId, from: range.from, to: range.to };
    const [summary, series] = await Promise.all([
      reportsRepository.summaryByRange(client, context),
      reportsRepository.dailySeriesByRange(client, context),
    ]);

    const seriesByDay = new Map(series.map((row) => [String(row.day).slice(0, 10), row]));
    const days = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayString = `${targetMonth}-${String(day).padStart(2, "0")}`;
      const row = seriesByDay.get(dayString);
      days.push({
        day: dayString,
        sales: row?.sales || 0,
        transactions: row?.transactions || 0,
      });
    }

    return {
      period: { month: targetMonth },
      summary: {
        transactions_count: summary.transactions_count,
        total_sales: summary.total_sales,
        average_ticket: summary.average_ticket,
      },
      days,
    };
  });
}

module.exports = {
  getDashboard,
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
};
