/**
 * Non-interactive upload + remote setup for staging (Windows-friendly).
 * Uses password auth from deploy.staging.env — no ssh/scp prompts.
 *
 * Usage (from repo root):
 *   node scripts/deploy-staging-upload.mjs <localTarPath> <localServerEnvPath>
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "ssh2";

function parseEnvFile(content) {
  const map = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    let s = t.startsWith("export ") ? t.slice(7) : t;
    const i = s.indexOf("=");
    if (i < 1) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[k] = v;
  }
  return map;
}

function parseDatabaseUrl(url) {
  const m = url.match(
    /^postgresql:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/([^?]+)/,
  );
  if (!m) throw new Error("Invalid DATABASE_URL (expected postgresql://user:pass@host:port/db)");
  return {
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: m[4] || "5432",
    database: m[5],
  };
}

/** Escape for use inside single-quoted bash string */
function bashSingleQuote(s) {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

function execCommand(conn, command) {
  return new Promise((resolvePromise, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      let errOut = "";
      stream
        .on("close", (code, signal) => {
          if (code === 0) resolvePromise({ out, errOut, code });
          else
            reject(
              new Error(
                `Remote command failed (exit ${code})\n${errOut || out || signal}`,
              ),
            );
        })
        .on("data", (d) => {
          out += d.toString();
        })
        .stderr.on("data", (d) => {
          errOut += d.toString();
        });
    });
  });
}

function sftpFastPut(sftp, localPath, remotePath) {
  return new Promise((resolvePromise, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) reject(err);
      else resolvePromise();
    });
  });
}

function connectSsh({ host, username, password }) {
  return new Promise((resolvePromise, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolvePromise(conn))
      .on("error", reject)
      .connect({
        host,
        port: 22,
        username,
        password,
        readyTimeout: 30000,
      });
  });
}

function getSftp(conn) {
  return new Promise((resolvePromise, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolvePromise(sftp);
    });
  });
}

async function main() {
  const root = resolve(process.cwd());
  const envPath = resolve(root, "deploy.staging.env");
  if (!existsSync(envPath)) {
    throw new Error(`Missing ${envPath}`);
  }
  const envMap = parseEnvFile(readFileSync(envPath, "utf8"));
  const host = envMap.VPS_HOST;
  const username = envMap.VPS_USER || "root";
  const password = envMap.VPS_PASSWORD;
  if (!host || !password) {
    throw new Error("deploy.staging.env: VPS_HOST and VPS_PASSWORD are required");
  }
  const remoteDir = envMap.VPS_PATH || "/var/www/ping-moot-staging";
  const remotePort = envMap.PORT || "3081";
  const appName = envMap.APP_NAME || "ping-moot-staging";
  const databaseUrl = envMap.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("deploy.staging.env: DATABASE_URL is required");
  }

  const tarLocal = resolve(root, process.argv[2] || ".deploy-staging.tar");
  const envLocal = resolve(root, process.argv[3] || ".deploy-staging.server.env");
  if (!existsSync(tarLocal)) throw new Error(`Missing tar: ${tarLocal}`);
  if (!existsSync(envLocal)) throw new Error(`Missing env file: ${envLocal}`);

  const remoteTar = `${remoteDir}/.deploy-staging.tar`;
  const db = parseDatabaseUrl(databaseUrl);

  console.log("== SSH connect ==");
  const conn = await connectSsh({ host, username, password });

  try {
    const sqlEsc = (s) => String(s).replace(/'/g, "''");
    const u = db.user;
    const d = db.database;
    const p = sqlEsc(db.password);

    console.log("== Ensure PostgreSQL role + database ==");
    await execCommand(
      conn,
      `sudo -u postgres psql -d postgres -c "CREATE USER \\"${u}\\" WITH PASSWORD '${p}';" 2>/dev/null || true`,
    );
    await execCommand(
      conn,
      `sudo -u postgres psql -d postgres -c "ALTER USER \\"${u}\\" WITH PASSWORD '${p}';" 2>/dev/null || true`,
    );
    await execCommand(
      conn,
      `sudo -u postgres psql -d postgres -c "CREATE DATABASE \\"${d}\\" OWNER \\"${u}\\";" 2>/dev/null || true`,
    );
    await execCommand(
      conn,
      `sudo -u postgres psql -d \\"${d}\\" -c "GRANT ALL ON SCHEMA public TO \\"${u}\\";" 2>/dev/null || true`,
    );

    console.log("== mkdir remote dir ==");
    await execCommand(conn, `bash -lc ${bashSingleQuote(`mkdir -p "${remoteDir.replace(/"/g, '\\"')}"`)}`);

    console.log("== SFTP upload ==");
    const sftp = await getSftp(conn);
    await sftpFastPut(sftp, tarLocal, remoteTar);
    await sftpFastPut(sftp, envLocal, `${remoteDir}/.env`);
    sftp.end();

    console.log("== Extract + server-setup ==");
    // Strip CRLF from *.sh (Windows tar can ship \\r; bash on Linux then fails with $'\\r').
    const rd = String(remoteDir).replace(/\\/g, "/").replace(/"/g, '\\"');
    const extractAndSetup = `bash -c "cd \\"${rd}\\" && tar -xf .deploy-staging.tar && rm -f .deploy-staging.tar && sed -i 's/\\r$//' scripts/*.sh 2>/dev/null || true && APP_NAME=${appName} PORT=${remotePort} bash scripts/server-setup.sh"`;
    const r = await execCommand(conn, extractAndSetup);
    if (r.out) process.stdout.write(r.out);
    if (r.errOut) process.stderr.write(r.errOut);
  } finally {
    conn.end();
  }

  console.log("");
  console.log("Staging deployed successfully.");
  console.log(`URL: http://${host}:${remotePort}`);
  if (envMap.VITE_WS_URL) {
    console.log(`(WS base from env: ${envMap.VITE_WS_URL})`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
