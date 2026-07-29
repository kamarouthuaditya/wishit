'use client';

import { useId, useState } from 'react';

/**
 * A password field you can read back.
 *
 * Typing a password you cannot see, twice, on a phone keyboard is where most
 * signups are abandoned. The toggle is a button rather than a checkbox so it
 * sits inside the field, and it announces its state for screen readers.
 */
export function PasswordInput({
  name,
  autoComplete,
  autoFocus,
  invalid,
  placeholder,
}: {
  name: string;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        required
        aria-invalid={invalid || undefined}
        className={
          'mt-1 w-full rounded-lg border border-line bg-paper py-2 pl-3 pr-16 text-[14px] outline-none ' +
          'focus:border-accent focus:ring-2 focus:ring-accent/20'
        }
      />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-controls={id}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 mt-1 px-3 text-[12px] font-medium text-ink-soft transition hover:text-ink"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
