import { describe, expect, it } from 'vitest';
import { plannedReminders, REMINDER_TIME, reminderInstant } from './reminders';
import { fixed, session, set } from './testUtils';
import type { SessionTemplate } from './types';

const template = (id: string, reminderTime?: string): SessionTemplate => ({
  id,
  name: id === 'tpl-a' ? 'Bench' : 'Squat',
  color: '#000',
  native: false,
  weeksCount: 1,
  weeks: { 1: [] },
  ...(reminderTime ? { reminderTime } : {}),
});
const templates = new Map([
  ['tpl-a', template('tpl-a', '18:30')],
  ['tpl-b', template('tpl-b')],
]);
const withTemplate = (s: ReturnType<typeof session>, templateId: string) => ({ ...s, templateId, cycleWeek: null, name: templates.get(templateId)!.name });

const today = '2026-11-25';
const now = reminderInstant(today, '12:00');

describe('rappels de séance', () => {
  it('heure de rappel valide', () => {
    expect(REMINDER_TIME.test('07:05')).toBe(true);
    expect(REMINDER_TIME.test('23:59')).toBe(true);
    expect(REMINDER_TIME.test('24:00')).toBe(false);
    expect(REMINDER_TIME.test('7:05')).toBe(false);
  });

  it('séances à venir du modèle avec rappel, pas encore commencées, triées', () => {
    const planned = (date: string, id: string, templateId = 'tpl-a') => withTemplate(session(date, [set(0, 5, fixed(100))], id), templateId);
    const sessions = [
      planned('2026-11-27', 'later'),
      planned(today, 'tonight'),
      planned(today, 'no-reminder', 'tpl-b'),
      planned('2026-11-24', 'yesterday'),
      planned('2027-02-01', 'too-far'),
      withTemplate(session('2026-11-26', [set(0, 5, fixed(100), 'VALIDATED')], 'started'), 'tpl-a'),
      { ...session('2026-11-26', [set(0, 5, fixed(100))], 'no-template'), templateId: null },
    ];
    const list = plannedReminders(sessions, templates, now, today);
    expect(list.map((r) => r.sessionId)).toEqual(['tonight', 'later']);
    expect(list[0]).toMatchObject({ title: 'Bench', time: '18:30', at: reminderInstant(today, '18:30') });
  });

  it('pas de rappel déjà passé ; plafond du nombre de rappels', () => {
    const s = withTemplate(session(today, [set(0, 5, fixed(100))], 'x'), 'tpl-a');
    expect(plannedReminders([s], templates, reminderInstant(today, '19:00'), today)).toEqual([]);
    const many = Array.from({ length: 10 }, (_, i) => withTemplate(session(`2026-12-0${i}`.replace('-00', '-10'), [set(0, 5, fixed(100))], `s${i}`), 'tpl-a'));
    expect(plannedReminders(many, templates, now, today, 30, 3)).toHaveLength(3);
  });
});
