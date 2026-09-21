/** The group's six sections, named in one place so the shell and the tabs agree. */
export type GroupSection =
  | 'overview'
  | 'expenses'
  | 'balances'
  | 'settlements'
  | 'members'
  | 'activity';

export const GROUP_SECTIONS: { value: GroupSection; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'balances', label: 'Balances' },
  { value: 'settlements', label: 'Settlements' },
  { value: 'members', label: 'Members' },
  { value: 'activity', label: 'Activity' },
];
