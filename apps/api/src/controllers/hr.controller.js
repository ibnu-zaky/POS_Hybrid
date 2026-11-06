const hrService = require("../services/hr.service");
const {
  createShiftSchema,
  updateShiftSchema,
  timesheetQuerySchema,
  performanceQuerySchema,
  commissionQuerySchema,
  calculateCommissionSchema,
  updateCommissionSchema,
  updateStaffHrSchema,
} = require("../schemas/hr.schema");

function tenant(request) { return request.auth.merchant_id; }

async function listShifts(request, response, next) {
  try {
    const query = timesheetQuerySchema.parse(request.query);
    const data = await hrService.listShifts({
      merchantId: tenant(request),
      staffId: request.query.staff_id,
      date: request.query.date,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    });
    response.json({ data });
  } catch (error) { next(error); }
}

async function createShift(request, response, next) {
  try {
    const body = createShiftSchema.parse(request.body);
    const shift = await hrService.createShift({
      merchantId: tenant(request),
      staffId: request.auth.sub,
      payload: body,
    });
    response.status(201).json({ data: shift });
  } catch (error) { next(error); }
}

async function updateShift(request, response, next) {
  try {
    const body = updateShiftSchema.parse(request.body);
    const shift = await hrService.updateShift({
      merchantId: tenant(request),
      shiftId: request.params.id,
      payload: body,
    });
    response.json({ data: shift });
  } catch (error) { next(error); }
}

async function deleteShift(request, response, next) {
  try {
    const result = await hrService.deleteShift({
      merchantId: tenant(request),
      shiftId: request.params.id,
    });
    response.json({ data: result });
  } catch (error) { next(error); }
}

async function listTimesheets(request, response, next) {
  try {
    const query = timesheetQuerySchema.parse(request.query);
    const data = await hrService.listTimesheets({
      merchantId: tenant(request),
      staffId: query.staff_id,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    });
    response.json({ data });
  } catch (error) { next(error); }
}

async function staffPerformance(request, response, next) {
  try {
    const query = performanceQuerySchema.parse(request.query);
    const result = await hrService.getStaffPerformance({
      merchantId: tenant(request),
      from: query.from,
      to: query.to,
    });
    response.json({ period: result.period, data: result.data });
  } catch (error) { next(error); }
}

async function updateStaffHr(request, response, next) {
  try {
    const body = updateStaffHrSchema.parse(request.body);
    const staff = await hrService.updateStaffHr({
      merchantId: tenant(request),
      staffId: request.params.id,
      payload: body,
    });
    response.json({ data: staff });
  } catch (error) { next(error); }
}

async function calculateCommissions(request, response, next) {
  try {
    const query = calculateCommissionSchema.parse(request.query);
    const result = await hrService.calculateCommissions({
      merchantId: tenant(request),
      date: query.date,
    });
    response.json({ date: result.date, data: result.data });
  } catch (error) { next(error); }
}

async function listCommissions(request, response, next) {
  try {
    const query = commissionQuerySchema.parse(request.query);
    const data = await hrService.listCommissions({
      merchantId: tenant(request),
      from: query.from,
      to: query.to,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    response.json({ data });
  } catch (error) { next(error); }
}

async function updateCommission(request, response, next) {
  try {
    const body = updateCommissionSchema.parse(request.body);
    const data = await hrService.updateCommission({
      merchantId: tenant(request),
      commissionId: request.params.id,
      payload: body,
    });
    response.json({ data });
  } catch (error) { next(error); }
}

module.exports = {
  listShifts,
  createShift,
  updateShift,
  deleteShift,
  listTimesheets,
  staffPerformance,
  updateStaffHr,
  calculateCommissions,
  listCommissions,
  updateCommission,
};
