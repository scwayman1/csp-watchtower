# Thrivent Managed Account Audit (TY4-171885)

## 1) Executive summary

Based on the January-March 2026 data you provided, the account activity is **not inherently abnormal** for an options-overlay managed account. The likely dashboard problem is a **data representation issue**, not a brokerage accounting issue.

Key conclusions:

- The DIA activity appears to be a **single short-put cycle per month/expiry window** (Jan 30, Feb 27, Apr 2 expiries), not many concurrent DIA holdings.
- January's large decrease from **$848,320.55 to $716,207.75** is mostly explained by **transfers/misc corporate actions of ($124,240.37)**, not pure market performance.
- January “Misc. & Corporate Actions” appears to map exactly to four transfer lines totaling **($124,240.37)**, so classifying this bucket as realized loss is likely incorrect.
- If your dashboard shows multiple DIA lines as current holdings at the same time, the most likely cause is lifecycle/state errors (expired/closed/open not separated) or period-merge duplication.

---

## 2) Findings by issue

### Issue A — Possible transaction/holding duplication

**Assessment:** Likely in dashboard view logic, not necessarily raw statement data.

Why:

1. The timeline shows one DIA option instance per monthly cycle, not multiple open DIA contracts on the same date.
2. Monthly statements naturally repeat instrument symbols in history sections; if ETL merges statement exports without transaction-level IDs + lifecycle state, repetition can be misread as duplicates.
3. Your March open-options list has only one DIA contract (`DIA260402P474`), which is internally consistent with a single open position as of 03/31/26.

### Issue B — DIA overstated due to option lifecycle confusion

**Assessment:** High likelihood if dashboard is showing many DIA entries as active.

Expected lifecycle:

- Jan DIA put (Jan 30 2026 expiry): should be **closed/expired/assigned** by/after expiry, not open in March.
- Feb DIA put (`sold to open 02/03/26`, expired `02/27/26`): should be **expired** status, not current.
- Mar DIA put (`sold to open 03/03/26`, expiry 04/02/26): should be **open as of 03/31/26**.

Only the March contract belongs in open holdings at 03/31/26.

### Issue C — Misc & Corporate Actions likely misclassified as loss

**Assessment:** Very likely misclassification if shown as performance loss.

The four January transfer values:

- (22,321.28)
- (47,797.10)
- (4,127.63)
- (49,994.36)

Sum = **(124,240.37)**, exactly equal to January “Misc. & Corporate Actions”.

That is a balance-sheet movement / transfer-out classification, not market P&L.

### Issue D — Monthly statement merge error risk

**Assessment:** Medium-high risk in ETL.

Common failure mode:

- Using symbol+month as key (e.g., `DIA + Feb`) instead of transaction/event keys causes carry-forward rows to be ingested as new activity each month.
- Carrying forward prior month open positions from statement snapshots and also replaying historical transactions double counts positions.

### Issue E — Portfolio drop interpretation (Jan)

**Assessment:** Mostly transfer-driven.

Reconciliation identity check:

`End = Begin + Income + Fees + Misc/Corp Actions + Change in Value`

`716,207.75 = 848,320.55 + 3,133.64 - 982.69 - 124,240.37 - 10,023.38`

The math ties exactly. So the main driver is the transfer/corporate-actions bucket, not investment underperformance.

---

## 3) Cleaned month-by-month reconciliation

| Month | Begin Value | Income | Fees | Transfers / Misc & Corp Actions | Market Change (Change in Value) | End Value | Primary Driver |
|---|---:|---:|---:|---:|---:|---:|---|
| Jan 2026 | 848,320.55 | +3,133.64 | -982.69 | -124,240.37 | -10,023.38 | 716,207.75 | Transfer-out activity |
| Feb 2026 | 716,207.75 | +1,343.92 | 0.00 | 0.00 (not listed) | -30,848.51 | 686,703.16 | Market move |
| Mar 2026 | 686,703.16 | +798.26 | 0.00 | 0.00 (not listed) | -10,695.66 | 676,805.76 | Market move |

