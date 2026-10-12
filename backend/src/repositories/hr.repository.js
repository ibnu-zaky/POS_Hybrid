"use strict";

const STAFF_HR_COLUMNS = `id, merchant_id, email, name, role, is_active, created_at,
  hire_date, employment_type, hourly_rate, monthly_salary, commission_rate`;

async function listShifts(client, { merchantId, staffId = null, date = null, from = null, to = null, limit = 20, offset = 0 }) {
  const conditions = ["s.merchant_id = $1"];
  const values = [merchantId];
  let index = 2;

  if (staffId) {
    conditions.push(`s.staff_id = $${index}`);
    values.push(staffId);
    index += 1;
  }
  if (date) {
    conditions.push(`s.shift_date = $${index}`);
    values.push(date);
    index += 1;
  }
  if (from) {
    conditions.push(`s.shift_date >= $${index}`);
    values.push(from);
    index += 1;
  }
  if (to) {
    conditions.push(`s.shift_date <= $${index}`);
    values.push(to);
    index += 1;
  }

  values.push(limit, offset);
  const result = await client.query(
    `SELECT s.id, s.merchant_id, s.staff_id, s.shift_date, s.start_time, s.end_time,
            s.status, s.notes, s.created_at, st.name AS staff_name, st.role AS staff_role
     FROM shifts s
     JOIN staff st ON st.id = s.staff_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.shift_date DESC, s.start_time ASC
     LIMIT $${index} OFFSET $${index + 1}`,
    values,
  );

  return result.rows;
}

async function findShiftById(client, { merchantId, shiftId }) {
  const result = await client.query(
    `SELECT s.id, s.merchant_id, s.staff_id, s.shift_date, s.start_time, s.end_time,
            s.status, s.notes, s.created_at, st.name AS staff_name, st.role AS staff_role
     FROM shifts s
     JOIN staff st ON st.id = s.staff_id
     WHERE s.merchant_id = $1 AND s.id = $2
     LIMIT 1`,
    [merchantId, shiftId],
  );

  return result.rows[0] || null;
}

async function findOpenShiftForDay(client, { merchantId, staffId, date }) {
  const result = await client.query(
    `SELECT id, merchant_id, staff_id, shift_date, start_time, end_time, status, notes, created_at
     FROM shifts
     WHERE merchant_id = $1 AND staff_id = $2 AND shift_date = $3 AND status = 'scheduled'
     ORDER BY start_time ASC
     LIMIT 1`,
    [merchantId, staffId, date],
  );

  return result.rows[0] || null;
}

