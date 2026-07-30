/**
 * The tables a project export carries, parents first.
 *
 * Its own module because both halves of the move need it, and importing it
 * from `export-project.mjs` would run an export as a side effect of asking
 * what the list is.
 *
 * `auth_attempt` and `auth_code` are deliberately absent. The first is the rate
 * limiter's memory — who asked for a code and when — and the second holds codes
 * sealed around OTPs the new project never minted. Carrying either across would
 * import nothing but other people's cooldowns and a pile of dead ciphertext.
 */
export const TABLES = [
  'profile',
  'income',
  'expense_item',
  'loan',
  'credit_card',
  'goal',
  'goal_contribution',
  'wishlist_item',
  'scenario',
  'simulation_run',
  'monthly_snapshot',
  'transaction',
  'career_entry',
  'feedback',
];
