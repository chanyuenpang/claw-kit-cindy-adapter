---
name: using-claw-kit
description: "Use first whenever the claw-kit Cindy plugin is enabled or its start prompt is present; check your available tools and follow the matching execution route."
---

# Using claw-kit in Cindy

Use this skill first whenever the claw-kit Cindy plugin is enabled or the Cindy
start prompt identifies a claw-kit workflow.

## Availability boundary

If claw-kit, its CLI, Ghost tools, or workflow bridge is unavailable, skip
claw-kit and continue the user's task directly. Do not claim that the task
cannot proceed solely because claw-kit is unavailable.

> claw kit 并不是任何任务的前置条件，不允许声称 claw kit 不可用而无法推进任务。

For claw-kit usage questions, read the adjacent `../claw-kit-doc/SKILL.md`
entry and only the relevant reference for host updates, project configuration,
or Truth/ADR format. Cindy intentionally has no `update` skill; use the Cindy
UI steps in `../claw-kit-doc/references/update.md`.

Choose the execution route from runtime instructions. Use the session-start
prompt only as workflow context; do not use it to infer the route. Do not mix
routes.

## Planning stance

Treat Claw-kit as an assistive workflow tool. Use plans and tasks to focus
attention, coordinate work, and preserve progress; do not treat them as
immutable authority. Adjust the goal, scope, and task breakdown promptly when
user needs or new evidence require it. When an independently manageable scope
would keep expanding a parent task, create a subplan instead.

## Route detection

