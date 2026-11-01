"use strict";

const { z } = require("zod");

const createTableSchema = z.object({
  number: z.number().int().positive(),
}).strict();

module.exports = {
  createTableSchema,
};