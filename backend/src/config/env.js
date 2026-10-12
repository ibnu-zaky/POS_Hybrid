require("dotenv").config();

const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("24h"),
  DB_HEALTH_CHECK_INTERVAL_MS: z.coerce.number().int().min(1000).default(30000),
  ALLOW_DEV_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DEV_LOGIN_EMAIL: z.string().email().default("admin@dev.local"),
  DEV_LOGIN_PASSWORD: z.string().min(8).default("devpassword123"),

  // ---- OAuth 2.0 (opsional) ----
  // Jika dikonfigurasi, middleware akan memverifikasi JWT via JWKS URI.
  // Jika tidak dikonfigurasi, sistem menggunakan JWT internal saja.
  OAUTH_JWKS_URI: z.string().url().optional(),
  OAUTH_ISSUER: z.string().optional(),
  OAUTH_AUDIENCE: z.string().optional(),

  // ---- API Key ----
  API_KEY_PREFIX: z.string().min(1).default("pk_live_"),

  // ---- Admin Database (untuk provisioning merchant) ----
  // Koneksi ini boleh menggunakan role dengan BYPASSRLS atau superuser.
  // Di development boleh sama dengan DATABASE_URL.
  ADMIN_DATABASE_URL: z.string().optional(),
  PAYMENT_DEFAULT_CURRENCY: z.string().length(3).default("IDR"),
  PAYMENT_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  STRIPE_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  XENDIT_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().optional(),
  XENDIT_REFUND_URL: z.string().url().optional(),
  QRIS_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  QRIS_PROVIDER: z.enum(["xendit"]).default("xendit"),
  PAYMENT_MODE: z.enum(["dummy", "live"]).default("dummy"),
  DUMMY_PAYMENT_WEBHOOK_SECRET: z.string().min(8).default("dummy-development-secret"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

module.exports = parsed.data;
