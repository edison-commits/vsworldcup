# VS WORLDCUP measured relaunch readout

## Decision

Use first-party evidence to decide whether **Food Debate Week** deserves a broader creator/sponsor relaunch. Do not publish traction claims until an authenticated Umami readout is captured for an explicit date range.

## Existing measurement surface

- Umami is already loaded from `https://analytics.vsworldcup.com/umami.js` in `index.html`; this slice adds no analytics vendor, pixel, cookie, or credential.
- Umami's normal pageview collection supplies sessions and referrers.
- `src/lib/analytics.js` sends only allowlisted custom events/properties. It drops unknown properties and bounds string values.
- The app's existing PocketBase play-session write remains separate from this aggregate relaunch readout.

## Event contract

| Event | Trigger | Properties | Decision supported |
|---|---|---|---|
| `tournament_started` | A bracket initializes | `tournament_id`, `category`, `bracket_size` | Which brackets/categories activate visits? |
| `tournament_completed` | A champion is crowned | `tournament_id`, `category`, `bracket_size` | Do starts turn into finishes? |
| `result_shared` | Native share succeeds or a clipboard/caption copy succeeds | `platform`, `tournament_id`, `category` | Which completed brackets create confirmed share actions? |
| `category_filtered` | A home category chip is selected | `category`, `location` | Which categories attract browsing intent? |
| `media_kit_viewed` | The media-kit route renders | `location` | Is the sponsor/creator artifact being reached? |
| `sponsor_inquiry_clicked` | Media-kit inquiry CTA is selected | `category`, `location` | Does the scoped offer generate inquiry intent? |

No event contains name, email, winner name, free text, user agent, IP address, or a persistent user/account identifier.

## Baseline readout template

Fill from authenticated Umami only after deployment approval and a complete observation window. Keep unknown cells blank rather than estimating.

- **Baseline window:** `YYYY-MM-DD 00:00 UTC` to `YYYY-MM-DD 23:59 UTC`
- **Captured at:**
- **Dashboard / export source:**
- **Sessions:**
- **Top referrers:**
- **Tournament starts:**
- **Tournament completions:**
- **Completion rate:** `tournament_completed / tournament_started`
- **Result shares:**
- **Shares per completion:** `result_shared / tournament_completed`
- **Top categories by starts:**
- **Data caveats:** ad blockers, partial-window instrumentation, internal/test traffic, event availability

## Food Debate Week comparison

Use a seven-day baseline and a seven-day campaign window when seasonality is acceptable. Campaign links should use lowercase, non-PII UTMs, for example:

```text
https://vsworldcup.com/t/fast-food?utm_source=creator_slug&utm_medium=creator&utm_campaign=food_debate_week&utm_content=launch_post
```

`creator_slug` must be a public campaign handle or agreed code—not a person's email, phone number, or internal identifier.

Report:

1. sessions and referrer mix;
2. Fast Food World Cup starts and completion rate;
3. result shares and shares per completion;
4. food-category starts relative to other categories;
5. media-kit views and sponsor inquiry clicks;
6. baseline vs campaign change, with raw counts and date ranges.

## Relaunch gate

- **Continue:** campaign improves qualified starts and produces observable completions/shares without a material completion-rate drop.
- **Iterate:** starts rise but completion or sharing is weak; adjust bracket length, prompt, or result CTA.
- **Stop:** tagged traffic does not activate or event coverage is incomplete.

These are decision rules, not promised outcomes or traction claims.
