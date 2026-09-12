import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, openSync, closeSync, writeFileSync, fsyncSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";

// Local, single-host deployment only. A durable claim survives process death:
// uncertain external operations must be inspected, never silently replayed.
export function directory() {
  return resolve(process.env.WORKPILOT_DATA_DIR || ".data/workpilot",
    process.env.WORKPILOT_DEMO === "true" ? "rehearsal" : "live");
}
function folder(kind: string) {
  const dir = join(directory(), kind);
  mkdirSync(dir, { recursive: true });
  return dir;
}
function path(kind: string, id: string) {
  return join(folder(kind), createHash("sha256").update(id).digest("hex") + ".json");
}
export function readRecord<T>(kind: string, id: string): T | undefined {
  try { return JSON.parse(readFileSync(path(kind, id), "utf8")) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw e; }
}
export function writeRecord<T>(kind: string, id: string, value: T) {
  const target = path(kind, id);
  const temporary = target + "." + randomUUID() + ".tmp";
  const fd = openSync(temporary, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, target);
}
export function listRecords<T>(kind: string): T[] {
  return readdirSync(folder(kind)).filter(name => name.endsWith(".json"))
    .map(name => JSON.parse(readFileSync(join(folder(kind), name), "utf8")) as T);
}
export function claimRecord(kind: string, id: string): boolean {
  try {
    const fd = openSync(path(kind, id), "wx", 0o600);
    try { writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); fsyncSync(fd); }
    finally { closeSync(fd); }
    return true;
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "EEXIST") return false; throw e; }
}
export function releaseRecord(kind: string, id: string) { unlinkSync(path(kind, id)); }
export class DiskMap<T> {
  constructor(private kind: string) {}
  get(id: string): T | undefined { return readRecord<T>(this.kind, id); }
  set(id: string, value: T) { writeRecord(this.kind, id, value); }
  values(): T[] { return listRecords<T>(this.kind); }
}
