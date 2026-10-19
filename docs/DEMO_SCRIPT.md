# AccessPath demonstration recording plan

**Target length:** 3 minutes 45 seconds to 4 minutes. This is a recording plan, not a produced video. Record the real running application after the final checks pass. Keep the synthetic-campus disclosure readable throughout map scenes. Do not replace application behavior with animated result mockups.

## Narration and shot list

| Time | Application shot | Suggested narration |
|---|---|---|
| 0:00–0:20 | Home; briefly show a stair segment in Explorer | “The shortest way to a destination can include stairs. If you need a step-free journey, distance alone does not answer the question.” |
| 0:20–0:40 | Show route preferences and the visible demo label | “AccessPath compares routes using recorded pathway attributes and explains what is known and what is missing. This is AccessPath Demo Campus: an invented environment, not a surveyed school.” |
| 0:40–1:05 | Choose the baseline scenario, start, and destination; calculate | “The route is calculated from a graph of connected segments. Each segment has a stored distance and attributes such as steps, surface, width, slope, curb information, and operating status.” |
| 1:05–1:40 | Select Shortest Walk, then Confirmed Step-Free; show changing line and distance | “The shortest option uses the stair shortcut. Strict step-free routing excludes stairs and incomplete access records, so it selects the longer qualifying alternative. These labels describe the synthetic fixture's rules, not real-world certification.” |
| 1:40–2:05 | Open itinerary and inspect a segment's attributes | “The explanation and ordered text itinerary describe the same route as the map. You can inspect the recorded attributes without depending on color or precise map gestures.” |
| 2:05–2:30 | Activate the closure simulation; show recalculation | “This scenario simulates a closure. The algorithm removes that connection and calculates again. No pathway is invented to keep a result on screen.” |
| 2:30–2:50 | Show uncertain/disconnected scenarios; explicitly choose exploratory | “If the remaining connection has unknown information, strict mode returns no qualifying route. Exploratory routing is an explicit choice, and its uncertain sections stay visible.” |
| 2:50–3:15 | Submit a clearly synthetic obstacle report; show reference and pending state | “A report is validated and saved as pending. It does not automatically change trusted route facts. Authorized review is separate from verifying every access attribute.” |
| 3:15–3:35 | Show About and the actual test report briefly | “The prototype uses deterministic Dijkstra routing, a Next.js interface, and persistent reporting. The test record separates automated checks from community research. Codex assisted development, with student review and testing disclosed in the submission.” |
| 3:35–3:55 | Coverage/evidence screen, then Home | “A next step is a small pilot with permitted pathway measurements and genuine participant feedback. No real campus survey or impact result is claimed today. Accessibility should be part of the path.” |

If real community evidence is collected, replace part of the opening with a brief, consented, accurately attributed observation. Do not present an invented testimonial or identify a participant without permission.

## Rehearsal

1. Use **Main gate → Library** for the baseline. A direct calculation against the current source graph on October 16 returned approximately **168.29 m** for Shortest Walk, **193.48 m** for Confirmed Step-Free, and **195.97 m** for Confirmed Step-Free in the closure scenario, with slope avoidance off. Confirm the final screen's rounding and selection before recording; the corresponding browser route scenarios passed in the final automated run. A student narration/recording rehearsal is still needed.
2. Confirm the closure, uncertain, and disconnected scenario behavior from the current build. Say what the screen actually shows if it differs from the draft narration.
3. Use a separate local/demo database for the recording so invented reports cannot be mistaken for field reports. Record one report with a unique, obviously synthetic description.
4. Decide whether to show admin review. Omit it unless configured and tested; never record the administrator key, session cookie, database token, or environment file.
5. Do not claim a public deployment or persistent cloud database unless the final deployment and reload test have actually passed.

## Recording checklist

- [ ] Final build, route tests, browser checks, and test report are current.
- [ ] Pointer and text are large enough to follow at the recording resolution.
- [ ] Browser notifications, unrelated tabs, private reports, and credentials are hidden.
- [ ] Map and text itinerary are both shown; scenario labels remain visible.
- [ ] Route transitions and report confirmation are genuine captures.
- [ ] Narration avoids “safe,” “ADA approved,” or “verified campus” claims.
- [ ] Student contribution and actual AI assistance are accurately disclosed.
- [ ] Captions are reviewed for destination names, units, and technical terms.
- [ ] Video is 2–6 minutes and its public link opens in a signed-out browser.
- [ ] Public source and final demo links match the demonstrated version.

## Captions and access

Provide manually reviewed captions with speaker changes when needed. Speak route differences and uncertainty aloud rather than pointing to color alone. Use readable high-contrast overlays sparingly; keep them away from form labels and result details. Avoid flashing cuts, background music that masks speech, or speedups that conceal loading/errors.

## Short contingency cut — about 2 minutes 30 seconds

- 0:00–0:25: Problem, product, and synthetic-campus disclosure.
- 0:25–1:10: Baseline shortest versus step-free route and text explanation.
- 1:10–1:40: Closure plus strict no-route/explicit exploratory behavior.
- 1:40–2:00: Real persisted pending report.
- 2:00–2:30: Algorithm, actual validation status, AI disclosure, and honest pilot next step.

Recheck the current official video limits before exporting; see `HACKATHON_RULES.md`.
