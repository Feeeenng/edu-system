import "server-only";
import initSqlJs from "sql.js/dist/sql-asm.js";
import type { Database as SqlDatabase, SqlJsStatic } from "sql.js";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dedupeDeliveries } from "@/lib/data/dedupe";
import { validateDeliveryRecordShape } from "@/lib/data/validation";
import type { DeliveryRecord } from "@/lib/types";

const DEFAULT_SQLITE_PATH = path.join(process.cwd(), "data", "deliveries.sqlite");

let sqlModulePromise: Promise<SqlJsStatic> | undefined;

function getSqlitePath() {
  return process.env.SQLITE_DB_PATH?.trim() || DEFAULT_SQLITE_PATH;
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function getSqlModule() {
  sqlModulePromise ??= initSqlJs();
  return sqlModulePromise;
}

function ensureSchema(db: SqlDatabase) {
  db.run(`
    create table if not exists deliveries (
      id text primary key,
      payload text not null,
      updated_at text not null
    );
  `);
  db.run("create index if not exists deliveries_updated_at_idx on deliveries (updated_at desc);");
}

async function openDatabase(filePath = getSqlitePath()) {
  const SQL = await getSqlModule();

  try {
    const data = await readFile(filePath);
    const db = new SQL.Database(data);
    ensureSchema(db);
    return db;
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
    const db = new SQL.Database();
    ensureSchema(db);
    return db;
  }
}

function parseRecord(payload: string, rowIndex: number): DeliveryRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error(`SQLite 交付数据损坏：第 ${rowIndex} 条记录 JSON 格式错误`, { cause: error });
  }

  const result = validateDeliveryRecordShape(parsed);
  if (!result.ok) {
    throw new Error(`SQLite 交付数据损坏：第 ${rowIndex} 条记录${result.error}`);
  }

  return parsed as DeliveryRecord;
}

async function persistDatabase(db: SqlDatabase, filePath = getSqlitePath()) {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await mkdir(dir, { recursive: true });
  await writeFile(tempPath, Buffer.from(db.export()));
  await rename(tempPath, filePath);
}

export async function readSqliteRecords(filePath = getSqlitePath()): Promise<DeliveryRecord[]> {
  const db = await openDatabase(filePath);
  try {
    const result = db.exec("select payload from deliveries order by updated_at desc");
    const rows = result[0]?.values ?? [];
    return dedupeDeliveries(rows.map((row, index) => parseRecord(String(row[0]), index + 1)));
  } finally {
    db.close();
  }
}

export async function writeSqliteRecords(records: DeliveryRecord[], filePath = getSqlitePath()) {
  const db = await openDatabase(filePath);
  try {
    db.run("begin transaction;");
    db.run("delete from deliveries;");
    const statement = db.prepare("insert into deliveries (id, payload, updated_at) values (?, ?, ?);");

    try {
      for (const record of dedupeDeliveries(records)) {
        const result = validateDeliveryRecordShape(record);
        if (!result.ok) throw new Error(`SQLite 待写入数据无效：${result.error}`);
        statement.run([record.id, JSON.stringify(record), record.updatedAt]);
      }
    } finally {
      statement.free();
    }

    db.run("commit;");
    await persistDatabase(db, filePath);
  } catch (error) {
    try {
      db.run("rollback;");
    } catch {
      // rollback 失败说明事务已经结束，继续抛出原始错误。
    }
    throw error;
  } finally {
    db.close();
  }
}
