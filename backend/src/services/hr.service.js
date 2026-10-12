"use strict";

const { withTenantContext } = require("../config/database");
const hrRepository = require("../repositories/hr.repository");

class HrError extends Error {
  constructor(message = "HR error", statusCode = 400) {
    super(message);
    this.name = "HrError";
    this.statusCode = statusCode;
  }
}

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function todayInJakarta() {
  return new Date(Date.now() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

function dayStartIso(dateString) {
  return new Date(`${dateString}T00:00:00+07:00`).toISOString();
}

function dayEndIso(dateString) {
  return new Date(Date.parse(`${dateString}T00:00:00+07:00`) + 24 * 60 * 60 * 1000).toISOString();
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveRange({ from, to, defaultDays = 0 }) {
  const endDate = to || todayInJakarta();
  const startDate = from || addDays(endDate, -defaultDays);
  return { from, to, startDate, endDate };
}

function serializeShift(row) {
  if (!row) return null;
  return {
    ...row,
    start_time: String(row.start_time).slice(0, 5),
    end_time: String(row.end_time).slice(0, 5),
  };
}

async function listShifts({ merchantId, staffId, date, from, to, limit, offset }) {
  return withTenantContext(merchantId, async (client) => {
    const rows = await hrRepository.listShifts(client, {
      merchantId, staffId, date, from, to, limit: Number(limit), offset: Number(offset),
    });
    return rows.map(serializeShift);
  });
}

async function createShift({ merchantId, staffId: createdBy, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const staff = await hrRepository.findStaffById(client, { merchantId, staffId: payload.staff_id });
    if (!staff) {
      throw new HrError("Staff not found", 404);
    }
    if (!staff.is_active) {
      throw new HrError("Staff is not active", 400);
    }

    const overlap = await hrRepository.hasOverlappingShift(client, {
      merchantId,
      staffId: payload.staff_id,
      shiftDate: payload.shift_date,
      startTime: payload.start_time,
      endTime: payload.end_time,
    });
    if (overlap) {
      throw new HrError("Staff already has an overlapping shift on that date", 409);
    }

    try {
      const shift = await hrRepository.insertShift(client, {
        merchantId,
        staffId: payload.staff_id,
        createdBy,
        payload,
      });
      return serializeShift(shift);
    } catch (error) {
      if (error.code === "23505") {
        throw new HrError("Staff already has a shift on that date", 409);
      }
      throw error;
    }
  });
}

async function updateShift({ merchantId, shiftId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await hrRepository.findShiftById(client, { merchantId, shiftId });
    if (!existing) {
      throw new HrError("Shift not found", 404);
    }

    const startTime = String(payload.start_time || existing.start_time).slice(0, 5);
    const endTime = String(payload.end_time || existing.end_time).slice(0, 5);
    if (endTime <= startTime) {
      throw new HrError("end_time must be after start_time", 400);
    }

    const nextStatus = payload.status || existing.status;
    if (nextStatus !== "cancelled" || existing.status !== "cancelled") {
      const overlap = await hrRepository.hasOverlappingShift(client, {
        merchantId,
        staffId: existing.staff_id,
        shiftDate: existing.shift_date,
        startTime,
        endTime,
        excludeShiftId: shiftId,
      });
      if (overlap) {
        throw new HrError("Staff already has an overlapping shift on that date", 409);
      }
    }

    const normalizedPayload = { ...payload };
    if (payload.start_time) normalizedPayload.start_time = startTime;
    if (payload.end_time) normalizedPayload.end_time = endTime;
    const updated = await hrRepository.updateShift(client, { merchantId, shiftId, updates: normalizedPayload });
    return serializeShift(updated);
  });
}

async function deleteShift({ merchantId, shiftId }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await hrRepository.findShiftById(client, { merchantId, shiftId });
    if (!existing) {
      throw new HrError("Shift not found", 404);
    }

    await hrRepository.removeShift(client, { merchantId, shiftId });
    return { deleted: true, id: shiftId };
  });
}

