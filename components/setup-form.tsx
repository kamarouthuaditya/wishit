'use client';

import { useActionState, useState } from 'react';
import { saveSetup, type SetupResult } from '@/lib/actions';
import { Button, Field, Input, Select } from '@/components/ui';
import { IconCheck, IconClose } from '@/components/icons';
import type { IncomeRow, ProfileRow } from '@/lib/db/types';

/**
 * Settings, with an answer when you press Save.
 *
 * These fields are what every projection in the app is built on, so a save that
 * changed your salary should not look identical to a save that changed nothing.
 * The dialog lists what actually moved.
 *
 * Laid out as one form in three numbered parts rather than three panels: it is
 * a single act with sections, not three unrelated things stacked. The save bar
 * sticks to the bottom because the form is taller than the viewport and a Save
 * button you have to scroll to find is a Save button people forget to press.
 */
export function SetupForm({
  profile,
  salary,
  bonus,
}: {
  profile: ProfileRow;
  salary: IncomeRow | undefined;
  bonus: IncomeRow | undefined;
}) {
  const [result, formAction, pending] = useActionState<SetupResult | null, FormData>(
    saveSetup,
    null,
  );
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const showing = result != null && dismissed !== result.at;

  return (
    <>
      <form
        action={formAction}
        // Any keystroke counts as touched. Cheaper and more honest than
        // diffing every field: the server still decides what actually moved.
        onInput={() => setTouched(true)}
        onChange={() => setTouched(true)}
        className="pb-24"
      >
        <Section
          index="01"
          title="Income"
          hint="What arrives, and when. Everything downstream is a share of this."
        >
          <Field label="Your name">
            <Input name="name" defaultValue={profile.name} />
          </Field>
          <Field label="Pay date" hint="Day of the month your salary lands">
            <Input
              name="pay_date"
              type="number"
              min={1}
              max={31}
              defaultValue={profile.pay_date}
            />
          </Field>
          <Field
            label="Net monthly salary"
            hint="What actually reaches your account, after tax"
          >
            <Input
              name="net_salary"
              type="number"
              step="1"
              defaultValue={salary ? Number(salary.amount) : ''}
              placeholder="120000"
            />
          </Field>
          <Field label="Annual bonus" hint="Enter 0 if none">
            <Input
              name="bonus_amount"
              type="number"
              step="1"
              defaultValue={bonus ? Number(bonus.amount) : 0}
            />
          </Field>
          <Field label="Bonus due in" hint="Months from now">
            <Input
              name="bonus_month"
              type="number"
              min={1}
              max={12}
              defaultValue={bonus?.bonus_month ?? 4}
            />
          </Field>
          <Field
            label="How to count the bonus"
            hint="As a lump sum it shows when waiting for the bonus makes a purchase affordable"
          >
            <Select name="bonus_mode" defaultValue={profile.bonus_mode}>
              <option value="lump">Lump sum, in the month it arrives</option>
              <option value="amortised">Spread evenly across 12 months</option>
            </Select>
          </Field>
        </Section>

        <Section
          index="02"
          title="Balances"
          hint="What you have, and the line you will not cross."
        >
          <Field
            label="Available savings"
            hint="Cash and savings you can actually reach — not PF or locked deposits"
          >
            <Input
              name="liquid_corpus"
              type="number"
              step="1"
              defaultValue={Number(profile.liquid_corpus)}
            />
          </Field>
          <Field
            label="Emergency floor"
            hint="The line you never cross. Anything taking savings below it is flagged red."
          >
            <Input
              name="emergency_floor"
              type="number"
              step="1"
              defaultValue={Number(profile.emergency_floor)}
            />
          </Field>
        </Section>

        <Section
          index="03"
          title="Modelling"
          hint="Safe to leave alone. The defaults keep every projection conservative."
        >
          <Field
            label="Expected return on savings (%)"
            hint="Per year. At 0 the app never counts on money you have not earned."
          >
            <Input
              name="annual_return_pct"
              type="number"
              step="0.1"
              defaultValue={Number(profile.annual_return_pct)}
            />
          </Field>
          <Field
            label="Inflation on variable expenses (%)"
            hint="Per year. Barely moves a 12-month answer; matters over three years."
          >
            <Input
              name="annual_inflation_pct"
              type="number"
              step="0.1"
              defaultValue={Number(profile.annual_inflation_pct)}
            />
          </Field>
          <Field label="Goal allocation" hint="How surplus is divided between your goals">
            <Select name="allocation_mode" defaultValue={profile.allocation_mode}>
              <option value="waterfall">Priority order — fill the top goal first</option>
              <option value="fixed">Fixed amount into each goal</option>
              <option value="proportional">Split proportionally</option>
            </Select>
          </Field>
          <Field label="Projection horizon" hint="Months">
            <Input
              name="horizon_months"
              type="number"
              min={12}
              max={120}
              defaultValue={profile.horizon_months}
            />
          </Field>
        </Section>

        {/*
          Sits above the mobile tab bar, not behind it: the bar is 3.5rem plus
          whatever the device reserves at the bottom, and a Save button hidden
          under it is a Save button that does not exist.
        */}
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-5 mt-8 flex items-center justify-between gap-4 border-t border-line-strong bg-surface px-5 py-3.5 md:bottom-0">
          <p className="text-[12px] text-ink-faint">
            {touched
              ? 'Unsaved edits — nothing is in your projections yet.'
              : 'Every number here feeds the dashboard.'}
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      {showing && (
        <SaveDialog
          result={result}
          onClose={() => {
            setDismissed(result.at);
            setTouched(false);
          }}
        />
      )}
    </>
  );
}

