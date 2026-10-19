# Interface accessibility

AccessPath targets WCAG 2.2 AA. This is an implementation and verification record, not a conformance certification. Its purpose does not make the interface automatically accessible, and a successful automated scan cannot establish complete accessibility.

## Core design decisions

- Standard labeled start/destination fields and route preferences provide an alternative to selecting small map markers.
- Structured results and an ordered itinerary carry route information independently of the map. Barrier and uncertainty text accompany colors and line styles.
- Links and buttons use visible keyboard focus; status changes and validation feedback should be announced without unnecessary focus movement.
- Page landmarks, headings, skip navigation, and native controls establish a predictable reading order.
- Route planning and report submission must work without dragging, hover, precise pointing, or animation.
- Responsive panels must reflow without covering essential controls. Touch targets aim for at least 44 × 44 CSS pixels where practical.
- Reduced-motion preferences disable nonessential route/reveal transitions. Loading and success remain understandable without movement.
- The Radix mobile navigation dialog has an accessible title, focus containment, Escape dismissal and focus restoration. The mobile/tablet route preferences sheet is nonmodal and supports Escape without trapping the rest of the page.

These requirements were checked as recorded below; untested assistive-technology and text-zoom work remains explicit.

## Verification record

| Check | Evidence required | Current record |
|---|---|---|
| Automated axe scan | Route/page, browser, viewport, violations and resolution | Passed on Explorer, report form and open mobile menu; zero violations in the exercised rule sets |
| Keyboard route planning and reporting | Tab order, focus, submit, result access | Passed in the final22 browser tests |
| Desktop 1440 × 900 | Captured layout and readable result state | Passed in the final22 browser tests |
| Mobile 390 × 844 | Reflow, controls, map and itinerary access | Passed in the final22 browser tests |
| Tablet around 768 px | Panel alignment and no horizontal overflow | Passed in the final22 browser tests |
| Reduced motion | Emulated preference and usable resulting state | Passed in the final22 browser tests |
| Text zoom/reflow | 200% text zoom and narrow CSS viewport | Pending manual check |
| Screen reader | Named assistive technology, browser and essential tasks | Not performed |
| Participant testing | Consented tasks with affected community members | Not performed |

The final test report is the authoritative record of executed checks. Do not turn these pending entries into passes based on source inspection alone.

## Manual regression checklist

1. Reach main content through the skip link. Use only Tab, Shift+Tab, Enter, Space, arrows, and Escape as appropriate.
2. Plan a route, switch modes, inspect an uncertain route, and read the no-route explanation without using map markers.
3. Submit invalid and valid report forms. Check that messages identify affected fields and confirmation includes a reference.
4. Verify labels and instructions at 200% zoom and in a narrow viewport. Ensure the map has its own usable bounds and does not create page-wide overflow.
5. Test a screen reader's landmarks/headings, control names, selected states, result announcements, and itinerary order.
6. Enable reduced motion and ensure all content remains visible. Disable network access to tile services if a real basemap is introduced; text routes must remain available.

## Known boundaries

The schematic map is a visual enhancement, not a nonvisual navigation substitute. The text result is the essential alternative. Accessibility attributes in the synthetic graph do not establish a real route's suitability for a person's needs. Assistive-technology and community testing remain necessary even if automated checks pass.

Reference: [WCAG 2.2](https://www.w3.org/TR/WCAG22/). The target is not a claim that every criterion has been independently audited.


## Real-world planner additions

The `/routes` interface offers manually submitted place search and numeric coordinate inputs as alternatives to selecting points on a map. Selected endpoints, provider walking directions and distance are expressed in text. Dashed snap connections are explicitly un-routed; accessible status is never inferred from street geometry. Map control clicks cannot select accidental endpoints, and coordinates outside Web Mercator coverage produce an explanation. Search/route status is announced politely. The real-world browser checks, fixture boundaries and responsive endpoint visibility evidence are recorded in `TEST_REPORT.md`.


The final October18 production browser suite passed33/33, including live-route camera bounds at desktop/tablet/mobile and automated live mobile axe checks with zero violations in the exercised rule sets. Native200%textzoom, screen-reader sessions and real mobility/user validation remain unperformed; this is not a conformance certification.
