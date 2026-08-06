import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../plugin/', import.meta.url);

test('Cindy plugin exposes the full claw-kit skill surface', async () => {
  const manifest = JSON.parse(await readFile(new URL('ghost.json', root), 'utf8'));
  const names = manifest.skill.items.map((item) => item.name).sort();
  assert.deepEqual(names, ['planning', 'researcher', 'update', 'using-claw-kit']);

  for (const entry of [
    'skills/using-claw-kit/SKILL.md',
    'skills/config/SKILL.md',
    'skills/planning/SKILL.md',
    'skills/researcher/SKILL.md',
    'skills/create-claw-skill/SKILL.md',
    'skills/update/SKILL.md',
  ]) {
    await readFile(new URL(entry, root), 'utf8');
  }
});

test('Cindy marketplace and update contracts are self-contained without archive assets', async () => {
  const [marketplaceSource, skill, template, fallback, coverage] = await Promise.all([
    readFile(new URL('../.agents/plugins/marketplace.json', import.meta.url), 'utf8'),
    readFile(new URL('skills/update/SKILL.md', root), 'utf8'),
    readFile(new URL('skills/update/TEMPLATE.json', root), 'utf8'),
    readFile(new URL('skills/update/non-claw-fallback.md', root), 'utf8'),
    readFile(new URL('skills/update/CONTENT-COVERAGE.md', root), 'utf8'),
  ]);

  const marketplace = JSON.parse(marketplaceSource);
  assert.ok(marketplace.plugins.some((entry) =>
    entry.name === 'claw-kit-cindy' &&
    entry.source?.source === 'local' &&
    entry.source?.path === './plugin'
  ));

  const contract = `${skill}\n${template}\n${fallback}\n${coverage}`;
  assert.match(contract, /custom (?:Git )?marketplace/i);
  assert.match(contract, /chanyuenpang\/claw-kit-cindy-adapter/);
  assert.match(contract, /claw-kit-cindy/);
  assert.match(skill, /Cindy-owned update implementation/);
  assert.match(skill, /Each supported platform maintains\s+its own adjacent `update` skill/);
  assert.match(skill, /shared\s+global CLI together with that platform's plugin/);
  assert.match(skill, /without a pinned ref/);
  assert.match(fallback, /legacy manual `claw-kit` install conflicts/);
  assert.match(skill, /do not\s+download or open a `\.cindy` archive/is);
});

test('Cindy release version follows the CLI base rather than an older Cindy tag', async () => {
  const releasing = await readFile(new URL('../RELEASING.md', import.meta.url), 'utf8');
  assert.match(releasing, /authorized CLI candidate/);
  assert.match(releasing, /published `@veewo\/claw` version/);
  assert.match(releasing, /<cli-base>\.<next-fourth-segment>/);
  assert.match(releasing, /not a separate three-segment version line/);
});

test('Cindy omits WUM prompt injection and keeps session-start work asynchronous', async () => {
  const [source, skill, manifestSource, worker] = await Promise.all([
    readFile(new URL('main.js', root), 'utf8'),
    readFile(new URL('skills/using-claw-kit/SKILL.md', root), 'utf8'),
    readFile(new URL('ghost.json', root), 'utf8'),
    readFile(new URL('node/claw-worker.cjs', root), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.deepEqual(manifest.agent, { background: true });
  assert.doesNotMatch(source, /CINDY_CLAW_ENTRY_PROMPT|Use claw-kit:using-claw-kit/);
  assert.doesNotMatch(source, /First call the Ghost tool/);
  assert.doesNotMatch(source, /will-user-message/);
  assert.doesNotMatch(source, /sessionPrompts|injectedSessions|preparedSessions|preparingSessions/);
  assert.match(source, /msg\.name === 'did-session-created'/);
  assert.match(source, /scheduleSessionBackground\(data\.sessionId, data\.workdir\)/);
  assert.match(source, /setTimeout\(\(\) => \{\s*void prepareSessionBackground\(sessionId, workdir\)/);
  assert.doesNotMatch(source, /await prepareSessionBackground/);
  assert.match(source, /refreshSessionStart/);
  assert.match(source, /claw\/session-start/);
  assert.match(worker, /claw\/session-start/);
  assert.match(worker, /'context', '--host', 'cindy'/);
  assert.match(worker, /function projectionForContext/);
  assert.deepEqual(manifest.subscribe.topics, ['session', 'turn']);
  assert.match(source, /runSessionMaintenance/);
  assert.match(source, /claw\/session-background/);
  assert.match(source, /Promise\.all\(\[\s*refreshSessionStart\(sessionId, workdir\),\s*runSessionMaintenance\(sessionId, workdir\)/);
  assert.doesNotMatch(source, /cindy\.agent\.errand|cindy\.agent\.queryErrand/);
  assert.equal('hooks' in manifest.subscribe, false);
  assert.match(source, /function toolFailure\(callId, reason, errorCode = 'CLAW_OPERATION_FAILED'\)/);
  assert.match(source, /tool-result', callId, ok: false, errorCode, message: reason/);
  assert.doesNotMatch(source, /sessionModels|CINDY_CLAW_ENTRY_PROMPT_GPT|data\.model/);
  assert.match(skill, /know.*GPT\/Codex.*Shell \+ bridge/is);
  assert.match(skill, /not sure.*Ghost tool/is);
  assert.match(skill, /Use the Ghost tools in this exact order/);
  assert.match(skill, /Never pass `list_tools` itself as `call_tool\.name`/);
  assert.match(skill, /Host-forged `args\.session_context`/);
  assert.match(skill, /Do not\s+add, reconstruct, or override this field/);
  assert.match(skill, /knowledgeDispatch/);
  assert.match(skill, /Session scope is temporary and does not persist project knowledge/);
  assert.match(skill, /never returns a `knowledgeDispatch`/);
  assert.match(skill, /finish normally without creating\s+or messaging an Orca Worker/);
  assert.match(skill, /cindy_orca\.get_workspace_info/);
  assert.match(skill, /cindy_orca\.start_team/);
  assert.match(skill, /cindy_orca\.create_worker/);
  assert.match(skill, /cindy_orca\.send_to_worker/);
  assert.match(skill, /knowledge-finalizer/);
  assert.match(skill, /Do not wait for the Worker/i);
  assert.match(skill, /Immediately finish the main response after that acknowledgement/i);
  assert.match(skill, /without polling or reading the\s+Worker/i);
  assert.match(skill, /job already exists/i);
  assert.match(skill, /knowledge\.claim/);
  assert.doesNotMatch(skill, /did-turn-end[^\n]*(capture|create).*job/i);
});

test('Goal continuation keeps structured events out of the visible prompt', async () => {
  const source = await readFile(new URL('main.js', root), 'utf8');
  assert.match(source, /promptTemplate: '\{\{user_message\}\}'/);
  assert.doesNotMatch(source, /promptTemplate: '[^']*event_json/);
  assert.match(source, /data-ghost-action="\$\{action\}"/);
  assert.match(source, /goalAuthorizationCards\.set\(cardId, true\)/);
  assert.match(source, /function goalContinuationPrompt\(goal\)/);
  assert.match(source, /taskTitle/);
  assert.match(source, /cindyAuthorizationCardIssued\.has\(sessionId\)/);
  assert.doesNotMatch(source, /cindyAuthorizationCardIssued\.delete\(sessionId\)/);
  assert.match(source, /function workflowCardState\(projection\)/);
  assert.match(source, /state: workflowCardState\(projection\)/);
  assert.doesNotMatch(source, /will-assistant-message/);
  assert.match(source, /msg\.name === 'did-turn-end'/);
  assert.match(source, /function captureTurnEndReport\(msg\)/);
  assert.match(source, /capturedTurnKeys/);
});
