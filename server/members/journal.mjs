import { DatabaseSync } from 'node:sqlite';
import { RequestError } from './core.mjs';

export function openJournal(filename) {
  const db = new DatabaseSync(filename);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
  );
  db.exec(`CREATE TABLE IF NOT EXISTS registrations (
    uid TEXT PRIMARY KEY, requestId TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
    fingerprint TEXT NOT NULL, actorUid TEXT NOT NULL, createdAt INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete'))
  )`);
  const byRequest = db.prepare(
    'SELECT * FROM registrations WHERE requestId = ?',
  );
  const byEmail = db.prepare('SELECT * FROM registrations WHERE email = ?');
  const insert = db.prepare(
    'INSERT INTO registrations(uid,requestId,email,fingerprint,actorUid,createdAt) VALUES(?,?,?,?,?,?)',
  );
  const finish = db.prepare(
    "UPDATE registrations SET status='complete' WHERE uid=?",
  );
  return {
    reserve(job) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = byRequest.get(job.requestId) || byEmail.get(job.email);
        if (
          existing &&
          (existing.fingerprint !== job.fingerprint ||
            existing.actorUid !== job.actorUid)
        )
          throw new RequestError(
            409,
            '같은 아이디의 다른 등록 요청이 있습니다. 입력 내용을 확인해 주세요.',
          );
        if (!existing)
          insert.run(
            job.uid,
            job.requestId,
            job.email,
            job.fingerprint,
            job.actorUid,
            job.createdAt,
          );
        db.exec('COMMIT');
        return existing || job;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    complete(uid) {
      finish.run(uid);
    },
    close() {
      db.close();
    },
  };
}
