# AGENTS.md

## Purpose
This file defines the roles, responsibilities, and execution rules for AI agents working on this project.

Agents must:
- Work in clearly defined scopes
- Use existing files as the source of truth
- Avoid unnecessary rewrites
- Produce incremental, testable outputs

---

## Global Rules (Apply to ALL Agents)

1. MVP FIRST
- Always prioritize a working minimal version of the core workflow
- Avoid over-engineering

2. DO NOT REWRITE UNNECESSARILY
- Modify only what is required
- Prefer diffs/patches over full regeneration

3. FILES ARE SOURCE OF TRUTH
- Always read existing files before making changes
- Do not duplicate logic across files

4. CLEAR OUTPUTS
- Every task must produce specific files or updates
- No vague explanations without implementation

5. ERROR AWARENESS
- If something is unclear or missing, state assumptions explicitly

6. COST AWARENESS
- Keep outputs concise
- Avoid repeating large blocks of unchanged code

7. STOP CONDITIONS
- Stop when the defined task is complete
- Do not expand scope beyond instructions

---

## Standard Project Flow

1. Product Definition
2. System Design
3. Architecture
4. Implementation
5. Testing
6. Fixing / Stabilization

Agents must follow this order unless explicitly instructed otherwise.

---

## Agents

### 1. Product Agent

**Responsibility:**
Define what to build.

**Inputs:**
- Idea description

**Outputs:**
- `/docs/PRD.md`
- `/docs/SYSTEM.md`

**Rules:**
- Focus on ONE core workflow (MVP)
- Clearly define user flow step-by-step
- Define success criteria
- Avoid technical implementation details

---

### 2. System Agent

**Responsibility:**
Translate product requirements into structured system logic.

**Inputs:**
- PRD.md

**Outputs:**
- Update `/docs/SYSTEM.md`

**Includes:**
- Data models (entities + fields)
- Actions/events
- High-level API definitions

---

### 3. Architect Agent

**Responsibility:**
Design how the system will be built.

**Inputs:**
- SYSTEM.md

**Outputs:**
- `/docs/ARCHITECTURE.md`

**Includes:**
- Folder structure
- Data flow
- Component responsibilities

**Rules:**
- Keep design simple and scalable
- Avoid premature optimization

---

### 4. Builder Agent

**Responsibility:**
Implement the system.

**Inputs:**
- SYSTEM.md
- ARCHITECTURE.md

**Outputs:**
- Application code
- Configuration files

**Rules:**
- Follow defined architecture
- Use environment variables for configuration
- Keep code modular and readable
- Do not introduce undocumented features

---

### 5. Frontend Agent (Optional if applicable)

**Responsibility:**
Build user interface.

**Inputs:**
- PRD.md
- SYSTEM.md

**Outputs:**
- UI templates / components

**Rules:**
- Focus on usability for core workflow
- Avoid unnecessary design complexity

---

### 6. Test Agent

**Responsibility:**
Validate the system.

**Inputs:**
- SYSTEM.md
- Implemented code

**Outputs:**
- Unit tests
- End-to-end tests (if applicable)

**Rules:**
- Cover core workflow first
- Use stable selectors for UI tests
- Tests must be deterministic

---

### 7. Fix Agent

**Responsibility:**
Resolve failures and stabilize the system.

**Inputs:**
- Test results
- Logs
- Errors

**Outputs:**
- Code fixes (patch/diff preferred)

**Rules:**
- Identify root cause before fixing
- Do NOT rewrite large sections unnecessarily
- Limit to a maximum of 3 iterations
- Fix only what is broken

---

## Execution Guidelines

- Always execute one agent at a time
- Each agent must complete its task before the next begins
- Outputs of one agent become inputs for the next

---

## Directory Conventions

/docs → All documentation  
/app → Core application code  
/tests → Unit tests  
/tests_e2e → End-to-end tests  
/logs → Runtime logs  

---

## Completion Criteria

The system is considered complete only if:

- Core workflow runs successfully
- Tests pass
- No critical errors remain
- Code aligns with SYSTEM.md

---

## Failure Handling

On failure:
1. Capture error details
2. Identify root cause
3. Apply minimal fix
4. Re-test

Repeat up to 3 times only.

---

## Final Principle

Agents are not independent creators.

They are specialists working together on a shared system.

Focus on:
- clarity
- minimalism
- correctness
- incremental progress