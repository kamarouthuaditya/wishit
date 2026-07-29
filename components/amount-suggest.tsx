'use client';

/**
 * One-tap answers for a number nobody has to hand.
 *
 * "How much should my emergency floor be?" has no right answer, but it has
 * three defensible ones, and offering them is faster than explaining the rule
 * of thumb and leaving the field blank. Writes into the input rather than
 * owning its value: the field stays a plain uncontrolled input the server
 * action reads like any other.
 */
export function AmountSuggest({
  target,
  options,
}: {
  /** id of the input to fill. */
  target: string;
  options: { label: string; value: number }[];
}) {
  function fill(value: number) {
    const input = document.getElementById(target) as HTMLInputElement | null;
    if (!input) return;
    input.value = String(value);
    // Native setters are what React and the browser both listen to; assigning
    // `.value` alone leaves anything watching the field none the wiser.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  return (
    <span className="mt-2 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => fill(option.value)}
          className="cursor-pointer border border-line px-2.5 py-1 text-[12px] text-ink-soft transition-colors duration-[140ms] hover:border-accent hover:text-accent"
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}