Interpretation:

- January performance ex-transfer is roughly the market change line plus fees net of income.
- February/March declines look like actual performance changes (plus option MTM) since no transfer bucket is listed.

---

## 4) DIA-specific audit

### DIA event timeline across Jan–Mar 2026

| Statement Month | Contract | Event Date | Event | Expected Lifecycle State by 03/31/26 | Should Appear in Open Holdings on 03/31/26? |
|---|---|---|---|---|---|
| Jan | DIA Jan 30 2026 488 Put | Jan cycle | Put activity present | Closed (expired or otherwise resolved after 01/30) | No |
| Feb | DIA Feb 27 2026 487 Put | 02/03 sold to open | Opened short put | Expired on 02/27 | No |
| Mar | DIA Apr 02 2026 474 Put (`DIA260402P474`) | 03/03 sold to open | Opened short put | Open as of 03/31 (expiry after month-end) | Yes |

### Answer to DIA questions

1. **Abnormal?** No obvious abnormality from provided facts; it looks like one monthly DIA short put cycle.
2. **Historical shown as current?** If dashboard shows Jan/Feb DIA as current, yes, that is likely a lifecycle-state bug.

---

## 5) Proposed corrected data model (normalized)

### Core principle
Separate:

1. **Transaction ledger events** (immutable atomic events)
2. **Position lifecycle state** (derived current/closed/expired/assigned)
3. **Holdings snapshots** (point-in-time, e.g., end-of-month)

### Recommended normalized buckets for this account

#### Current holdings (as of 03/31/26)

| Category | Instrument | Quantity / Value | Notes |
|---|---|---:|---|
| Money Market | FDRXX | $138,652.63 | Cash sweep/MMF |
| Equity | AMD | 100 sh | Current holding |
| Equity | GOOGL | 100.069 sh | Current holding |
| Equity | GOOG | 200.138 sh | Current holding |
| Equity | AMZN | 200 sh | Current holding |
| Equity | CRWD | 200 sh | Current holding |
| Equity | DDOG | 200 sh | Current holding |
| Equity | INTU | 100 sh | Current holding |
| Equity | META | 200.176 sh | Current holding |
| Equity | MSFT | 100.225 sh | Current holding |
| Equity | CRM | 200 sh | Current holding |
| ETP | QQQ | 100.126 sh | Current holding |

#### Open option positions (as of 03/31/26)

| Option Symbol |
|---|
| AMD260402C210 |
| AMZN260402C225 |
| CRM260402C215 |
| CRWD260402C415 |
| DDOG260402C123 |
| DIA260402P474 |
| GOOG260402C320 |
| GOOGL260402C330 |
| INTU260402C470 |
| META260402C680 |
| MSFT260402C425 |
| NVDA260402P155 |
| QQQ260402C610 |
| UBER260402P67 |
| WMT260402P120 |

#### Closed option positions

- Any option with explicit close/buy-to-close/sell-to-close before 03/31/26.
- (Not fully reconstructable from the provided summary; requires transaction-level records.)

#### Assigned options that became equity purchases

- No explicit DIA assignment shown in your provided data.
- Must be detected using assignment/exercise events and resulting equity lot creation.

#### Expired options

- DIA Feb 27 2026 487 Put (explicitly expired 02/27/26).
- Likely Jan DIA put after 01/30/26 unless assignment/close event exists.

#### Cash sweeps / money market activity

- FDRXX activity should be modeled as cash equivalent sweeps, not performance losses.

#### Transfers to other accounts/vehicles

- January four transfers totaling (124,240.37).

#### Fees

- January fees: (982.69)
- February: 0
- March: 0

#### Dividends / income

- Jan: 3,133.64
- Feb: 1,343.92
- Mar: 798.26

---

## 6) Engineering recommendations (ETL/dashboard)

### A) Canonical transaction identity and dedupe rules

Use canonical key:

