// Builds the dashboard's starting data as ArtifactData batch operations (seed-ops.json)
// and a flat copy for local previews (seed-flat.json).
import { writeFileSync } from 'node:fs';

const now = '2026-10-15T15:10:00+08:00';
const docs = {};
const put = (path, data) => { docs[path] = data; };

put('meta/project', {
  headline: 'Two weeks ahead, waiting on four calls from you',
  now: 'The scanning engine planned for November is built and passing every test, including a real PhotoRec recovery. Most urgent: the code still lives only in a temporary cloud workspace, so decide where it should live (D1).',
  updatedAt: now,
  updatedBy: 'Team Lead',
  forecastNote: 'Forecast assumes you approve D3 option A (keep the January launch, start the MVP now). The Planner updates it after each decision.',
  holiday: { start: '2026-12-21', end: '2027-01-03' },
  links: [
    { label: 'Implementation plan', url: 'https://claude.ai/code/artifact/bf13b7eb-c77a-4046-a0a2-283ae8c84fcc' },
    { label: 'Results screen mockup', url: 'https://claude.ai/artifact/EJxXJm4WUjbyAGKaZo1sEa' },
    { label: 'Working preview of the app', url: 'https://claude.ai/artifact/8edzAfvrtTVUWACpPpYE6Y' },
  ],
});

const phases = [
  { id: 'p1', order: 1, name: 'Validate', baselineStart: '2026-10-19', baselineEnd: '2026-11-01', forecastStart: '2026-10-14', forecastEnd: '2026-10-25', status: 'in-progress', gate: 'Real test folders ready, and no strong existing competitor', gateStatus: 'pending', gateNote: 'competitor scan and your phone test are this week' },
  { id: 'p2', order: 2, name: 'Prototype the engine', baselineStart: '2026-11-02', baselineEnd: '2026-11-22', forecastStart: '2026-10-14', forecastEnd: '2026-10-25', status: 'in-progress', gate: 'Under 1% of real photos wrongly set aside', gateStatus: 'pending', gateNote: '0% on 430 test photos so far; needs your real-phone check (D4)' },
  { id: 'p3', order: 3, name: 'Complete the MVP', baselineStart: '2026-11-23', baselineEnd: '2026-12-20', forecastStart: '2026-10-26', forecastEnd: '2026-12-06', status: 'next', gate: '5 non-technical testers finish the task without help', gateStatus: 'not-started' },
  { id: 'p4', order: 4, name: 'Private beta', baselineStart: '2027-01-04', baselineEnd: '2027-01-24', forecastStart: '2026-12-07', forecastEnd: '2027-01-24', status: 'later', gate: '40,000 files scanned in under 5 minutes, and works with Wi-Fi off', gateStatus: 'not-started' },
  { id: 'p5', order: 5, name: 'Public launch', baselineStart: '2027-01-25', baselineEnd: '2027-01-31', forecastStart: '2027-01-25', forecastEnd: '2027-01-31', status: 'later' },
  { id: 'p6', order: 6, name: 'Desktop version and premium', baselineStart: '2027-02-01', baselineEnd: '2027-02-28', forecastStart: '2027-02-01', forecastEnd: '2027-02-28', status: 'later' },
];
phases.forEach(({ id, ...p }) => put(`phases/${id}`, p));

const sprints = [
  { id: 'S0', name: 'Sprint 0 · Kickoff', short: 'Sprint 0', start: '2026-10-14', end: '2026-10-18', status: 'current', goal: 'Build the engine prototype, set up the team, and get your four decisions.' },
  { id: 'S1', name: 'Sprint 1 · Close validation', short: 'Sprint 1', start: '2026-10-19', end: '2026-10-25', status: 'next', goal: 'Pass gates 1 and 2 with real-phone evidence, and design the review and export screens.' },
  { id: 'S2', name: 'Sprint 2 · Review and export', short: 'Sprint 2', start: '2026-10-26', end: '2026-11-01', status: 'later', goal: 'Build the review timeline and export.' },
  { id: 'BL', name: 'MVP backlog', short: 'Backlog', start: '2026-11-02', end: '2026-12-06', status: 'later', goal: 'Remaining MVP work, scheduled by the Planner each week.' },
];
sprints.forEach(({ id, ...s }) => put(`sprints/${id}`, s));

