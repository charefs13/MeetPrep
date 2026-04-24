import { describe, it, expect } from 'vitest';
import { createSeedAppointment, todayIso, appointmentLabel, appointmentSubtitle } from '../shared/appointments';

describe('Appointments Shared Utilities', () => {
  it('should generate a valid todayIso string', () => {
    const today = todayIso();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should create a valid seed appointment', () => {
    const seed = createSeedAppointment();
    expect(seed.id).toBeDefined();
    expect(seed.title).toBe('Demonstration - RDV Client');
    expect(seed.fields.client).toBe('Mohamed Saadi');
    expect(seed.preparationChecklist.length).toBeGreaterThan(0);
  });

  it('should correctly label an appointment', () => {
    const seed = createSeedAppointment();
    seed.date = '2026-04-24';
    const label = appointmentLabel(seed);
    expect(label).toContain('24 avril 2026'); // Example of locale fr-FR output depending on the exact implementation
  });

  it('should correctly subtitle an appointment', () => {
    const seed = createSeedAppointment();
    seed.fields.client = 'Alice';
    seed.fields.company = 'Wonderland Inc';
    const subtitle = appointmentSubtitle(seed);
    expect(subtitle).toBe('Alice - Wonderland Inc');
  });
});