async function clockIn({ merchantId, staffId, payload = {} }) {
  return withTenantContext(merchantId, async (client) => {
    const open = await hrRepository.findOpenTimesheet(client, { merchantId, staffId });
    if (open) {
      throw new HrError("Already clocked in; clock out first", 409);
    }

    const today = todayInJakarta();
    const shift = await hrRepository.findOpenShiftForDay(client, { merchantId, staffId, date: today });

    const timesheet = await hrRepository.insertTimesheet(client, {
      merchantId,
      staffId,
      shiftId: shift ? shift.id : null,
      notes: payload.notes || null,
    });

    return { ...timesheet, linked_shift: Boolean(shift) };
  });
}

async function clockOut({ merchantId, staffId, payload = {} }) {
  return withTenantContext(merchantId, async (client) => {
    const open = await hrRepository.findOpenTimesheet(client, { merchantId, staffId });
    if (!open) {
      throw new HrError("No open timesheet; clock in first", 409);
    }

    const closed = await hrRepository.closeTimesheet(client, {
      merchantId,
      timesheetId: open.id,
      notes: payload.notes || null,
    });

    const durationMinutes = closed.clock_out
      ? Math.floor((new Date(closed.clock_out) - new Date(closed.clock_in)) / 60000)
      : null;

    return { ...closed, duration_minutes: durationMinutes };
  });
}

async function listTimesheets({ merchantId, staffId, from, to, limit, offset }) {
  return withTenantContext(merchantId, async (client) => {
    return hrRepository.listTimesheets(client, {
      merchantId, staffId, from, to, limit: Number(limit), offset: Number(offset),
    });
  });
}

async function getStaffPerformance({ merchantId, from, to }) {
  return withTenantContext(merchantId, async (client) => {
    const { startDate, endDate } = resolveRange({ from, to, defaultDays: 6 });
    const rows = await hrRepository.staffPerformance(client, {
      merchantId,
      fromIso: dayStartIso(startDate),
      toIso: dayEndIso(endDate),
    });

    return {
      period: { from: startDate, to: endDate },
      data: rows,
    };
  });
}

async function updateStaffHr({ merchantId, staffId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await hrRepository.findStaffById(client, { merchantId, staffId });
    if (!existing) {
      throw new HrError("Staff not found", 404);
    }

    return hrRepository.updateStaffHr(client, { merchantId, staffId, updates: payload });
  });
}

async function calculateCommissions({ merchantId, date }) {
  const targetDate = date || todayInJakarta();

  return withTenantContext(merchantId, async (client) => {
    const staffWithRate = await hrRepository.listStaffWithRate(client, merchantId);
    const sales = await hrRepository.dailySalesPerStaff(client, {
      merchantId,
      fromIso: dayStartIso(targetDate),
      toIso: dayEndIso(targetDate),
    });
    const salesByStaff = new Map(sales.map((row) => [row.staff_id, row]));

    const results = [];
    for (const staff of staffWithRate) {
      const staffSales = salesByStaff.get(staff.id);
      const baseAmount = Number(staffSales?.total_sales || 0);
      const rate = Number(staff.commission_rate);
      const amount = Math.round(baseAmount * rate * 100) / 100;

      const commission = await hrRepository.upsertCommission(client, {
        merchantId,
        staffId: staff.id,
        periodDate: targetDate,
        baseAmount,
        rate,
        amount,
      });
      results.push(commission);
    }

    return { date: targetDate, data: results };
  });
}

async function listCommissions({ merchantId, from, to, status, limit, offset }) {
  return withTenantContext(merchantId, async (client) => {
    return hrRepository.listCommissions(client, {
      merchantId, from, to, status, limit: Number(limit), offset: Number(offset),
    });
  });
}

async function updateCommission({ merchantId, commissionId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await hrRepository.findCommissionById(client, { merchantId, commissionId });
    if (!existing) {
      throw new HrError("Commission not found", 404);
    }

    return hrRepository.updateCommissionStatus(client, {
      merchantId,
      commissionId,
      status: payload.status,
    });
  });
}

module.exports = {
  HrError,
  listShifts,
  createShift,
  updateShift,
  deleteShift,
  clockIn,
  clockOut,
  listTimesheets,
  getStaffPerformance,
  updateStaffHr,
  calculateCommissions,
  listCommissions,
  updateCommission,
};
