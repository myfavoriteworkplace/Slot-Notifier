import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

const allowlist = [
  "bcryptjs",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-session",
  "memorystore",
  "passport",
  "passport-local",
  "pg",
  "ws",
  "zod",
  "zod-validation-error",
];

async function buildBackend() {
  await rm("dist-backend", { recursive: true, force: true });

  console.log("Building standalone backend server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/standalone.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist-backend/server.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("Backend build complete! Output: dist-backend/server.cjs");
}

buildBackend().catch((err) => {
  console.error(err);
  process.exit(1);
});