/**
 * A numbered part of the form. The rule and the index carry the grouping, so
 * the page stays one surface instead of a stack of boxes.
 */
function Section({
  index,
  title,
  hint,
  children,
}: {
  index: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    // The rule separates parts, so the first part does not get one. Driven off
    // the index rather than `first:` — the form's first child is not always
    // this component once a validation banner is in play.
    <section
      className={
        index === '01' ? 'pb-7' : 'border-t border-line py-7'
      }
    >
      <header className="flex gap-4">
        <span className="tnum mt-0.5 text-[12px] text-accent">{index}</span>
        <div>
          <h2 className="font-display text-[20px] leading-none">{title}</h2>
          <p className="mt-2 max-w-prose text-[13px] text-ink-faint">{hint}</p>
        </div>
      </header>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 sm:pl-10">{children}</div>
    </section>
  );
}

function SaveDialog({ result, onClose }: { result: SetupResult; onClose: () => void }) {
  const changed = result.changes.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-saved-title"
      // Clicking the backdrop closes it; clicking the panel does not.
      onClick={onClose}
    >
      <div
        className="rise w-full max-w-md border border-line-strong bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2
            id="setup-saved-title"
            className="flex items-center gap-2 font-display text-[18px] leading-none"
          >
            <span className={changed ? 'text-accent' : 'text-ink-faint'}>
              {changed ? <IconCheck size={16} /> : <IconClose size={16} />}
            </span>
            {changed ? 'Settings saved' : 'Nothing to save'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-ink-faint transition-colors duration-[140ms] hover:text-ink"
          >
            <IconClose size={16} />
          </button>
        </header>

        <div className="px-5 py-4">
          {changed ? (
            <>
              <p className="text-[13px] text-ink-soft">
                {result.changes.length === 1
                  ? 'One change is now in every projection:'
                  : `${result.changes.length} changes are now in every projection:`}
              </p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {result.changes.map((line) => (
                  <li key={line} className="flex gap-2.5 py-2.5 text-[14px]">
                    <span aria-hidden className="mt-0.5 text-accent">
                      <IconCheck size={14} />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-ink-soft">
              Everything already matched what you had. Nothing moved.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-line px-5 py-3.5">
          <Button type="button" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
