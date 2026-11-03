# Phase 4 (private beta) plan, proposed Nov 3, 2026

By the Planner. Live status is on the dashboard; this is the breakdown as proposed. ★ = needs the owner (Tier 1).

## Sprints (one week each)

| Sprint | Dates | Goal |
|---|---|---|
| S4 · Beta ready | Nov 9–15 | Close phase 3 (T83, T74 by Nov 13); hosted beta build, tester kit and feedback route ready for Nov 16 |
| S5 · First beta users | Nov 16–22 | Watch the first 3–5 testers (D19); real PhotoRec output on Windows and Mac; name settled by Nov 20 |
| S6 · Beta fixes and rename | Nov 23–29 | Fix what testers found; apply the final name; license (D6) by Nov 27 |
| S7 · Launch prep | Nov 30–Dec 6 | Competitor re-check, release checklist, second round of fixes |
| S8 · Gate and go/no-go | Dec 7–13 | Phase 4 gate on the release build; repo public Dec 11 (owner); go/no-go |

## Tasks

| Id | Task | Role | Sprint | Pri | Est | Blocked by |
|---|---|---|---|---|---|---|
| T85 ★ | Host the beta build on an unlisted HTTPS URL; e2e and offline checks pass against it | dev | S4 | P1 | 1d | D27, D26 |
| T86 | Beta tester kit (invite, how to start, what we ask, consent) | writer | S4 | P1 | 1d | D28 |
| T87 ★ | Feedback route: short form + "Send feedback" link, nothing sent automatically, `connect-src` unchanged | po | S4 | P1 | 1d | D28 |
| T88 ★ | Recruit 5–8 testers (≥2 Windows, ≥2 Mac) | owner | S4 | P1 | 2h | D28, D14 |
| T89 | Safari/Firefox/Edge zip-save check (R5) | qa | S4 | P1 | 2d | — |
| T90 | Real PhotoRec output on Windows and macOS (R3) | qa | S5 | P1 | 2d | — |
| T91 | Watch the first 3 beta users; debrief with ranked fixes | po | S5 | P1 | 2d | T85–T88 |
| T92 | Fix what the beta finds (every P1, QA-accepted) | dev | S6–S7 | P1 | 3d | T91 |
| T93 | Re-check competitors before launch (R10) | po | S7 | P2 | 1d | T84 |
| T94 ★ | Apply the final name everywhere | dev | S6 | P1 | 1.5d | T44, D25, D26 |
| T95 ★ | Release checklist (LICENSE, notices, README, privacy-page lines, repo-public steps) | lead | S7 | P1 | 1d | D6, T94 |
| T96 | Final gate rerun on the hosted release candidate | qa | S8 | P1 | ½d | T92, T94 |

T30's last screen-reader check carries into S4. T60 joins S7 only with spare time; T50, T59, T62 stay in the backlog.

## Forecast

Critical path: D27/D28 by Nov 10 → T85 by Nov 13 → testers Nov 16 → T91 → T92 → T94 → T96, repo public Dec 11. Dec 14 holds but is tight: about 3.5 weeks of beta with one week of fixes. Triggers: D27 or D28 decided after Nov 10 slips the beta day for day; name not settled by Nov 20 removes the buffer before Dec 11.