async function hasOverlappingShift(client, { merchantId, staffId, shiftDate, startTime, endTime, excludeShiftId = null }) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM shifts
     WHERE merchant_id = $1
       AND staff_id = $2
       AND shift_date = $3
       AND status != 'cancelled'
       AND start_time < $5
       AND end_time > $4
       AND ($6::uuid IS NULL OR id != $6)`,
    [merchantId, staffId, shiftDate, startTime, endTime, excludeShiftId],
  );

  return result.rows[0].total > 0;
}

async function insertShift(client, { merchantId, staffId, createdBy, payload }) {
  const result = await client.query(
    `INSERT INTO shifts (merchant_id, staff_id, shift_date, start_time, end_time, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, merchant_id, staff_id, shift_date, start_time, end_time, status, notes, created_at`,
    [merchantId, staffId, payload.shift_date, payload.start_time, payload.end_time, payload.notes || null, createdBy],
  );

  return result.rows[0];
}

async function updateShift(client, { merchantId, shiftId, updates }) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  }

  if (!fields.length) {
    return findShiftById(client, { merchantId, shiftId });
  }

  values.push(shiftId, merchantId);
  const result = await client.query(
    `UPDATE shifts
     SET ${fields.join(", ")}
     WHERE id = $${index} AND merchant_id = $${index + 1}
     RETURNING id, merchant_id, staff_id, shift_date, start_time, end_time, status, notes, created_at`,
    values,
  );

  return result.rows[0] || null;
}

async function removeShift(client, { merchantId, shiftId }) {
  const result = await client.query(
    `DELETE FROM shifts WHERE id = $1 AND merchant_id = $2 RETURNING id`,
    [shiftId, merchantId],
  );

  return result.rowCount > 0;
}

async function findOpenTimesheet(client, { merchantId, staffId }) {
  const result = await client.query(
    `SELECT id, merchant_id, staff_id, shift_id, clock_in, clock_out, notes, created_at
     FROM timesheets
     WHERE merchant_id = $1 AND staff_id = $2 AND clock_out IS NULL
     LIMIT 1`,
    [merchantId, staffId],
  );

  return result.rows[0] || null;
}

async function insertTimesheet(client, { merchantId, staffId, shiftId = null, notes = null }) {
  const result = await client.query(
    `INSERT INTO timesheets (merchant_id, staff_id, shift_id, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING id, merchant_id, staff_id, shift_id, clock_in, clock_out, notes, created_at`,
    [merchantId, staffId, shiftId, notes],
  );

  return result.rows[0];
}

async function closeTimesheet(client, { merchantId, timesheetId, notes = null }) {
  const result = await client.query(
    `UPDATE timesheets
     SET clock_out = NOW(), notes = COALESCE($3, notes)
     WHERE id = $1 AND merchant_id = $2 AND clock_out IS NULL
     RETURNING id, merchant_id, staff_id, shift_id, clock_in, clock_out, notes, created_at`,
    [timesheetId, merchantId, notes],
  );

  return result.rows[0] || null;
}

async function listTimesheets(client, { merchantId, staffId = null, from = null, to = null, limit = 20, offset = 0 }) {
  const conditions = ["t.merchant_id = $1"];
  const values = [merchantId];
  let index = 2;

  if (staffId) {
    conditions.push(`t.staff_id = $${index}`);
    values.push(staffId);
    index += 1;
  }
  if (from) {
    conditions.push(`t.clock_in >= $${index}::timestamptz`);
    values.push(`${from}T00:00:00+07:00`);
    index += 1;
  }
  if (to) {
    conditions.push(`t.clock_in < (($${index}::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')`);
    values.push(to);
    index += 1;
  }

  values.push(limit, offset);
  const result = await client.query(
    `SELECT t.id, t.merchant_id, t.staff_id, t.shift_id, t.clock_in, t.clock_out, t.notes, t.created_at,
            st.name AS staff_name,
            CASE WHEN t.clock_out IS NULL THEN NULL
                 ELSE EXTRACT(EPOCH FROM (t.clock_out - t.clock_in))::int / 60
            END AS duration_minutes
     FROM timesheets t
     JOIN staff st ON st.id = t.staff_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.clock_in DESC
     LIMIT $${index} OFFSET $${index + 1}`,
    values,
  );

  return result.rows;
}

async function staffPerformance(client, { merchantId, fromIso, toIso }) {
  const result = await client.query(
    `SELECT st.id AS staff_id, st.name, st.role, st.commission_rate,
            COUNT(t.id)::int AS transactions_count,
            COALESCE(SUM(t.grand_total), 0)::float AS total_sales,
            COALESCE(AVG(t.grand_total), 0)::float AS average_ticket
     FROM staff st
     LEFT JOIN transactions t
       ON t.staff_id = st.id
      AND t.status = 'completed'
      AND t.created_at >= $2::timestamptz
      AND t.created_at < $3::timestamptz
     WHERE st.merchant_id = $1 AND st.is_active = TRUE
     GROUP BY st.id, st.name, st.role, st.commission_rate
     ORDER BY total_sales DESC, st.name ASC`,
    [merchantId, fromIso, toIso],
  );

  return result.rows;
}

async function findStaffById(client, { merchantId, staffId }) {
  const result = await client.query(
    `SELECT ${STAFF_HR_COLUMNS}
     FROM staff
     WHERE merchant_id = $1 AND id = $2
     LIMIT 1`,
    [merchantId, staffId],
  );

  return result.rows[0] || null;
}

async function updateStaffHr(client, { merchantId, staffId, updates }) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  }

  if (!fields.length) {
    return findStaffById(client, { merchantId, staffId });
  }

  values.push(staffId, merchantId);
  const result = await client.query(
    `UPDATE staff
     SET ${fields.join(", ")}
     WHERE id = $${index} AND merchant_id = $${index + 1}
     RETURNING ${STAFF_HR_COLUMNS}`,
    values,
  );

  return result.rows[0] || null;
}