`(account_id, broker_txn_id, trade_date, settle_date, symbol, side, quantity, price, amount, source_statement_id, line_hash)`

Rules:

1. If `broker_txn_id` exists, use it as primary dedupe key.
2. If absent, use deterministic `line_hash` over normalized fields.
3. Prevent cross-period duplicate ingestion by storing `source_statement_period` and rejecting exact duplicates from later statements.

### B) Statement-period reconciliation

For each statement month enforce:

`ending_value = beginning_value + net_external_flows + income - fees + unrealized_realized_change`

with an allowed tolerance (e.g., <= $0.01 or rounding policy).

If mismatch, flag ingest job and do not publish portfolio analytics until reconciled.

### C) Holdings snapshot vs transaction history separation

Maintain separate tables/views:

- `positions_snapshot_eom` (point-in-time holdings)
- `transactions_ledger` (event history)
- `position_lifecycle` (derived state machine)

UI must source “Current Holdings” only from latest snapshot + live pricing, **never** by summing historical transaction rows naively.

### D) Option lifecycle state model

Each option instance should have a unique `option_position_id` and lifecycle:

`OPENED -> {CLOSED | EXPIRED | ASSIGNED}`

Required state fields:

- `open_date`, `expiration_date`, `close_date`
- `close_reason` enum: `BUY_TO_CLOSE`, `SELL_TO_CLOSE`, `EXPIRED`, `ASSIGNED`, `EXERCISED`
- `underlying_lot_link_id` (if assigned/exercised)

Dashboard rules:

- Open options widget filters strictly `state = OPEN AND as_of_date < expiration OR unresolved close event`.
- Expired/assigned contracts shown in history only.

### E) Transfer and Misc classification rules

Introduce explicit cashflow types:

- `EXTERNAL_TRANSFER_OUT`
- `EXTERNAL_TRANSFER_IN`
- `INTERNAL_RECLASS`
- `CORP_ACTION_NON_PNL`

Do **not** include these in investment performance P&L cards. Show them in “Net Flows/Transfers” section.

### F) DIA-specific guardrails

- At most one open record per exact option symbol (`root+expiry+strike+put/call`) per account and open lot id.
- Auto-close all expired contracts at end-of-day expiration if no closing trade exists.
- Cross-check with broker position snapshot to ensure only snapshot-open contracts populate current holdings.

---

## 7) Direct answers to your six specific questions

1. **Is DIA abnormal?**
   - No, it appears to be one monthly short put per expiry cycle based on supplied data.

2. **Is dashboard likely showing historical DIA events as current?**
   - If multiple DIA contracts are shown as simultaneously open, yes, likely lifecycle/merge logic error.

3. **Are January Misc & Corporate Actions transfers, not losses?**
   - Yes, the four transfer lines exactly match the Misc total; classification as transfer/outflow is more appropriate than loss.

4. **Does $848k -> $716k mostly reflect transfers out?**
   - Yes. About $124.2k of the $132.1k drop is transfer/corporate-action outflow.

5. **What should correct dashboard show?**
   - **January:** large external transfer out, modest market loss, normal income/fees.
   - **February:** no large transfers; market-driven decline; DIA Feb put expired.
   - **March:** no large transfers; moderate market decline; one open DIA Apr 2 put as of month-end.

6. **How to prevent ETL errors?**
   - Canonical transaction IDs + dedupe; separate snapshot vs history; explicit option lifecycle state machine; transfer classification outside P&L; monthly reconciliation gate.

---

## 8) Ambiguities / missing data

To fully confirm and eliminate false positives, you still need:

1. Transaction-level raw exports with broker transaction IDs for Jan–Mar.
2. Option event types for each DIA line (`STO`, `BTC`, `EXP`, `ASSIGN`).
3. Position snapshots at each month-end (not just narrative summary).
4. Clarification whether January DIA Jan30 contract expired worthless, was assigned, or closed before expiry.
5. Definitions from the dashboard code for “Change in Value” and whether Misc/Corp is included in performance cards.
