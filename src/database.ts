import path from 'node:path';

import { app } from 'electron';
import sqlite3 from 'sqlite3';

import {
  Appointment,
  AppointmentPreparationUpdate,
  AppointmentUpsert,
  createPreparationChecklist,
  createSeedAppointment,
} from './shared/appointments';

// ==========================================
// ARCHITECTURE BASE DE DONNÉES (MAIN PROCESS)
// ==========================================
// Ce fichier est exécuté côté serveur (Node.js) dans le process "main" d'Electron.
// Il gère toute la logique de persistance avec `sqlite3`.
//
// Concepts clés :
// 1. `sqlite3` est basé sur des callbacks asynchrones (ex: db.run(sql, params, callback)).
// 2. Pour garder un code moderne et lisible (async/await), on crée de petites fonctions 
//    utilitaires (`run`, `all`, `get`) qui "promisifient" (transforment en Promises) ces callbacks.

type AppointmentRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  client: string;
  company: string;
  goal: string;
  notes: string;
  position: number;
};

type ChecklistRow = {
  id: string;
  appointment_id: string;
  item_key: string;
  label: string;
  checked: number;
};

let database: sqlite3.Database | null = null;

// Petite couche utilitaire pour manipuler sqlite3 en Promises.
const run = (db: sqlite3.Database, sql: string, params: unknown[] = []) =>
  new Promise<{ lastID: number; changes: number }>((resolve, reject) => {
    db.run(sql, params, function onResult(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });

const all = <T>(db: sqlite3.Database, sql: string, params: unknown[] = []) =>
  new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows as T[]);
    });
  });

const get = <T>(db: sqlite3.Database, sql: string, params: unknown[] = []) =>
  new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row as T | undefined);
    });
  });

const openDatabase = () => {
  if (database) {
    return database;
  }

  const dbPath = path.join(app.getPath('userData'), 'meetprep.sqlite');
  database = new sqlite3.Database(dbPath);
  return database;
};

const insertChecklistItems = async (db: sqlite3.Database, appointment: Appointment) => {
  for (const item of appointment.preparationChecklist) {
    await run(
      db,
      `
        INSERT INTO preparation_items (id, appointment_id, item_key, label, checked)
        VALUES (?, ?, ?, ?, ?)
      `,
      [crypto.randomUUID(), appointment.id, item.id, item.label, item.checked ? 1 : 0],
    );
  }
};

const buildAppointmentList = async (db: sqlite3.Database): Promise<Appointment[]> => {
  const appointmentRows = await all<AppointmentRow>(
    db,
    `
      SELECT id, title, date, time, client, company, goal, notes, position
      FROM appointments
      ORDER BY position ASC, created_at DESC
    `,
  );
  const checklistRows = await all<ChecklistRow>(
    db,
    `
      SELECT id, appointment_id, item_key, label, checked
      FROM preparation_items
      ORDER BY rowid ASC
    `,
  );

  return appointmentRows.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    fields: {
      client: row.client,
      company: row.company,
      goal: row.goal,
      notes: row.notes,
    },
    preparationChecklist: checklistRows
      .filter((item) => item.appointment_id === row.id)
      .map((item) => ({
        id: item.item_key,
        label: item.label,
        checked: Boolean(item.checked),
      })),
  }));
};

// ==========================================
// INITIALISATION DE LA BASE DE DONNÉES
// ==========================================
// Initialise les tables SQLite et injecte un rendez-vous "seed" de démonstration si la base est vide.
export const initializeDatabase = async () => {
  const db = openDatabase();

  await run(
    db,
    `
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        client TEXT NOT NULL,
        company TEXT NOT NULL,
        goal TEXT NOT NULL,
        notes TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  );
  await run(
    db,
    `
      CREATE TABLE IF NOT EXISTS preparation_items (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL,
        item_key TEXT NOT NULL,
        label TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE
      )
    `,
  );

  const countRow = await get<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM appointments');

  if (!countRow?.count) {
    const seed = createSeedAppointment();

    await run(
      db,
      `
        INSERT INTO appointments (id, title, date, time, client, company, goal, notes, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        seed.id,
        seed.title,
        seed.date,
        seed.time,
        seed.fields.client,
        seed.fields.company,
        seed.fields.goal,
        seed.fields.notes,
      ],
    );
    await insertChecklistItems(db, seed);
  }
};

export const listAppointments = async () => {
  const db = openDatabase();
  return buildAppointmentList(db);
};

export const saveAppointment = async (payload: AppointmentUpsert) => {
  const db = openDatabase();

  if (payload.id) {
    await run(
      db,
      `
        UPDATE appointments
        SET title = ?, date = ?, time = ?, client = ?, company = ?
        WHERE id = ?
      `,
      [payload.title, payload.date, payload.time, payload.client, payload.company, payload.id],
    );

    return buildAppointmentList(db);
  }

  const currentMax = await get<{ maxPosition: number | null }>(
    db,
    'SELECT MAX(position) AS maxPosition FROM appointments',
  );
  const nextPosition = (currentMax?.maxPosition ?? -1) + 1;
  const appointment: Appointment = {
    id: crypto.randomUUID(),
    title: payload.title.trim() || 'Nouveau rendez-vous',
    date: payload.date,
    time: payload.time,
    fields: {
      client: payload.client,
      company: payload.company,
      goal: '',
      notes: '',
    },
    preparationChecklist: createPreparationChecklist(),
  };

  await run(
    db,
    `
      INSERT INTO appointments (id, title, date, time, client, company, goal, notes, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      appointment.id,
      appointment.title,
      appointment.date,
      appointment.time,
      appointment.fields.client,
      appointment.fields.company,
      appointment.fields.goal,
      appointment.fields.notes,
      nextPosition,
    ],
  );
  await insertChecklistItems(db, appointment);

  return buildAppointmentList(db);
};

export const deleteAppointment = async (appointmentId: string) => {
  const db = openDatabase();

  await run(db, 'DELETE FROM preparation_items WHERE appointment_id = ?', [appointmentId]);
  await run(db, 'DELETE FROM appointments WHERE id = ?', [appointmentId]);

  return buildAppointmentList(db);
};

export const savePreparation = async (payload: AppointmentPreparationUpdate) => {
  const db = openDatabase();

  await run(
    db,
    `
      UPDATE appointments
      SET goal = ?, notes = ?
      WHERE id = ?
    `,
    [payload.goal, payload.notes, payload.id],
  );

  for (const item of payload.preparationChecklist) {
    await run(
      db,
      `
        UPDATE preparation_items
        SET label = ?, checked = ?
        WHERE appointment_id = ? AND item_key = ?
      `,
      [item.label, item.checked ? 1 : 0, payload.id, item.id],
    );
  }

  return buildAppointmentList(db);
};
