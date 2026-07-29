/**
 * What each page is for, written for someone who has never seen it.
 *
 * Half the pages in this app are pairs that sound identical from the nav —
 * Expenses and Spending, Goals and Wishlist, Loans and Cards — and the
 * difference between them is the whole model. A one-line hint under a title
 * cannot carry that, so it lives here: what the page is, what it is *not*, and
 * one worked example with real rupee figures you can follow along with.
 *
 * Content, not markup. `PageGuide` renders it; pages only name their key.
 */

export interface GuideContrast {
  /** The page it gets mistaken for. */
  page: string;
  href: string;
  /** The distinction, stated as a difference and not as two definitions. */
  line: string;
}

export interface GuideStep {
  /** The action, in the words on the screen. */
  action: string;
  /** What the app does about it. */
  result: string;
}

/**
 * Readonly throughout: the entries below are declared `as const` so that
 * `GuideKey` is the union of the real page keys rather than `string`, and a
 * frozen literal is only assignable to readonly fields.
 */
export interface Guide {
  title: string;
  /** One line, under the title in the panel. */
  tagline: string;
  /** What the page is. Short paragraphs; two or three at most. */
  what: readonly string[];
  /** The pages this one gets confused with. */
  notThis?: readonly GuideContrast[];
  example: {
    /** The situation, so the numbers below mean something. */
    readonly setup: string;
    readonly steps: readonly GuideStep[];
    /** The thing to remember once the numbers are gone. */
    readonly takeaway: string;
  };
  /** The rules that are not obvious from looking at the screen. */
  notes?: readonly string[];
}