const roles = [
  { id: 'owner', order: 0, name: 'You (owner)', kind: 'owner', focus: 'Sets direction and makes the big calls',
    decides: ['Scope and phase changes', 'Passing a phase gate', 'Anything touching the privacy or no-delete promises', 'Launch date and anything public', 'Name, brand and license', 'Money: pricing, paid tools', 'Adding or removing team roles'],
    escalates: [] },
  { id: 'lead', order: 1, name: 'Team Lead', kind: 'agent', isNew: true, focus: 'Runs the sprint, unblocks people, keeps this dashboard current',
    decides: ['Task priority within the current phase', 'Who does what, and in what order', 'Technical approach within the agreed stack', 'Free, license-compatible libraries', 'Copy and design details that follow the agreed system', 'Schedule shifts under 1 week that don’t move a gate'],
    escalates: ['Everything in your column, with options and a recommendation', 'Any disagreement between roles it can’t settle with evidence'] },
  { id: 'planner', order: 2, name: 'Planner', kind: 'agent', isNew: true, focus: 'Turns phases into sprints, forecasts dates, keeps the risk list',
    decides: ['Task breakdown, estimates and dependencies', 'Sprint contents (with the Lead)', 'Forecast dates'],
    escalates: ['Forecast slips of more than 1 week (to the Lead, who brings it to you)'] },
  { id: 'po', order: 3, name: 'Product owner', kind: 'agent', focus: 'Requirements, research, and gate recommendations',
    decides: ['User stories and acceptance criteria', 'Research method'], escalates: ['Gate pass or fail (recommends; you sign off)', 'Scope changes'] },
  { id: 'design', order: 4, name: 'UX designer', kind: 'agent', focus: 'Screens, flows and accessibility', decides: ['Layout and interaction details within the design system'], escalates: ['Changes to the visual identity'] },
  { id: 'writer', order: 5, name: 'UX writer', kind: 'agent', focus: 'Every word users see', decides: ['Wording within the voice rules'], escalates: ['Privacy and safety promises in the copy'] },
  { id: 'dev', order: 6, name: 'Front-end developer', kind: 'agent', focus: 'Builds the app and the scanning engine', decides: ['Implementation inside their task'], escalates: ['New dependencies or architecture changes (to the Lead)'] },
  { id: 'qa', order: 7, name: 'QA tester', kind: 'agent', focus: 'Finds bugs, measures accuracy against the gates', decides: ['Bug severity'], escalates: ['Any data-safety or privacy finding (straight to the Lead and you)'] },
];
roles.forEach(({ id, ...r }) => put(`roles/${id}`, r));