- **If you know from the runtime instructions that you are a GPT/Codex model:**
  Go to [Shell + bridge path](#shell--bridge-path--gpt-models).
- **If you are not sure that you are a GPT/Codex model:**
  Go to [Ghost tool path](#ghost-tool-path--default).

Do not infer the route from model data captured during Cindy session start.
The skill owns this choice; uncertainty always falls back to the Cindy Ghost
tool path.

## Cindy Orca agents

In Cindy, every claw-kit delegation uses the corresponding Orca Agent, exposed
by the Host as an Orca Worker. Apply the requested task scope, authorization,
model, effort, and asynchronous completion semantics directly to the Orca Agent
lifecycle.

## Knowledge finalizer dispatch

This section applies to both execution routes. Cindy has one knowledge-closeout
execution model: a persistent, UI-visible Orca Worker. When a terminal plan
mutation returns a valid `knowledgeDispatch`, dispatch that Worker directly.
That `knowledgeDispatch` is the claw-kit Orca authorization for the exact
`knowledge_finalizer` lifecycle below; no separate user confirmation is
required. It does not authorize any other Worker. The dispatch is always
executed by the Orca Agent in Cindy. The job already exists durably when the
terminal mutation returns; neither dispatch nor report capture waits for a Stop
hook.

**Orca discovery is required.** When `knowledgeDispatch` is present, dispatch
it through Cindy Orca. If `cindy_orca` is absent from a static tool list,
discover `mcp__cindy_orca__*` from `ALL_TOOLS`, then call
`get_workspace_info`. Only an actual Orca call failure makes dispatch
unavailable; never substitute shell, background work, or an unsupported claim.

1. Honor `knowledgeDispatch.preferReuse: true`: call `cindy_orca.get_workspace_info` and look for a Worker with the stable
   label `knowledge_finalizer`.
2. If no active workflow exists, call `cindy_orca.start_team`, then create the
   Worker with `cindy_orca.create_worker`, role `knowledge_finalizer`, label
   `knowledge_finalizer`, agent `codex`, and the complete
   `knowledgeDispatch.prompt` as `initial_task`.
3. If the workflow exists but that Worker does not, create it the same way.
4. If the Worker already exists, call
   `cindy_orca.send_to_worker({ target_session_id: worker.session_id, message: knowledgeDispatch.prompt })`.
   Use the `session_id` returned by `get_workspace_info`; `worker_id` is not
   the `send_to_worker` parameter.
5. Map supplied `model` and `reasoningEffort` to Worker creation only when the
   Host advertises them as valid for the Codex Worker. Do not replace an
   unsupported configured model silently.
6. Treat `resumed`, `already-active`, and `queued` as accepted asynchronous
   dispatch. Immediately finish the main response after that acknowledgement.
   Do not wait for the Worker. Do not poll, read the Worker output, query its
   status, or describe the finalization as an unfinished foreground step. The Worker uses the
   `knowledge.claim` operation in the returned prompt to capture task
   conclusions and claim the existing job atomically.

**Lead turn boundary:** an accepted Orca Writer dispatch is the terminal action
of the current Lead turn. Return the normal user-facing completion response
immediately after the `create_worker` or `send_to_worker` acknowledgement. The
Writer's report belongs to its own asynchronous turn and must not delay,
resume, or extend this Lead turn.

Never execute the returned finalizer prompt in the Lead, send it through
`cindy.agent.errand`, or let a did-turn-end hook create or claim a Cindy
knowledge job. Legacy Cindy background jobs remain visible for diagnosis but
are not launched.

---

## Shell + bridge path (GPT models)

### Canonical state

- The `.claw/` project, task, and plan files are the source of truth.
- Run `claw` CLI commands through `shell_command`; never use Ghost tools for workflow operations.
- Plan mutations use the code-mode bridge below.

### Session entry

1. Read the workflow snapshot injected by the Cindy Host at session start.
2. If the Host reports that claw is unavailable, surface its diagnosis, skip
   claw-kit, and continue the user's task directly.
3. When an active session-bound plan is recovered, continue it unless the
   current user request explicitly changes, replaces, or cancels its goal.
   Record that revision through the supported workflow before proceeding.

### Planning and execution

- Follow the returned `workflowGuidance` as the only lifecycle contract. Use its stage and
  current task to determine the current work; `commandHints` are command lookup aids.
- `process.discussing`: clarify requirements and do not implement prematurely.
- `process.active`: execute one plan task at a time and keep plan state current.
- `process.wait`: stop until the user or dependency resumes the workflow.
- `end.*`: perform the required closeout and do not auto-continue.

### Code-mode bridge for plan mutations

For every supported claw plan mutation, run this function in code mode. Change
only `argv`, `workdir`, and `timeout_ms`; do not modify the bridge itself:

```javascript
async function runClawPlanMutation({ argv, workdir, timeout_ms = 30000 }) {
  const cacheKey = "claw-kit:codex-driver:v12:s1";
  let envelope = load(cacheKey);
  if (!envelope) {
    const raw = typeof tools.shell_command === "function" ? await tools.shell_command({ command: "claw codex driver", workdir, timeout_ms })
      : typeof tools.exec_command === "function" ? await tools.exec_command({ cmd: "claw codex driver", workdir, yield_time_ms: timeout_ms })
      : (() => { throw new Error("No supported command-execution tool"); })();
    const output = typeof raw === "string" ? raw : (raw.output ?? raw.stdout ?? raw.text ?? "");
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}") + 1;
    if (start < 0 || end <= start) throw new Error("claw returned no driver envelope");
    envelope = JSON.parse(output.slice(start, end));
    if (envelope?.cacheKey !== cacheKey || envelope?.driverVersion !== 12 || envelope?.hostActionSchemaVersion !== 1) {
      throw new Error("incompatible claw driver envelope");
    }
    store(cacheKey, envelope);
  }
  const runner = (0, eval)(`(${envelope.source})`);
  if (typeof runner !== "function") throw new Error("invalid claw driver source");
  return runner({ argv, workdir, timeout_ms }, { tools, text });
}
```

### Hard boundaries

- Run every supported plan mutation through the code-mode bridge.
- Edit canonical plan state only through claw commands supplied by returned guidance.
- If code mode or the driver is unavailable, skip the claw workflow and
  continue the user's task directly; do not substitute an unsupported plan
  mutation.
- Keep claw harness mechanics out of normal thread replies.

### Completion

When all plan tasks are complete:

1. Complete the canonical plan transition through the bridge.
2. If the terminal result contains a `knowledgeDispatch`, dispatch it through
   the Orca flow above before returning the normal final response.
3. Do not wait for a Stop hook or for the Writer to finish. Once dispatch is
   accepted, return the main reply immediately without polling or reading the
   Worker.

---

## Ghost tool path (default)

### Canonical state

- The `.claw/` project, task, and plan files are the source of truth.
- Cindy Progress/Todo and Goal are Host-owned optional presentation surfaces;
  never treat them as a second plan database or attempt to operate them.
- The Ghost Node Worker owns `claw` discovery, `--host cindy`, session binding,
  command execution, and lifecycle projection. Do not run `claw` shell
  commands, supply host/session arguments, or request a plan sync.

### Session entry

1. Read the workflow snapshot injected by the Cindy Host at session start (or
   after Host-managed compact recovery).
2. If the Host reports that claw is unavailable, surface its actionable
   diagnosis, skip claw-kit, and continue the user's task directly without
   pretending that recovery succeeded.
3. When an active session-bound plan is recovered, continue it unless the
   current user request explicitly changes, replaces, or cancels its goal.
   Record that revision through the supported workflow before proceeding.

Only the Host invokes `claw context`, and only for session start or compact
recovery. It is never a turn-end status probe.

### Planning and execution

- Use the Ghost tools in this exact order:
  1. Refresh the Ghost list and identify the `claw-kit` plugin. Do not search
     MCP resources or discover server names.
  2. Invoke its `list_tools` with no `category` to get the category overview.
  3. Invoke that same `list_tools` again with the selected `category` to get
     operation names and argument schemas.
  4. Invoke `call_tool` with one of those operation names and its JSON
     arguments. Never pass `list_tools` itself as `call_tool.name`.
- `call_tool` receives Host-forged `args.session_context` automatically. It
  identifies the current Cindy session and workspace (`session_id`, `workdir`,
  `workdir_is_local`, and `workdir_is_read_only`) so the plugin can execute in
  the right project without accepting agent-supplied identity or paths. Do not
  add, reconstruct, or override this field.
- If a catalog call succeeds but `call_tool` returns a generic Host error, do
  not fall back to shell commands or fabricate session context. Surface the
  recoverable failure; the Host must deliver the trusted context before a
  workflow operation can run.
- Follow the returned Cindy `guidance` object. Its `commandHints` are
  equivalent `call_tool` instructions: invoke the given operation name and
  JSON arguments, and fill any listed `requiredArgs` before calling.
- `process.discussing`: clarify requirements and do not implement prematurely.
- `process.active`: execute one plan task at a time and keep plan state current.
- `process.wait`: stop until the user or dependency resumes the workflow.
- `end.*`: perform the required closeout and do not auto-continue.
- Keep low-complexity work lightweight when claw guidance says a full plan is
  unnecessary.

Do not request or discuss host actions, plan synchronization, Goal Mode, or
Worker lifecycle details.

### Completion

When all plan tasks are complete:

1. Complete the canonical plan transition through `call_tool`.
2. If the terminal result contains a `knowledgeDispatch`, dispatch it through
   the Orca flow above before returning the normal final response.
3. Do not wait for a Stop hook or for the Writer to finish. Once dispatch is
   accepted, return the main reply immediately without polling or reading the
   Worker; do not manually trigger sync or Goal handling.

Knowledge closeout must remain bounded to the current project and plan. A
failure must be visible and recoverable; never silently mark a failed closeout
as complete.
