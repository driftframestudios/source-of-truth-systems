import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));

export async function fixture(
  t,
  {
    built = true,
    buildFirst = false,
    serverBuilt = true,
    port = "0",
    entry = "serve.mjs",
    entryArgs = [],
    env = {},
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "life-sciences-server-"));
  // Register cleanup before setup so a failed fixture also releases its directory.
  let child;
  let exited;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null)
      child.kill();
    if (exited) await exited;
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, "scripts"));
  for (const file of [
    "serve.mjs",
    "build.mjs",
    "documentation-bundle.mjs",
    "database.mjs",
  ]) {
    await cp(join(repository, "scripts", file), join(root, "scripts", file));
  }
  await cp(
    join(repository, "scripts/documentation"),
    join(root, "scripts/documentation"),
    { recursive: true },
  );
  await cp(join(repository, "server"), join(root, "server"), {
    recursive: true,
  });
  await cp(join(repository, "shared"), join(root, "shared"), {
    recursive: true,
  });
  await mkdir(join(root, "build/server"), { recursive: true });
  await cp(
    join(repository, "build/server/example-data.mjs"),
    join(root, "example-data.fixture.mjs"),
  );
  if (serverBuilt)
    await cp(
      join(root, "example-data.fixture.mjs"),
      join(root, "build/server/example-data.mjs"),
    );
  await mkdir(join(root, "node_modules/vite/bin"), { recursive: true });
  for (const dependency of [
    "markdown-it",
    "mysql2",
    "pg",
    "serve-handler",
    "graphql",
    "graphql-yoga",
    "@graphql-yoga/plugin-persisted-operations",
    "@whatwg-node/server",
  ]) {
    const target = join(root, "node_modules", dependency);
    await mkdir(dirname(target), { recursive: true });
    await symlink(join(repository, "node_modules", dependency), target, "dir");
  }
  await writeFile(
    join(root, "node_modules/vite/bin/vite.js"),
    `
    const fs = require('node:fs');
    if (process.argv.includes('vite.server.config.ts')) {
      fs.copyFileSync('example-data.fixture.mjs', 'build/server/example-data.mjs');
    } else if (process.argv.includes('vite.docs.config.mjs')) {
      fs.cpSync('.docs-build/app', 'dist/docs', {recursive:true});
    } else {
      fs.mkdirSync('dist', { recursive: true });
      fs.writeFileSync('dist/index.html', '<title>Built in ' + process.env.NODE_ENV + '</title>');
    }
  `,
  );
  await writeFile(join(root, "package.json"), '{"private":true}');
  await mkdir(join(root, ".figma/make"), { recursive: true });
  await writeFile(
    join(root, ".figma/make/site.json"),
    JSON.stringify({
      title: "Deployment fixture",
      url: "https://example.invalid",
    }),
  );
  await writeFile(
    join(root, "README.md"),
    "# Deployment fixture\n\nSynthetic documentation for the isolated production-build fixture.\n",
  );
  await mkdir(join(root, "docs"));
  await writeFile(
    join(root, "docs/content-manifest.json"),
    JSON.stringify({
      version: 1,
      profiles: {
        app: { base: "/docs/", output: "dist/docs", origin: "site" },
        foundation: {
          base: "/",
          output: "dist-foundation",
          origin: "https://example.invalid",
        },
      },
      llm: { rootMarkdown: true, license: true, roots: ["docs"] },
      articles: [
        {
          slug: "",
          source: "README.md",
          title: "Documentation fixture",
          description: "A generated reading fixture.",
          group: "Start",
        },
      ],
    }),
  );
  if (built) {
    await mkdir(join(root, "dist/assets"), { recursive: true });
    await writeFile(
      join(root, "dist/index.html"),
      "<!doctype html><title>Deployment fixture</title>",
    );
    await writeFile(
      join(root, "dist/assets/app.js"),
      "export const ready = true;",
    );
    await symlink(join(root, "package.json"), join(root, "dist/private.json"));
  }
  if (buildFirst)
    execFileSync(process.execPath, [join(root, "scripts/build.mjs")], {
      cwd: tmpdir(),
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "pipe",
    });
  child = spawn(
    process.execPath,
    [join(root, "scripts", entry), ...entryArgs],
    {
      cwd: tmpdir(),
      env: {
        ...process.env,
        DATABASE_PROVIDER: "",
        PGHOST: "",
        PGPORT: "",
        PGDATABASE: "",
        PGUSER: "",
        PGPASSWORD: "",
        PGSSLMODE: "",
        PGSSLROOTCERT: "",
        DB_HOST: "",
        DB_PORT: "",
        DB_NAME: "",
        DB_USER: "",
        DB_PASSWORD: "",
        PORT: port,
        NODE_ENV: "production",
        GRAPHQL_EXPLORER: "",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  exited = once(child, "exit");
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  return { child, exited, output: () => output };
}

export async function runningServer(t, options = {}) {
  const process = await fixture(t, options);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(process.output() || "Server did not start")),
      options.waitMs ?? 5000,
    );
    const ready = () => {
      if (/Serving production build on port \d+/.test(process.output())) {
        clearTimeout(timeout);
        resolve();
      }
    };
    process.child.stdout.on("data", ready);
    process.exited.then(() => {
      clearTimeout(timeout);
      reject(new Error(process.output()));
    });
    ready();
  });
  return `http://127.0.0.1:${process.output().match(/on port (\d+)/)[1]}`;
}
