'use client';

import { useState } from 'react';

/**
 * The category of an expense, as a dropdown.
 *
 * It was an `<input list>` bound to a datalist. That is a combobox on paper and
 * a plain text box on screen: no arrow, no affordance, and in Chrome the list
 * only appears once you have typed a character that matches something. People
 * read it as a free-text field and typed `Food`, `food` and `FOOD` into what is
 * meant to be a small closed set.
 *
 * So: a real `<select>` of the categories already in use, plus one option that
 * turns the control into a text field for a genuinely new one. The select keeps
 * the platform's own popup — on a phone that is the wheel, which is the whole
 * argument for not building a custom menu here.
 */

const NEW = '__new';

export function CategorySelect({
  categories,
  defaultValue,
  name = 'category',
  className = '',
  id,
}: {
  categories: string[];
  defaultValue?: string;
  name?: string;
  className?: string;
  id?: string;
}) {
  // A row whose category is no longer in anyone's list still has to show it.
  const options = defaultValue && !categories.includes(defaultValue)
    ? [defaultValue, ...categories]
    : categories;

  const [typing, setTyping] = useState(false);

  if (typing) {
    return (
      <span className="flex items-center gap-2">
        <input
          name={name}
          id={id}
          autoFocus
          required
          placeholder="New category"
          aria-label="New category"
          className={`${field} flex-1 ${className}`}
        />
        <button
          type="button"
          onClick={() => setTyping(false)}
          className="cursor-pointer text-[12px] text-ink-faint transition-colors duration-[140ms] hover:text-accent"
        >
          Pick one
        </button>
      </span>
    );
  }

  return (
    <select
      name={name}
      id={id}
      defaultValue={defaultValue ?? options[0] ?? 'general'}
      onChange={(event) => {
        if (event.target.value === NEW) setTyping(true);
      }}
      className={`${field} w-full ${className}`}
    >
      {options.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
      <option value={NEW}>New category…</option>
    </select>
  );
}

const field =
  'mt-1.5 border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none ' +
  'transition-colors duration-[140ms] hover:border-line-strong focus:border-accent ' +
  'placeholder:text-ink-faint';