async function listStaffWithRate(client, merchantId) {
  const result = await client.query(
    `SELECT id, name, role, commission_rate
     FROM staff
     WHERE merchant_id = $1 AND is_active = TRUE AND commission_rate > 0
     ORDER BY name ASC`,
    [merchantId],
  );

  return result.rows;
}

async function dailySalesPerStaff(client, { merchantId, fromIso, toIso }) {
  const result = await client.query(
    `SELECT staff_id, COALESCE(SUM(grand_total), 0)::float AS total_sales, COUNT(*)::int AS transactions_count
     FROM transactions
     WHERE merchant_id = $1
       AND status = 'completed'
       AND created_at >= $2::timestamptz
       AND created_at < $3::timestamptz
     GROUP BY staff_id`,
    [merchantId, fromIso, toIso],
  );

  return result.rows;
}

async function upsertCommission(client, { merchantId, staffId, periodDate, baseAmount, rate, amount }) {
  const result = await client.query(
    `INSERT INTO commissions (merchant_id, staff_id, period_date, base_amount, rate, amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (merchant_id, staff_id, period_date)
     DO UPDATE SET
       base_amount = EXCLUDED.base_amount,
       rate = EXCLUDED.rate,
       amount = EXCLUDED.amount,
       updated_at = NOW()
     RETURNING id, merchant_id, staff_id, period_date, base_amount, rate, amount, status, created_at, updated_at`,
    [merchantId, staffId, periodDate, baseAmount, rate, amount],
  );

  return result.rows[0];
}

async function listCommissions(client, { merchantId, from = null, to = null, status = null, limit = 50, offset = 0 }) {
  const conditions = ["c.merchant_id = $1"];
  const values = [merchantId];
  let index = 2;

  if (from) {
    conditions.push(`c.period_date >= $${index}`);
    values.push(from);
    index += 1;
  }
  if (to) {
    conditions.push(`c.period_date <= $${index}`);
    values.push(to);
    index += 1;
  }
  if (status) {
    conditions.push(`c.status = $${index}`);
    values.push(status);
    index += 1;
  }

  values.push(limit, offset);
  const result = await client.query(
    `SELECT c.id, c.merchant_id, c.staff_id, c.period_date, c.base_amount, c.rate, c.amount,
            c.status, c.created_at, c.updated_at, st.name AS staff_name
     FROM commissions c
     JOIN staff st ON st.id = c.staff_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY c.period_date DESC, st.name ASC
     LIMIT $${index} OFFSET $${index + 1}`,
    values,
  );

  return result.rows;
}

async function findCommissionById(client, { merchantId, commissionId }) {
  const result = await client.query(
    `SELECT c.id, c.merchant_id, c.staff_id, c.period_date, c.base_amount, c.rate, c.amount,
            c.status, c.created_at, c.updated_at, st.name AS staff_name
     FROM commissions c
     JOIN staff st ON st.id = c.staff_id
     WHERE c.merchant_id = $1 AND c.id = $2
     LIMIT 1`,
    [merchantId, commissionId],
  );

  return result.rows[0] || null;
}

async function updateCommissionStatus(client, { merchantId, commissionId, status }) {
  const result = await client.query(
    `UPDATE commissions
     SET status = $3, updated_at = NOW()
     WHERE merchant_id = $1 AND id = $2
     RETURNING id, merchant_id, staff_id, period_date, base_amount, rate, amount, status, created_at, updated_at`,
    [merchantId, commissionId, status],
  );

  return result.rows[0] || null;
}

module.exports = {
  listShifts,
  findShiftById,
  findOpenShiftForDay,
  hasOverlappingShift,
  insertShift,
  updateShift,
  removeShift,
  findOpenTimesheet,
  insertTimesheet,
  closeTimesheet,
  listTimesheets,
  staffPerformance,
  findStaffById,
  updateStaffHr,
  listStaffWithRate,
  dailySalesPerStaff,
  upsertCommission,
  listCommissions,
  findCommissionById,
  updateCommissionStatus,
};
