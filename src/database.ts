import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';

import {
  Appointment,
  AppointmentPreparationUpdate,
  AppointmentUpsert,
  createPreparationChecklist,
  createSeedAppointment,
} from './shared/appointments';

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

let database: Database.Database | null = null;

const openDatabase = () => {
  if (database) {
    return database;
  }

  const dbPath = path.join(app.getPath('userData'), 'meetprep.sqlite');
  database = new Database(dbPath);
  return database;
};

const insertChecklistItems = (db: Database.Database, appointment: Appointment) => {
  const stmt = db.prepare(`
    INSERT INTO preparation_items (id, appointment_id, item_key, label, checked)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const item of appointment.preparationChecklist) {
    stmt.run(crypto.randomUUID(), appointment.id, item.id, item.label, item.checked ? 1 : 0);
  }
};

const buildAppointmentList = (db: Database.Database): Appointment[] => {
  const appointmentRows = db.prepare(`
    SELECT id, title, date, time, client, company, goal, notes, position
    FROM appointments
    ORDER BY position ASC, created_at DESC
  `).all() as AppointmentRow[];

  const checklistRows = db.prepare(`
    SELECT id, appointment_id, item_key, label, checked
    FROM preparation_items
    ORDER BY rowid ASC
  `).all() as ChecklistRow[];

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

// Initialise les tables SQLite et injecte le seed si la base est vide.
export const initializeDatabase = async () => {
  const db = openDatabase();

  db.exec(`
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
    );

    CREATE TABLE IF NOT EXISTS preparation_items (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      label TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM appointments').get() as { count: number };

  if (!countRow?.count) {
    const seed = createSeedAppointment();

    db.prepare(`
      INSERT INTO appointments (id, title, date, time, client, company, goal, notes, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      seed.id,
      seed.title,
      seed.date,
      seed.time,
      seed.fields.client,
      seed.fields.company,
      seed.fields.goal,
      seed.fields.notes,
    );

    insertChecklistItems(db, seed);
  }
};

export const listAppointments = async () => {
  const db = openDatabase();
  return buildAppointmentList(db);
};

export const saveAppointment = async (payload: AppointmentUpsert) => {
  const db = openDatabase();

  if (payload.id) {
    db.prepare(`
      UPDATE appointments
      SET title = ?, date = ?, time = ?, client = ?, company = ?
      WHERE id = ?
    `).run(payload.title, payload.date, payload.time, payload.client, payload.company, payload.id);

    return buildAppointmentList(db);
  }

  const currentMax = db.prepare('SELECT MAX(position) AS maxPosition FROM appointments').get() as { maxPosition: number | null };
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

  db.prepare(`
    INSERT INTO appointments (id, title, date, time, client, company, goal, notes, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    appointment.id,
    appointment.title,
    appointment.date,
    appointment.time,
    appointment.fields.client,
    appointment.fields.company,
    appointment.fields.goal,
    appointment.fields.notes,
    nextPosition,
  );

  insertChecklistItems(db, appointment);

  return buildAppointmentList(db);
};

export const deleteAppointment = async (appointmentId: string) => {
  const db = openDatabase();

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM preparation_items WHERE appointment_id = ?').run(appointmentId);
    db.prepare('DELETE FROM appointments WHERE id = ?').run(appointmentId);
  });
  
  transaction();

  return buildAppointmentList(db);
};

export const savePreparation = async (payload: AppointmentPreparationUpdate) => {
  const db = openDatabase();

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE appointments
      SET goal = ?, notes = ?
      WHERE id = ?
    `).run(payload.goal, payload.notes, payload.id);

    const updateChecklistStmt = db.prepare(`
      UPDATE preparation_items
      SET label = ?, checked = ?
      WHERE appointment_id = ? AND item_key = ?
    `);

    for (const item of payload.preparationChecklist) {
      updateChecklistStmt.run(item.label, item.checked ? 1 : 0, payload.id, item.id);
    }
  });

  transaction();

  return buildAppointmentList(db);
};
