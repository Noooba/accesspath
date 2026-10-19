# Pathway data and verification

## Three distinct labels

| Status | Meaning | Does it establish a usable real-world route? |
|---|---|---|
| Demonstration | Authored synthetic data used to exercise software rules | No |
| Unverified | Information exists but the required review/evidence is missing | No |
| Verified | A documented attribute has been reviewed against a recorded source | Only the stated attributes and time of review; never a blanket guarantee |

The shipped environment is **AccessPath Demo Campus**. Its nodes, distances, pathways, stairs, ramps, and closures are invented fixtures. Display this disclosure with the map and results: **Illustrative demo data — not a verified real-world accessibility survey.** The schematic is not a survey of a real campus. Synthetic distances are stored fixture distances, not measurements derived from map pixels.

"Confirmed Step-Free" is a routing mode, not a real-world certification. In a demonstration it means the synthetic attributes satisfy that mode's documented rules. Demo rule coverage must remain visibly separate from verified real-site coverage.

Blocked segments are excluded in every mode, even if a caller attempts to disable that exclusion. Both step-free modes also exclude known stairs and not-step-free segments. Confirmed mode cannot be weakened by preference toggles to include missing documentation. Its 90 cm recorded-width minimum is an application preference, not an ADA standard or individual suitability determination.

## Evidence required before a real pilot

Keep a real site in **Pilot — Unverified** until its actual graph and sources have been collected. Do not transplant demo edges onto a real school map. For each segment retain the source description, method, date, reviewer, geometry, directionality, distance, and individual accessibility attributes. Missing slope, width, curb information, or operating status stays unknown; a report is not proof of an omitted attribute.

Record measurements with units and their limitations. Independently inspect connectivity, entrances, one-way restrictions, and whether a route reaches the intended destination. Review potentially changing conditions again and display the date. There is no universal freshness interval implemented in this prototype; a future pilot must adopt a documented recheck policy.

## Report review is separate from pathway verification

1. An anonymous report is validated and stored as **pending**.
2. An authorized moderator reviews it and records a decision and notes.
3. Approving a report does not establish that every pathway attribute is verified.
4. A justified status update is a separate, server-authorized action. A closure can exclude an edge without proving its slope, width, or step-free status.
5. New survey evidence and reviewer provenance are required before any real attribute is promoted to verified.

The application cannot observe a pathway in real time. Review labels describe records and workflow, not live safety.

## Interpreting coverage and uncertainty

Coverage is calculated from the edges used by the route, not a population statistic. Its denominator and demo context must be visible. A complete fixture record is not evidence of community impact or legal compliance. Exploratory results must enumerate unknown sections; if strict routing has no qualifying path, show the no-route explanation and offer an explicit exploratory choice.

Slope preferences are user filters applied to recorded slope data. They are not an ADA compliance verdict. Surface, clear width, cross slope, landings, doors, temporary conditions, and individual requirements can matter beyond the fields in this MVP.

## Provenance checklist for imported data

- [ ] Written permission/license permits the intended use and redistribution.
- [ ] Site and node/edge identifiers are stable and references are valid.
- [ ] Geometry and stored lengths have a documented source.
- [ ] Unknown values are retained rather than defaulted to favorable values.
- [ ] Review date/source are attached to each verified record.
- [ ] Sensitive notes and personal identifiers are excluded from public exports.
- [ ] A person responsible for corrections and rechecks is identified.

No real dataset import or institutional verification is claimed for this synthetic release.
