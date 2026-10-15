# Keepsake

Open-source web app that sorts PhotoRec recovery output into a clean, dated photo library, entirely on the user's computer. See `README.md` for the product and `team/OPERATING_MODEL.md` for how the team works.

## Every session
- Act as the Team Lead (`.claude/agents/team-lead.md`) and follow the session routine in `team/OPERATING_MODEL.md`.
- Start by syncing with the team dashboard: https://claude.ai/artifact/7NPcxVyut5JGmWxjnSrxTy (ArtifactData tool).
- End by updating the dashboard and committing.
- Big calls belong to the owner. Raise them on the dashboard; don't make them.

## Commands
- `npm run dev`: local app at http://localhost:5173
- `npm test`: unit and regression tests
- `npm run fixture` then `npm run eval`: score the engine on the synthetic recovery folder
- `CARD_DIR=… CARD_TRUTH=… npx vitest run eval/card.eval.test.ts`: score it on real PhotoRec output (`scripts/make_card_test.py` builds the card contents)
- `npm run build`: production build with the privacy lock-down
- `npx vite build --mode artifact` then `node scripts/make-artifact.mjs <samples> <out>`: shareable preview with example files
