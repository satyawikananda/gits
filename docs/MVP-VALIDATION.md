# Gits v0.1 implementation and validation

## Evidence and limits

The implementation follows `PRD.md`, `DESIGN.md`, and the four existing Pen frames (form, research in progress, search complete, settings). The logo was exported from the existing Pen component. Popup sections retain the supplied layout; additional controls cover the required budget, engine, theme, and key lifecycle.

Automated checks use Vitest/jsdom, the real installed advocaat serializer with a stubbed HTTP transport, and mocked browser storage for controller tests. These prove application contracts, not live Jev accuracy or compatibility with today's Google Maps DOM. No real API key or paid request was used. No credentials file was opened.

The production extension builds. Browser E2E tests are included, but the local Chromium launch was blocked by the sandbox and the escalation request was declined. Visual browser QA and installed-extension E2E execution remain unverified. Do not describe the extension as live-validated until the manual checks below pass.

Latest local checks: **35 passing Vitest tests** (33 Gits-specific plus 2 starter tests), Vue/TypeScript typecheck passed, scoped ESLint passed, production bundles built separately into temporary directories, and `git diff --check` passed. The generated manifest was previously checked for existing entry points, scoped host permissions, production CSP and correctly sized 16/48/128px icons. The content-script build emits a non-fatal UnoCSS warning because it has no styling entry.

## Acceptance criteria

| PRD criterion | Implementation and automated coverage | Remaining runtime check |
| --- | --- | --- |
| 1. Enter and validate Jev key | Settings input; `controller.spec.ts` tests lifecycle; `jev.spec.ts` exercises advocaat request/auth-error mapping | Real key and successful direct Jev response |
| 2. Key persists locally | Dedicated `storage.local` key; snapshots exclude it; no sync storage for product data | Close/reopen installed extension |
| 3. Configure/start Maps research | Typed form + validation; serialized Start; `ui.spec.ts`, `controller.spec.ts` | Actual popup-to-worker messaging and tab creation |
| 4. Navigate multiple candidates | Five explicit Maps operations and durable state machine; fixture E2E covers three businesses | Live listing navigation and scrolling |
| 5. Stable candidate shape | Stable place identifiers; nullable/missing fields; `maps.spec.ts` | Locale/layout variants |
| 6. No-website filter | Deterministic filter before evaluation; `research.spec.ts` | Verify the website selector on live detail panels |
| 7. Relevance/qualification | Batched Jev probability questions, threshold 0.7; ambiguous results recorded for review | Domain quality/calibration with representative real leads |
| 8. Lead priority | Jev choice of high/medium/low; saved with summary; adapter and runner tests | Real model quality |
| 9. Bounded research decisions | Four actions; unavailable actions constrained; query variants built only from user brief | Full installed-extension workflow |
| 10. Pause/stop | Persisted control version; late writes rejected; cancellation of pending DOM operations | Pause during real DOM/API requests, worker restart |
| 11. Review results | Session leads, priorities, addresses, review counts and decision summaries; Vue component tests | Browser rendering and keyboard navigation |
| 12. CSV export | Exact 11-column schema, quoting, Unicode BOM, formula neutralization; CSV unit test | Browser download initiation |
| 13. No-paid-call development | Mock engine runs the same runner/Maps pipeline; Jev count remains zero in unit tests | Included extension E2E using mocked Maps page |

## Selector assumptions

- Only the `https://www.google.com/maps` surface is supported initially; new research opens it with `hl=en`. Consent pages must be handled manually. Other country domains are not automated.
- Search uses `#searchboxinput`/`input[name=q]` and `#searchbox-searchbutton`; results use `[role=feed]` and `/maps/place/` links. Details use the current heading, category actions, and `data-item-id` fields.
- Place IDs prefer `query_place_id`, the Maps `!1s` feature identifier, or `cid`; URL pathname is a conservative fallback. Exact IDs are deduplicated; semantic duplicate merging is out of scope.
- Detail readiness requires the selected place identity and heading; category is optional. A short settle delay precedes extraction. No website link means **no website listed on that loaded Maps panel**, not proof the business has no website anywhere.
- Before a Maps command, a read-only handshake waits up to 15 seconds for the content script, checking for pause/stop between attempts. Dispatched operations are never automatically replayed after a lost response. DOM controls have a 20-second wait with a control-specific error message.
- Research errors are persisted and shown above the progress indicator, including their code and workflow step. Reopening the popup retains this diagnostic information.
- Rating/review labels are parsed for English (and limited Indonesian labels). Unsupported/missing data remains unknown rather than being inferred.
- Opening/returning relies on the existing result links and Back control, with support for a retained adjacent result list. Single-result searches can be extracted without a feed.
- CAPTCHA selectors and visible unusual-traffic indicators stop automation. There is no solving, bypassing, stealth, or access-control workaround.
- Google may change classes, accessible labels, lazy-loading timing, or navigation. Maintain `src/contentScripts/google-maps/selectors.ts` and fixture tests together; fixtures alone do not establish live compatibility.

## Persistence, cost and privacy

- Session, settings and key are stored locally. Chromium local storage access is restricted to trusted extension contexts; the Maps script receives no key. Local storage is not an encrypted vault.
- Every uncached request reserves one session call before dispatch. Failed/interrupted requests also use that reservation. Mock requests have a separate counter and enforce the same configured limit. Connection tests are explicitly outside research budgets.
- Equivalent semantic inputs reuse a session cache. Targets, missing websites, exact IDs, ratings and CSV never require semantic evaluation.
- Pause/stop prevents later side effects or stale result writes. An already dispatched Jev request may still complete and remains counted. Removal of a key pauses a running session.
- A 30-second alarm recovers the persisted runner when the worker becomes idle. A browser/worker restart may retry an unfinished operation; a request already sent before interruption can be counted without a cached answer. The guard still prevents exceeding the configured budget.
- The only off-device research data sent by Gits is the brief and selected listing/context evidence sent directly to Jev. Google also receives the user-initiated Maps searches. No Gits backend, analytics, outreach, enrichment, CRM, or other model integration exists.

## Manual checklist before release

1. Build and load `extension/` unpacked in Chrome 120+. Verify all four screens at a 420px popup width, light/dark/system themes, focus outlines and scrolling.
2. Enter a real Jev key through Settings. Test, reopen, replace and remove it; confirm provider failures show sanitized messages. Never paste the key into source or test fixtures.
3. Run Mock mode on a small real Maps search. Verify multiple listings, scroll loading, no-website/rating filters, duplicate handling, and exhausted search behavior.
4. Run a small Jev session with a low call limit. Check relevance/priority quality and compare the visible reservation count with actual dispatched requests.
5. Close/reopen the popup while research runs. Pause during navigation/evaluation, resume, stop, close the Maps tab, and restart the worker; verify saved leads and counters remain intact.
   Reproduce the reported startup with Spa in Denpasar, Bali, keywords spa/wellness/massage/beauty, minimum rating 4, target 10, and a 20-call limit. This startup is covered by mocked messaging tests; the live Maps case still requires manual verification. After an extension reload, reload the Maps tab before resuming so it receives the current content script.
6. Test a consent/challenge screen manually; Gits must stop and never attempt bypass.
7. Review all saved leads and download CSV. Open it in a spreadsheet and verify commas, quotes, newlines, Unicode and formula-like names remain safe text.

Users remain responsible for complying with Google Maps and Jev terms and applicable laws. Publishing, hosted privacy policy, store screenshots, and Firefox validation are not part of this implementation.
