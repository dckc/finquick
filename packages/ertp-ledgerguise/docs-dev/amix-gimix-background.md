# Provenance

This document summarizes the GiMiX presentation, which reimagines the **American Information Exchange (AMIX)** system from 1984.

**AMIX (1984)**
- Designed by Chip Morningstar and Randy Farmer
- Wikipedia: https://en.wikipedia.org/wiki/American_Information_Exchange

**GiMiX (2023)**
- Repository: https://github.com/agoric-labs/gimix
- Presentation PDF: https://github.com/agoric-labs/gimix/files/13417710/GiMiX_.AMiX.with.GitHub.pdf
- Agoric Internal Hackathon 2023

---

# Purpose of This Summary

This document summarizes the *GiMiX: AMiX with GitHub* presentation for the specific purpose of **prompting another LLM to design a similar system**. The emphasis is on **conceptual architecture, roles, state transitions, and invariants**, not on Agoric- or Zoe-specific implementation details. Smart contract mechanics are treated as secondary, except where they materially constrain or inform the overall design.

---

# High-Level Concept

GiMiX is a modern reimagining of the **American Information Exchange (AMIX)** model, applied to **open-source software work** and implemented using **blockchain escrow plus GitHub as an off-chain arbiter**.

The system enables:
- A requester (maintainer or sponsor) to post a *work agreement* tied to a GitHub issue
- A developer to deliver work by submitting a GitHub PR
- Automated or semi-automated verification (via a GitHub oracle)
- Trust-minimized release of payment upon verified acceptance

The core idea is to **reuse GitHub’s existing social and governance mechanisms** (issue assignment, PR approval, merge rules) while using on-chain logic strictly for **escrow, incentives, and settlement**.

---

# Actors and Roles

## Requester ("Alice")
- Proposes work tied to a GitHub issue
- Supplies funds up-front (escrow)
- Defines acceptance criteria indirectly via GitHub repo rules
- Ultimately authorizes or relies on GitHub’s merge process for acceptance

## Worker / Developer ("Bob")
- Performs work off-chain
- Submits a PR that closes the referenced issue
- Claims payment by proving delivery and acceptance

## GitHub Oracle
- Off-chain service with read access to GitHub
- Verifies factual claims:
  - PR exists
  - PR is authored by the expected party
  - PR is approved according to repo rules
  - PR is merged
  - PR closes the specified issue
- Reports verified facts to the on-chain system

## On-chain Escrow / Agreement Logic
- Holds funds
- Tracks job state
- Releases funds based on oracle-confirmed events

---

# Mapping to Classical AMIX

The design is explicitly inspired by **Basic AMIX Consulting**, where economic exchange is modeled as a *state machine* with explicit transitions.

The GiMiX system maps software development to AMIX concepts:

| AMIX Concept | GiMiX Interpretation |
|-------------|---------------------|
| Negotiation | Issue discussion & assignment (off-chain) |
| Agreement | Work agreement + escrow creation |
| Delivery | PR submission |
| Acceptance | PR approval + merge |
| Payment | On-chain fund release |

---

# AMIX State Diagram (Detailed)

The presentation includes a **Basic AMIX Consulting State Diagram** (see slide with AMIX diagram). Below is a detailed reconstruction, adapted to GiMiX.

## States

### 1. Start
- No relationship exists yet
- No funds committed
- No expectations set

**Entry conditions**: None

**Exit triggers**:
- Parties begin negotiation (off-chain)

---

### 2. Negotiation
- Parties discuss scope, expectations, and feasibility
- In GiMiX: happens primarily on GitHub issue comments
- No binding commitments yet

**Key properties**:
- Cheap to enter and exit
- No on-chain state required

**Exit triggers**:
- Requester proposes a formal agreement

---

### 3. Agreement
- A binding agreement is created
- Funds are escrowed
- Acceptance criteria are fixed *implicitly* by referencing:
  - A specific GitHub issue
  - The repository’s PR approval and merge rules

**In GiMiX**:
- A work agreement references `issueUrl`
- Payment is locked on-chain

**Invariants**:
- Funds cannot be reclaimed without following exit rules
- Acceptance authority is delegated to GitHub governance

**Possible exits**:
- Delivery
- Deadline expiration
- Cancellation (if allowed)

---

### 4. Ready / Committed (AMIX intermediate state)
- Agreement exists
- Both parties are committed
- Work has not yet been delivered

This is sometimes implicit but important:
- Funds are locked
- Worker has incentive to act

---

### 5. Delivery
- Worker submits work
- In GiMiX: PR submission that claims to close the issue

**Verification inputs**:
- PR URL
- Issue URL
- GitHub metadata (author, assignee, status)

**Key check** (as shown in slides):
```
pull.author === issue.assignee &&
pull.status === 'merged' &&
issue.status === 'closed'
```

**Exit triggers**:
- Successful verification → Acceptance
- Failure or dispute → Deadlock or renegotiation

---

### 6. Acceptance
- The requester (or delegated authority) accepts delivery
- In GiMiX, this is *not* an explicit on-chain action
- Acceptance is inferred from GitHub:
  - PR approved
  - PR merged

**Critical design insight**:
Acceptance authority is **outsourced to GitHub**, reducing on-chain complexity and subjective judgment.

---

### 7. Payment
- Funds are released to the worker
- Settlement is final

**Properties**:
- Atomic with acceptance confirmation
- No further recourse

---

### 8. Dead / Cancelled / Failed
- Agreement terminates without successful delivery
- Causes may include:
  - Deadline expiration
  - Mutual abandonment
  - Superseding work

**Outcome**:
- Funds may be reclaimed or redistributed according to rules

---

# Key Design Principles

## 1. Minimize On-chain Semantics
- The chain does *not* decide code quality
- The chain does *not* mediate disputes
- It only enforces escrow and state transitions

## 2. Delegate Judgment to Existing Institutions
- GitHub already solves:
  - Identity (accounts)
  - Reputation
  - Review processes
  - Governance rules

GiMiX treats GitHub as the **arbiter of acceptance truth**.

## 3. Explicit State Transitions
- Each phase has:
  - Clear entry conditions
  - Clear exit triggers
  - Minimal ambiguity

This is directly inherited from AMIX thinking.

## 4. Capability-Oriented Trust
- Oracles are powerful but constrained
- Oracles can only redirect funds already committed
- They cannot mint value or steal beyond escrowed amounts

---

# Threat Model (Conceptual)

- Requester can edit issues → mitigated by relying on merge events, not comments
- Worker can submit bad code → mitigated by repo rules
- Oracle can misreport → bounded by escrow limits
- Front-running PRs → inherent risk, accepted as low-impact

---

# What an LLM Should Reproduce

When prompting another LLM to build a similar system, ensure it:

1. Models the workflow as an **explicit state machine**
2. Separates **negotiation**, **delivery**, **acceptance**, and **payment**
3. Uses an existing platform (e.g., GitHub, GitLab) as the *acceptance oracle*
4. Keeps on-chain (or core system) logic minimal and mechanical
5. Treats escrow as the primary enforcement mechanism
6. Clearly defines invariants at each state transition

---

# What Is Intentionally De-emphasized

- Smart contract APIs
- Language-specific tooling
- UI screenshots
- Deployment mechanics

These are implementation details, not architectural essence.

---

# Core Takeaway

GiMiX demonstrates that **AMIX-style consulting markets** can be reimplemented today by combining:
- A strict state-machine mental model
- Existing social coding platforms for judgment
- Cryptographic escrow for incentives

The novelty is not the contract—it is the *delegation of acceptance authority* and the disciplined separation of concerns.

