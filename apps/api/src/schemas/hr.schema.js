const { z } = require("zod");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

const dateField = z.string().refine(isValidDateString, "must be a valid date YYYY-MM-DD");
const timeField = z.string().regex(TIME_PATTERN, "must be HH:MM 24-hour");

const createShiftSchema = z.object({
  staff_id: z.string().uuid(),
  shift_date: dateField,
  start_time: timeField,
  end_time: timeField,
  notes: z.string().max(1000).optional().nullable(),
}).strict().refine(
  (payload) => payload.end_time > payload.start_time,
  { message: "end_time must be after start_time", path: ["end_time"] },
);

const updateShiftSchema = z.object({
  start_time: timeField.optional(),
  end_time: timeField.optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
}).strict();

const timesheetQuerySchema = z.object({
  staff_id: z.string().uuid().optional(),
  from: dateField.optional(),
  to: dateField.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const performanceQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
});

const commissionQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  status: z.enum(["pending", "paid"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const calculateCommissionSchema = z.object({
  date: dateField.optional(),
});

const updateCommissionSchema = z.object({
  status: z.enum(["pending", "paid"]),
}).strict();

const updateStaffHrSchema = z.object({
  hire_date: dateField.optional().nullable(),
  employment_type: z.enum(["full_time", "part_time", "contract"]).optional().nullable(),
  hourly_rate: z.number().nonnegative().optional().nullable(),
  monthly_salary: z.number().nonnegative().optional().nullable(),
  commission_rate: z.number().min(0).max(1).optional(),
}).strict();

const clockSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
});

module.exports = {
  createShiftSchema,
  updateShiftSchema,
  timesheetQuerySchema,
  performanceQuerySchema,
  commissionQuerySchema,
  calculateCommissionSchema,
  updateCommissionSchema,
  updateStaffHrSchema,
  clockSchema,
};
