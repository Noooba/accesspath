# AccessPath — editable Devpost draft

**Draft, not a submission receipt.** Replace every **[STUDENT INPUT REQUIRED]** field with genuine information. Recheck final functionality against `TEST_REPORT.md`; do not describe planned features as completed. Public repository, published video, and a real pilot are not confirmed here.

## A. Project name

AccessPath

## B. Tagline

Every route should be accessible.

## C. Elevator pitch

AccessPath compares pedestrian routes using documented accessibility attributes, showing why a route is selected and where information is missing. Our campus-scale prototype makes stairs, closures, and uncertainty part of the route decision.

## D. Problem

A short route can include stairs, a blocked path, or an entrance someone cannot use. When pathway details are missing, people must investigate alternatives themselves. A useful planning tool must distinguish a known barrier from an unknown condition rather than silently treating both as usable.

## E. How do we know the specific problem is real?

**[STUDENT INPUT REQUIRED: describe a genuine local observation, interview, or permitted dataset.]**

- What did you personally observe, when, and in what general setting?
- Which route or information gap was difficult?
- Who did you speak with, and what may you share with their consent?
- Which source or measurement supports the claim?
- What did a real prototype test teach you?

We currently demonstrate the software with a fictional campus. It is not a survey of the Palos Verdes Peninsula or evidence of a school partnership. General background is available in the [CDC barriers overview](https://www.cdc.gov/disability-inclusion/barriers/index.html); local evidence still needs to be supplied. Use `COMMUNITY_VALIDATION.md` to record it.

## F. Our solution

The explorer compares a shortest pedestrian route, a strict step-free route, and an exploratory option that exposes missing information. The map and text itinerary come from the same graph result. A simulated closure demonstrates recalculation. Community reports are stored pending review instead of becoming trusted route facts automatically.

## G. Technical implementation

The TypeScript graph uses deterministic Dijkstra routing with a binary min-heap and documented segment distances. Filters remove ineligible edges before route expansion. The response includes ordered nodes and edges, distance, known barriers, unknown attributes, coverage, and an explanation; an unreachable strict route has no silent fallback.

The interface uses Next.js App Router, React, TypeScript, Tailwind CSS, Leaflet/React Leaflet, Lucide, and selective Motion transitions. Server-side Zod validation and Drizzle/libSQL handle persisted reporting. Moderator mutations require server authentication. Local development uses SQLite; a serverless public deployment needs a durable hosted database. See `ARCHITECTURE.md`, `ROUTING_METHODOLOGY.md`, and `DEPLOYMENT.md` for the final implementation details.

## H. What makes it different?

The prototype puts uncertainty in the decision itself: missing evidence cannot silently pass strict filtering. Route explanations and non-map itineraries help people inspect the result. Explicit demo labels and separate moderation/verification make a small, maintainable campus pilot more credible than broad unsupported coverage.

## I. Challenges encountered

The design must demonstrate strict route filtering without portraying synthetic attributes as a surveyed campus. It must also keep report approval separate from complete pathway verification, and separate convenient local SQLite persistence from durable serverless storage.

**[STUDENT INPUT REQUIRED: add a specific development failure, the actual fix, and what you learned. Refer to dated progress/test records. Do not invent a failed experiment.]**

## J. What comes next?

Collect permitted pathway observations with community participants, review sources, and pilot one small real site. Define a maintenance and correction process, test with people using assistive technology, and evaluate whether unknown information is understood. Broader coverage would follow verified data and operational support, not precede them.

## K. AI and third-party tools disclosure

OpenAI Codex assisted with architecture, implementation, synthetic fixtures, documentation, and test preparation. UI/UX Designer guidance, focused UI UX Pro Max searches, and the 21st UI build workflow informed the interface. The local 21st design-context initialization succeeded, but catalog search and usage were unavailable because the CLI was not signed in; no 21st component retrieval or hosted generation is claimed. The schematic and interface components were implemented in this project. Locally hosted Manrope and Inter fonts include their OFL license files; package licenses must also be retained.

**[STUDENT INPUT REQUIRED: state your own design decisions, code review, testing, source verification, and changes. List any other tools/assets actually used.]**

## L. Testing and validation

As of October 17, the combined unit, backend integration, and evidence-component run passed **81 tests across four files**. Lint, TypeScript checks, and the production build passed. These checks include graph integrity, strict-mode invariants, actual report validation/persistence, moderator authorization, and truthful async evidence states. The final production browser suite passed **22 tests across Chromium and Firefox**, including route scenarios, persistent reporting, moderation, keyboard/mobile flows and reduced motion. Automated accessibility checks on Explorer, the report form and the open mobile menu returned zero violations in the exercised rule sets. Desktop, tablet and mobile screenshots were visually inspected. See `TEST_REPORT.md` for exact scope and limits. Automated fixtures are synthetic and are not a real user study. No real community usability or impact result is established yet.

## M. Limitations

This release supports a fictional demonstration environment. It does not provide verified campus navigation, emergency guidance, legal accessibility certification, or live condition detection. Unknown fields and temporary changes can prevent a usable route. Real operation needs reviewed pathway data, a maintenance process, and deployment-specific persistence and abuse controls.

## Required links and final checks

| Item | Final value |
|---|---|
| Public repository, checked while signed out | **Not supplied** |
| Working demo URL and persistence description | **Not established** |
| Public 2–6 minute video with captions | **Not recorded** |
| Genuine local evidence reference | **Not supplied** |
| Student contribution summary | **Pending student review** |
| Eligibility/deadline confirmation | **Pending; see `HACKATHON_RULES.md`** |

Do not mark submission-ready until these are resolved and the final build passes its documented checks.


## October 18 integration update for the student to review

A separate `/routes` planner now generates ordinary real-world walking directions from OpenStreetMap-based providers and offers a Google Maps handoff. It supports place search, map/coordinate selection, actual route geometry, directions, alternatives and transparent snap gaps. This feature does **not** claim that public walking directions are accessible or step-free; the documented synthetic graph still demonstrates AccessPath’s confirmed-route algorithm.

The updated local suite passed107 tests and the final frozen-build browser regression passed33. A public-data functional check returned315.2m between Torrance City Hall and Katy Geissert Library and rendered successfully; a Google Maps walking link was also opened. The final regression includes responsive endpoint visibility after the resize fix; use `TEST_REPORT.md` for exact scope and limits. Neither this check nor automated fixtures replace student participation, consented user research, field measurements or real campus validation.