let o = 0;
const T = (id, role, sprint, status, priority, title, extra = {}) => put(`tasks/${id}`, { order: ++o, role, sprint, status, priority, title, ...extra });
// Sprint 0 (done)
T('T01', 'po', 'S0', 'done', 'P1', 'Write the implementation plan');
T('T02', 'design', 'S0', 'done', 'P1', 'Mock up the cleanup results screen');
T('T03', 'dev', 'S0', 'done', 'P1', 'Build the scanning engine and cleanup rules');
T('T04', 'dev', 'S0', 'done', 'P1', 'Build folder picking, scan progress and results screens');
T('T05', 'qa', 'S0', 'done', 'P1', 'Make a test recovery folder with an answer key', { note: '1,407 files; 0 mistakes' });
T('T06', 'qa', 'S0', 'done', 'P1', 'QA review of the engine', { note: 'Found the Samsung/Pixel blocker; fixed' });
T('T07', 'writer', 'S0', 'done', 'P2', 'Review all copy', { note: 'Plainer words; adopted' });
T('T08', 'qa', 'S0', 'done', 'P1', 'Real PhotoRec test on a wiped virtual SD card', { note: '0 of 107 real photos set aside by mistake' });
T('T09', 'dev', 'S0', 'done', 'P2', 'Publish a preview link with example files');
T('T10', 'lead', 'S0', 'done', 'P1', 'Set up the Team Lead and Planner roles and decision rights');
T('T11', 'lead', 'S0', 'done', 'P1', 'Build this dashboard');
// Sprint 0 (open)
T('T12', 'lead', 'S0', 'blocked', 'P1', 'Move the code to a permanent home', { blockedBy: ['D1'], note: 'Right now it only exists in a temporary cloud workspace and the zip you have', estimate: '½ day' });
T('T13', 'owner', 'S0', 'todo', 'P1', 'Scan your phone’s camera folder in the preview and tell the team what got set aside', { due: '2026-10-21', note: 'Copy DCIM/Camera to your computer first. This is the real-phone evidence for gate 2.' });
T('T14', 'planner', 'S0', 'in-progress', 'P1', 'Plan Sprint 1 and update the forecast', { estimate: '½ day' });
// Sprint 1
T('T15', 'po', 'S1', 'todo', 'P1', 'Competitor scan: existing apps that sort PhotoRec output', { estimate: '1 day' });
T('T16', 'po', 'S1', 'todo', 'P2', 'Check whether “Keepsake” is free to use', { estimate: '½ day', note: 'App stores, domains, trademarks; leads to a naming decision for you' });
T('T17', 'qa', 'S1', 'blocked', 'P1', 'Add real iPhone (HEIC) and Samsung photos to the tests', { blockedBy: ['T13'], estimate: '1 day' });
T('T18', 'dev', 'S1', 'todo', 'P1', 'HEIC support: read photo details and show previews', { estimate: '2 days' });
T('T19', 'dev', 'S1', 'todo', 'P2', 'Read video dates so videos land on the timeline', { estimate: '1 day' });
T('T20', 'design', 'S1', 'todo', 'P1', 'Design the review timeline (select, Undated, filters)', { estimate: '2 days' });
T('T21', 'design', 'S1', 'todo', 'P1', 'Design the export flow (save to folder, zip fallback)', { estimate: '1 day' });
T('T22', 'writer', 'S1', 'blocked', 'P2', 'Write copy for the review and export screens', { blockedBy: ['T20', 'T21'], estimate: '1 day' });
T('T23', 'po', 'S1', 'blocked', 'P1', 'Recommend pass or fail for gates 1 and 2', { blockedBy: ['T13', 'T15'], estimate: '½ day' });
// Sprint 2
T('T24', 'dev', 'S2', 'todo', 'P1', 'Build the review timeline', { blockedBy: ['T20'], estimate: '3 days' });
T('T25', 'dev', 'S2', 'todo', 'P1', 'Build export: folder and zip', { blockedBy: ['T21'], estimate: '2 days' });
T('T26', 'writer', 'S2', 'todo', 'P2', 'Write the step-by-step PhotoRec guide', { estimate: '1 day' });
T('T27', 'qa', 'S2', 'todo', 'P1', 'Speed and memory test with 40,000 files', { estimate: '1 day' });
// Backlog
T('T28', 'dev', 'BL', 'todo', 'P1', 'Offline install (works with Wi-Fi off)', { estimate: '2 days' });
T('T29', 'writer', 'BL', 'todo', 'P2', 'Write the privacy page', { estimate: '1 day' });
T('T30', 'design', 'BL', 'todo', 'P2', 'Accessibility audit of every screen', { estimate: '1 day' });
T('T31', 'po', 'BL', 'todo', 'P1', 'Usability test plan and script', { estimate: '1 day' });
T('T32', 'owner', 'BL', 'todo', 'P1', 'Find 5 non-technical people to test the app', { due: '2026-11-27', note: 'Family, friends, a phone repair shop. The PO will brief them.' });
T('T33', 'dev', 'BL', 'todo', 'P3', 'Faster Stop button, and full checks for files over 64 MB', { estimate: '1 day' });

const D = (id, data) => put(`decisions/${id}`, data);
D('D1', { order: 1, status: 'needs-you', raisedBy: 'Team Lead', due: '2026-10-17', blocks: ['T12', 'T18', 'T19', 'T24', 'T25'],
  title: 'Where should the code live?',
  context: 'The code only exists in this temporary cloud workspace, which is wiped after a while, plus the zip you downloaded. Every future work session needs to start from it.',
  options: [
    { id: 'github', label: 'A private GitHub repository', detail: 'Any team session can pick up the latest code, and there is full history. Becomes public at launch.' },
    { id: 'computer', label: 'A folder on your computer', detail: 'Stays with you. Team sessions only work while your computer is on and linked.' },
    { id: 'both', label: 'Both: GitHub, with a copy on your computer', detail: 'Same as GitHub, plus a local copy you can open yourself.' },
  ],
  recommendation: 'github', recommendationWhy: 'It removes the biggest risk on the project and lets the team work without your computer being on. You’ll need to connect GitHub once.' });
