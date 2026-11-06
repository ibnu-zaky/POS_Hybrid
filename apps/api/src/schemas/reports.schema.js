"use strict";

const { z } = require("zod");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function isValidDateString(value) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isValidMonthString(value) {
  if (!MONTH_PATTERN.test(value)) {
    return false;
  }
  const [year, month] = value.split("-").map(Number);
  return month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
}

const dateField = z.string().refine(isValidDateString, "must be a valid date YYYY-MM-DD");
const monthField = z.string().refine(isValidMonthString, "must be a valid month YYYY-MM");

const dashboardQuerySchema = z.object({
  date: dateField.optional(),
  from: dateField.optional(),
  to: dateField.optional(),
});

const dailyQuerySchema = z.object({
  date: dateField.optional(),
});

const weeklyQuerySchema = z.object({
  start: dateField.optional(),
});

const monthlyQuerySchema = z.object({
  month: monthField.optional(),
});

module.exports = {
  dashboardQuerySchema,
  dailyQuerySchema,
  weeklyQuerySchema,
  monthlyQuerySchema,
};
