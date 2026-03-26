import { type Config } from "drizzle-kit";

export default {
  schema: "./src/schema",
  out: "./migrations",
  dialect: "sqlite",
  migrations: {
    prefix: "timestamp",
  },
} satisfies Config;