export const GUIDES = {
  dashboard: {
    title: 'Dashboard',
    tagline: 'What is left this month, and anything that needs a decision.',
    what: [
      'The big figure is one sum: your income, minus expenses, minus loan EMIs, minus what goes into savings and goals, minus anything on the wishlist you have committed to. It is what is genuinely spare each month.',
      'Everything under it is either an exception that wants a decision from you, or a detail you came looking for. If nothing is wrong, nothing shouts.',
    ],
    notThis: [
      {
        page: 'Review',
        href: '/review',
        line: 'The dashboard is right now and forward, built on your plan. Review looks backwards at one finished month and asks whether the plan was true.',
      },
      {
        page: 'Spending',
        href: '/spending',
        line: 'Nothing you log on Spending changes the figure here. The budget already accounted for it — subtracting it twice would be a lie.',
      },
    ],
    example: {
      setup:
        'Salary ₹95,000 in hand. Expenses budgeted at ₹48,000. A car EMI of ₹16,700. ₹12,000 a month into goals.',
      steps: [
        {
          action: 'Read the hero figure.',
          result:
            '₹18,300 left each month — 95,000 − 48,000 − 16,700 − 12,000. The line beneath it spells out that arithmetic so you can see which part is eating the money.',
        },
        {
          action: 'Check whether anything is flagged.',
          result:
            'A card bill falling due, a goal that will miss its date, a month where the balance goes negative. Only problems appear; an empty section means there are none.',
        },
        {
          action: 'Follow a flag to the page that fixes it.',
          result:
            'The fix is never on this page. The dashboard tells you where to go, and the page you land on is where the numbers change.',
        },
      ],
      takeaway:
        'If the big figure is wrong, one of your inputs is wrong — not this page. Start at Settings, then Expenses.',
    },
  },

  expenses: {
    title: 'Expenses',
    tagline: 'The plan. What a month costs you before a rupee is saved.',
    what: [
      'A list of what you expect to pay, set up once and then left alone. Fixed lines are bills that are the same every month — rent, insurance, a subscription. Variable lines are budgets you spend against — food, petrol, shopping.',
      'A bill that comes quarterly or yearly is divided down to a per-month figure, so your monthly balance stays honest even in the months the bill does not arrive.',
    ],
    notThis: [
      {
        page: 'Spending',
        href: '/spending',
        line: 'This is what you expect to pay. Spending is the log of what actually left, purchase by purchase. Budgeting ₹6,000 for food here does not mean you have spent ₹6,000 — it means you have room for ₹6,000.',
      },
      {
        page: 'Loans',
        href: '/loans',
        line: 'An EMI belongs on Loans, not here. Add it in both places and it comes out of your balance twice.',
      },
      {
        page: 'Goals',
        href: '/goals',
        line: 'Money you put aside is not an expense. A flat monthly amount with no finish line is a savings line on Goals; an amount with a target and a date is a goal.',
      },
    ],
    example: {
      setup:
        'You pay ₹9,000 rent on the 1st, roughly ₹6,000 a month on food, and ₹12,000 once a year for car insurance.',
      steps: [
        {
          action: 'Add “Rent” — Fixed, ₹9,000, billed Monthly.',
          result:
            'Your balance drops by ₹9,000 a month, permanently. You never touch this line again unless the rent changes.',
        },
        {
          action: 'Add “Food” — Variable, ₹6,000, billed Monthly.',
          result:
            'A ceiling, not a receipt. Spending logged under the food category later gets measured against this ₹6,000.',
        },
        {
          action: 'Add “Car insurance” — Fixed, ₹12,000, billed Yearly.',
          result:
            'The row shows ₹1,000/mo. You are quietly setting aside a twelfth of it every month instead of being ambushed in March.',
        },
      ],
      takeaway:
        'You are now done with this page. When you actually buy groceries on Tuesday, that goes on Spending — not here.',
    },
    notes: [
      'A line can have a start and an end date. Lines that start later are excluded from the balance until they begin, and are called out at the top of the page.',
      'Set “Paid from” to a card when the bill is auto-debited to it — the cost then lands on that card’s bill instead of leaving your bank on the day.',
    ],
  },

  spending: {
    title: 'Spending',
    tagline: 'The record. Every rupee that actually left, day by day.',
    what: [
      'One entry per purchase: what it cost, when, which category, and optionally which card paid. This is a diary of what happened, and the one page you touch most days.',
      'Logging here never moves your balance or any projection. Your budget already set that money aside; subtracting it again as you spend it would count it twice. What logging does is let the app tell you how much of a budget is left.',
    ],
    notThis: [
      {
        page: 'Expenses',
        href: '/expenses',
        line: 'Expenses is the budget you set once — the plan. This is what happened. You edit Expenses a few times a year; you add to this most days.',
      },
      {
        page: 'Review',
        href: '/review',
        line: 'This page is the raw log inside one month. Review closes a month off and scores plan against reality, so you can correct a budget that was never realistic.',
      },
      {
        page: 'Cards',
        href: '/cards',
        line: 'A card purchase is still logged here. Tagging the card just means the money leaves when the bill falls due rather than that day — Cards only totals what is owed.',
      },
    ],
    example: {
      setup:
        'You budgeted ₹6,000 a month for food on the Expenses page. It is the middle of the month.',
      steps: [
        {
          action: 'Tuesday: groceries, ₹1,850. Amount 1850, category food.',
          result:
            '“Where it went” now shows food at ₹1,850, with ₹4,150 left of the ₹6,000 you budgeted.',
        },
        {
          action: 'Friday: dinner out, ₹1,200, paid with the HDFC card.',
          result:
            'Still counted against the food budget — ₹2,950 spent, ₹3,050 left. But the money leaves your bank on the card’s due date, so it shows on Cards as owed.',
        },
        {
          action: 'A new fridge, ₹32,000. Tick “One-off”.',
          result:
            'It is counted in the month’s total, but pulled out of your ordinary spending, so one unusual purchase does not wreck your daily average or your sense of a normal month.',
        },
      ],
      takeaway:
        'By month end food reads ₹6,400 against a ₹6,000 budget: ₹400 over. The balance in the header never moved once all month — that is by design.',
    },
    notes: [
      'A category with no matching budget line still gets logged; it just shows “no budget line for this”, which is usually a hint that Expenses is missing something.',
      'Use the month arrows to log something you forgot last month. Export gives you a CSV of one month or everything.',
    ],
  },

  review: {
    title: 'Review',
    tagline: 'Plan against reality, one finished month at a time.',
    what: [
      'Takes the budgets from Expenses and the entries from Spending and puts them side by side, category by category, for a single month.',
      'This is the page that keeps the model honest. Every projection in the app runs on your budget, so a budget that is fiction makes every forecast fiction. If food has come in at ₹8,000 for three months against a ₹6,000 budget, the number to change is the budget.',
    ],
    notThis: [
      {
        page: 'Spending',
        href: '/spending',
        line: 'Spending is the raw entries as they happen. This is the verdict on the month once it is done.',
      },
      {
        page: 'Dashboard',
        href: '/',
        line: 'The dashboard looks forward from today. This looks back at a month that has already closed.',
      },
    ],
    example: {
      setup:
        'March is over. You budgeted ₹6,000 for food, ₹4,000 for transport, ₹3,000 for lifestyle.',
      steps: [
        {
          action: 'Open March and read down the categories.',
          result:
            'Food ₹8,100 against ₹6,000 — over. Transport ₹2,400 against ₹4,000 — under. Lifestyle roughly on the number.',
        },
        {
          action: 'Ask whether March was odd, or whether the budget is wrong.',
          result:
            'Step back a month or two with the arrows. If food is over every single month, it is not March that is unusual.',
        },
        {
          action: 'Go to Expenses and set food to ₹8,000, transport to ₹2,500.',
          result:
            'Your balance falls by ₹500 a month — and every goal date, loan projection and wishlist verdict recomputes on a budget that is now true.',
        },
      ],
      takeaway:
        'Being over budget is not a failure worth fixing here. An untrue budget is, because everything else is built on it.',
    },
  },

  goals: {
    title: 'Goals',
    tagline: 'What you are building up, and the order money reaches it in.',
    what: [
      'Each goal has a target, what you have saved so far, and optionally a date. Goals are funded out of what is left after expenses and EMIs, so what you can save is a consequence of the rest of the app rather than a number you type.',
      'Order is the point. When money is tight, the goals lower down get squeezed first, and anything marked protected — an emergency fund, usually — is drawn on last.',
    ],
    notThis: [
      {
        page: 'Wishlist',
        href: '/wishlist',
        line: 'A goal is money going in. A wishlist item is money going out. Nothing on the wishlist takes a rupee off your balance until you mark it committed.',
      },
      {
        page: 'Expenses',
        href: '/expenses',
        line: 'A savings line is a flat monthly amount with no end — an SIP, say. A goal has a finish line, a date, and a progress bar that closes.',
      },
    ],
    example: {
      setup: 'You have ₹22,000 of surplus a month after expenses and your EMI.',
      steps: [
        {
          action: 'Add “Emergency fund” — target ₹3,00,000, priority 1, protected.',
          result:
            'It sits at the top and is drawn on last if a bad month forces the app to take money back out of something.',
        },
        {
          action: 'Add “Japan trip” — target ₹1,80,000, target date next March, priority 2.',
          result:
            'The date sets the pace: the app works out what per month is needed, and tells you if the surplus cannot cover it.',
        },
        {
          action: 'Set “Split surplus by” to Priority order.',
          result:
            'The emergency fund fills first out of the ₹22,000, and Japan gets whatever is left over. Switch to proportional and both fill at once, more slowly.',
        },
      ],
      takeaway:
        'You do not decide how much you save — your expenses and EMIs do. This page decides where that amount lands first.',
    },
  },

  loans: {
    title: 'Loans',
    tagline: 'Every EMI, and what each one is really costing you.',
    what: [
      'An EMI is a fixed payment, but it is not a fixed cost: early on, most of it is interest and very little clears the loan. This page splits each payment so you can see which.',
      'EMIs come out before savings and goals, so clearing one lands straight in your balance left. The prepayment tool shows what a lump sum would actually buy you — months off the tenure and interest never paid — against what the same money would have earned if you had invested it instead.',
    ],
    notThis: [
      {
        page: 'Cards',
        href: '/cards',
        line: 'A card bill is this month’s spending, due in a few weeks, and varies. A loan is a fixed EMI running for years.',
      },
      {
        page: 'Expenses',
        href: '/expenses',
        line: 'Do not add your EMI as an expense line as well. It is already deducted from here, and listing it twice takes it out of your balance twice.',
      },
    ],
    example: {
      setup: 'A ₹8,00,000 car loan at 9.2% over 5 years, ₹2,00,000 already paid off.',
      steps: [
        {
          action: 'Add it: principal, outstanding, rate, EMI, tenure, start date.',
          result:
            'The EMI comes out of your balance every month, and the row shows how much of this month’s payment is interest rather than principal.',
        },
        {
          action: 'Enter ₹1,00,000 as a lump sum prepayment.',
          result:
            'You get the honest numbers: months the tenure drops by, interest you never pay, and EMIs remaining after.',
        },
        {
          action: 'Set the “return if invested instead” rate to what your savings earn.',
          result:
            'The comparison is the real decision. Below your loan rate, prepay; comfortably above it, the money works harder invested.',
        },
      ],
      takeaway:
        'A no-cost EMI is rarely free — enter the cash discount you gave up and the app will price it for you.',
    },
  },

  cards: {
    title: 'Cards',
    tagline: 'What each card owes, and when it falls due.',
    what: [
      'A card has a statement day, when the bill is cut, and a due day, when it must be paid. Spending you tag to a card does not leave your bank on the day you spend it — it lands on that card’s bill and leaves later.',
      '“Due now” is a bill already cut and waiting to be paid. “Still accruing” is what you have spent in the current cycle that has not been billed yet.',
    ],
    notThis: [
      {
        page: 'Spending',
        href: '/spending',
        line: 'A card purchase is still logged on Spending, with the card set under “Paid with”. This page only adds it up and tells you when it comes out.',
      },
      {
        page: 'Loans',
        href: '/loans',
        line: 'Fixed EMI over years, versus a bill that changes every month. If you convert a card purchase to EMI, it belongs on Loans.',
      },
    ],
    example: {
      setup: 'An HDFC card, statement cut on the 18th, payment due on the 5th.',
      steps: [
        {
          action: 'Add the card with its limit, statement day and due day.',
          result:
            'It appears with nothing owed. The card itself is not a cost — only what you put on it is.',
        },
        {
          action: 'Log a ₹1,200 dinner on Spending with “Paid with” set to HDFC.',
          result:
            'It counts against your food budget straight away, but shows here as still accruing. Your bank balance is untouched.',
        },
        {
          action: 'The 18th passes.',
          result:
            'Everything from that cycle becomes a bill that is due on the 5th, and the dashboard flags it as it approaches.',
        },
      ],
      takeaway:
        'A subscription auto-debited to a card should have its “Paid from” set on the Expenses line, so it flows through the card too.',
    },
  },

  wishlist: {
    title: 'Wishlist',
    tagline: 'What a thing costs you in time, not just in rupees.',
    what: [
      'Every item is priced twice: what it costs, and how many months of your surplus it eats. The second number is the one that changes minds.',
      'Nothing here touches your projections until you mark an item committed, so you can add anything you are idly considering and see what it would do without consequences. Tick several at once to model them together.',
    ],
    notThis: [
      {
        page: 'Goals',
        href: '/goals',
        line: 'Goals are money going in and building up. Wishlist items are money going out. A goal has a target you are filling; an item has a price you are weighing.',
      },
      {
        page: 'Spending',
        href: '/spending',
        line: 'Once you have actually bought it, log it on Spending. This page is only about the decision beforehand.',
      },
    ],
    example: {
      setup: 'You have ₹22,000 of surplus a month and a Japan trip goal set for March.',
      steps: [
        {
          action: 'Add “Laptop”, ₹1,40,000, paid in cash.',
          result:
            'It reads as roughly 6.4 months of surplus. Not a price — a length of time you would not be building anything else.',
        },
        {
          action: 'Change the payment method to EMI: ₹12,000 a month over 12 months.',
          result:
            'Different shape entirely. Your monthly balance drops to ₹10,000 for a year, and every goal date stretches to match.',
        },
        {
          action: 'Mark it committed.',
          result:
            'Now it is real: it comes out of the balance on the dashboard, and the Japan trip slips from March to June. That slip is the actual price of the laptop.',
        },
      ],
      takeaway:
        'Leave items uncommitted while you are thinking. Committing is the moment the app starts believing you.',
    },
  },

  setup: {
    title: 'Settings',
    tagline: 'The handful of numbers every other page is computed from.',
    what: [
      'Your salary as it lands in the bank, your bonus, what you have saved today, and the assumptions the projections run on — expected return, inflation on variable expenses, how far ahead to model.',
      'This is the shortest page in the app and the most consequential. If these are wrong, everything downstream is wrong in the same direction.',
    ],
    notThis: [
      {
        page: 'Expenses',
        href: '/expenses',
        line: 'Nothing you spend is set here. Bills and budgets have their own page, as do loans and goals.',
      },
      {
        page: 'Account',
        href: '/account',
        line: 'Your name, password, theme and data export live on Account. This page is about money, not about you.',
      },
    ],
    example: {
      setup: 'You are setting the app up for the first time.',
      steps: [
        {
          action: 'Enter net monthly salary — what lands in the bank.',
          result:
            'After tax and PF, not your CTC. Every balance in the app starts from this figure, so an optimistic number here quietly inflates everything.',
        },
        {
          action: 'Enter available savings and an emergency floor.',
          result:
            'The floor is the amount the app will not project you spending below. It is what turns a forecast into a warning.',
        },
        {
          action: 'Leave return and inflation at their defaults unless you have a reason.',
          result:
            'They only affect projections months out, not this month’s balance. Adjusting them is a fine-tune, not a fix.',
        },
      ],
      takeaway:
        'Set it once, correct it when your salary changes, and spend your time on Expenses and Spending instead.',
    },
  },

  account: {
    title: 'Account',
    tagline: 'Who you are, and getting your data back out.',
    what: [
      'Your name, your password, light or dark, and an export of everything you have logged as a CSV that opens in any spreadsheet.',
      'Nothing on this page changes a single figure in the app.',
    ],
    notThis: [
      {
        page: 'Settings',
        href: '/setup',
        line: 'Salary, savings and projection assumptions live there. This page has none of that.',
      },
    ],
    example: {
      setup: 'You want a copy of your spending history.',
      steps: [
        {
          action: 'Use the export link.',
          result:
            'A CSV of every entry — date, amount, category, note, one-off — that opens in Excel or Sheets.',
        },
        {
          action: 'Keep it, or take it elsewhere.',
          result:
            'The point is that your record is yours, and leaving this app never costs you your history.',
        },
      ],
      takeaway: 'Changing your password signs you out of nothing else — there is nothing else.',
    },
  },
} as const satisfies Record<string, Guide>;

export type GuideKey = keyof typeof GUIDES;