D('D2', { order: 2, status: 'needs-you', raisedBy: 'Team Lead', due: '2026-10-18', blocks: [],
  title: 'Approve how the team makes decisions',
  context: 'The Team Lead makes day-to-day calls and logs each one below, where you can overrule it. The big calls (see “Who decides what”) always come to you here.',
  options: [
    { id: 'approve', label: 'Approve as proposed', detail: 'The Lead decides within the current phase. You decide scope, gates, privacy, anything public, brand and money.' },
    { id: 'design-too', label: 'Approve, but design and copy changes also come to me', detail: 'Slower: about 2–3 extra decisions a week.' },
    { id: 'all', label: 'Everything comes to me', detail: 'You stay in every loop; the team waits on you often.' },
  ],
  recommendation: 'approve', recommendationWhy: 'It keeps you in control of what matters and stops small calls from waiting on you. You can still overrule any logged call.' });
D('D3', { order: 3, status: 'needs-you', raisedBy: 'Planner', due: '2026-10-19', blocks: ['T20', 'T21'],
  title: 'We’re two weeks ahead. What should we do with the time?',
  context: 'The engine planned for November is already built. The Planner sees three ways to use the lead.',
  options: [
    { id: 'buffer', label: 'Keep the January 25 launch, start the MVP now, and run a longer beta', detail: 'Beta becomes 5 weeks instead of 3, with more real-phone testing.' },
    { id: 'earlier', label: 'Launch two weeks earlier (January 11)', detail: 'Same plan, compressed. Less room if HEIC or big folders cause trouble.' },
    { id: 'december', label: 'Launch before the holidays (mid-December)', detail: 'Fast, but skips most of the beta, and launch news gets lost over the holidays.' },
  ],
  recommendation: 'buffer', recommendationWhy: 'Real-phone formats (iPhone HEIC, Samsung) are the biggest unknown. Extra beta time protects the promise that no real photo gets hidden.' });
D('D4', { order: 4, status: 'needs-you', raisedBy: 'Product owner', due: '2026-10-23', blocks: ['T23'],
  title: 'What counts as real-world proof for gate 2?',
  context: 'You don’t have a damaged card to recover. The team has already tested a real PhotoRec recovery of a wiped virtual SD card (0 of 107 photos set aside by mistake).',
  options: [
    { id: 'virtual-plus-phone', label: 'The virtual card test plus a scan of your own phone’s photos', detail: 'Ready this week. Your phone covers real iPhone or Samsung formats.' },
    { id: 'plus-usb', label: 'Also do a real recovery from a spare USB stick', detail: 'About 1 hour of your time. The most realistic test.' },
    { id: 'repair-shop', label: 'Wait for a real damaged card from a repair shop', detail: 'Most realistic, but the timing is unknown and needs the owner’s permission.' },
  ],
  recommendation: 'virtual-plus-phone', recommendationWhy: 'It covers the formats that actually broke in testing (phone photos) without waiting. The beta adds real recoveries later.' });
D('D5', { order: 5, status: 'upcoming', title: 'Approve the product name', due: '2026-10-24' });
D('D6', { order: 6, status: 'upcoming', title: 'Confirm the GPL-3.0 license before the code goes public', due: '2026-12-04' });
D('D7', { order: 7, status: 'upcoming', title: 'Pass or fail gates 1 and 2', due: '2026-10-25' });
D('D8', { order: 8, status: 'upcoming', title: 'Choose the first premium feature', due: '2027-02-05' });

const L = (id, data) => put(`leadlog/${id}`, data);
L('L1', { at: '2026-10-15', title: 'Stay with React', decision: 'The app stays on React; we won’t switch to Svelte.', why: 'It’s already built and fully tested. Switching would cost about a week for no user-visible gain. Closes the open question in the plan.' });
L('L2', { at: '2026-10-15', title: 'Hide “Adjust cleanup rules” until it works', decision: 'The button is removed until the feature exists.', why: 'The UX writer flagged that a button that does nothing worries upset users.' });
L('L3', { at: '2026-10-15', title: 'Keep files we can’t read', decision: 'Files that fail to read stay in Keep instead of going to “Damaged”.', why: 'From QA: a flaky SD card could otherwise hide a real photo. Showing an extra file is safer than hiding one.' });
L('L4', { at: '2026-10-15', title: 'Adopt the UX writer’s copy changes', decision: '“Peek” becomes “Show”, “low-resolution” becomes “blurry”, and so on.', why: 'Plainer words for non-native English readers.' });
L('L5', { at: '2026-10-15', title: 'Make the virtual SD card test a standing check', decision: 'Every engine change is re-tested against a real PhotoRec recovery of a wiped virtual card.', why: 'It caught what synthetic files can’t: real PhotoRec splits and extras.' });

