import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const buildNumberPath = path.join(root, ".build-number");

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@aws-sdk/client-s3",
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  let buildNumber = 1;
  try {
    const num = await readFile(buildNumberPath, "utf-8");
    buildNumber = Math.max(1, parseInt(num.trim(), 10) || 1);
  } catch {
    /* файла нет — остаётся 1 */
  }
  const nextNumber = buildNumber + 1;
  await writeFile(buildNumberPath, String(nextNumber), "utf-8");
  process.env.BUILD_VERSION = String(buildNumber);
  console.log(`building client (версия ${buildNumber})...`);
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: [path.join(root, "server/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.join(root, "dist/index.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.BUILD_VERSION": JSON.stringify(process.env.BUILD_VERSION || "0"),
    },
    minify: true,
    external: externals,
    logLevel: "info",
    alias: {
      "@shared": path.join(root, "shared"),
      "@pingok-micro-shared": path.join(root, "ПИНГОК МИКРО", "shared"),
    },
  });

  console.log("building pingok-micro (standalone)...");
  await esbuild({
    entryPoints: [path.join(root, "ПИНГОК МИКРО", "server", "index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.join(root, "dist/pingok-micro.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("building seed-admin...");
  const seedExternals = externals.filter((d) => d !== "dotenv");
  await esbuild({
    entryPoints: [path.join(root, "scripts/seed-admin.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.join(root, "dist/seed-admin.cjs"),
    minify: false,
    external: seedExternals,
    logLevel: "info",
    alias: {
      "@shared": path.join(root, "shared"),
    },
  });
  console.log("building seed-first-user...");
  await esbuild({
    entryPoints: [path.join(root, "scripts/seed-first-user.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.join(root, "dist/seed-first-user.cjs"),
    minify: false,
    external: seedExternals,
    logLevel: "info",
    alias: {
      "@shared": path.join(root, "shared"),
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