const R = (id, data) => put(`risks/${id}`, data);
R('R1', { order: 1, level: 'High', status: 'open', title: 'The code only lives in a temporary cloud workspace', plan: 'Move it to a permanent home this week (D1, T12).', owner: 'Team Lead' });
R('R2', { order: 2, level: 'High', status: 'open', title: 'iPhone HEIC photos are untested', plan: 'Your phone scan (T13), then HEIC support and real samples in tests (T17, T18).', owner: 'QA tester' });
R('R3', { order: 3, level: 'Medium', status: 'open', title: 'No real damaged-card data yet', plan: 'Virtual-card tests now; real recoveries during beta (D4).', owner: 'Product owner' });
R('R4', { order: 4, level: 'Medium', status: 'open', title: 'Speed and memory on 40,000+ files unknown', plan: 'Big-folder test in Sprint 2 (T27).', owner: 'QA tester' });
R('R5', { order: 5, level: 'Medium', status: 'open', title: 'Safari and Firefox can’t save to a folder', plan: 'Zip download as the fallback (T21, T25).', owner: 'Front-end developer' });
R('R6', { order: 6, level: 'Low', status: 'open', title: 'The name “Keepsake” may already be taken', plan: 'Name check in Sprint 1 (T16), then your call (D5).', owner: 'Product owner' });

const M = (id, data) => put(`metrics/${id}`, data);
M('M1', { order: 1, label: 'Real photos set aside by mistake', value: '0 of 430', target: 'under 1%', status: 'ok', source: 'Test folder + real PhotoRec recovery', at: '2026-10-15' });
M('M2', { order: 2, label: 'Junk left among the keepers', value: '0 of 443', target: 'under 5%', status: 'ok', source: 'Same two test runs', at: '2026-10-15' });
M('M3', { order: 3, label: 'Automated tests passing', value: '20 of 20', target: 'all', status: 'ok', source: 'npm test', at: '2026-10-15' });
M('M4', { order: 4, label: 'Data sent off the computer', value: 'None', target: 'none, ever', status: 'ok', source: 'Browser test, desktop and phone', at: '2026-10-15' });
M('M5', { order: 5, label: 'Scan speed', value: '1,407 files in 3 s', target: '40,000 files under 5 min', status: 'watch', source: 'Not yet measured at 40,000 files', at: '2026-10-15' });
M('M6', { order: 6, label: 'Real phone formats tested', value: 'Not yet', target: 'iPhone and Samsung', status: 'risk', source: 'Waiting on your phone scan (T13)', at: '2026-10-15' });

const A = (id, at, who, text) => put(`activity/${id}`, { at, who, text });
A('a01', '2026-10-14T23:39:00+08:00', 'UX designer', 'published the cleanup results mockup');
A('a02', '2026-10-15T00:02:00+08:00', 'Product owner', 'published the implementation plan');
A('a03', '2026-10-15T00:30:00+08:00', 'QA tester', 'found that Samsung and Pixel photos were wrongly marked damaged; the developer fixed it');
A('a04', '2026-10-15T00:33:00+08:00', 'Front-end developer', 'finished phase 1: engine, results screen, 20 passing tests');
A('a05', '2026-10-15T00:47:00+08:00', 'QA tester', 'ran a real PhotoRec recovery on a wiped virtual SD card: 0 of 107 photos set aside by mistake');
A('a06', '2026-10-15T00:50:00+08:00', 'Front-end developer', 'published the preview with example files');
A('a07', '2026-10-15T15:05:00+08:00', 'Team Lead', 'joined the team with the Planner; logged 5 calls for you to review');
A('a08', '2026-10-15T15:10:00+08:00', 'Planner', 're-forecast the timeline: two weeks ahead; raised D3');

const ops = Object.entries(docs).map(([path, data]) => {
  const i = path.indexOf('/');
  return { action: 'set', collection: path.slice(0, i), doc_id: path.slice(i + 1), data };
});
writeFileSync(new URL('./seed-ops.json', import.meta.url), JSON.stringify(ops));
writeFileSync(new URL('./seed-flat.json', import.meta.url), JSON.stringify(docs));
console.log(`${ops.length} documents`);
