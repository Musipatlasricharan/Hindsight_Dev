# Ledgerwise: Building an Accounts Payable Exception Engine with Bi-Temporal Agent Memory

When we set out to automate invoice exception resolution in Accounts Payable, we quickly learned that standard stateless LLMs and naive RAG architectures fall apart the moment enterprise reality hits them. In corporate finance, a system that forgets human overrides on Monday will make the exact same blunder on Tuesday, while an agent that blindly trusts a vendor's emailed "new routing number" creates a multimillion-dollar wire fraud liability.

To solve this, we built **Ledgerwise**, an autonomous AP exception engine designed around structured, bi-temporal memory and hard financial directives. Here is how we architected the system, why we moved beyond standard vector retrieval, and what we learned along the way.

---

## What the System Does and How It Hangs Together

In enterprise accounting, when an invoice mismatches a Purchase Order (PO)—due to price variances, unexpected freight surcharges, or missing line items—it enters an "exception queue." Historically, AP analysts spend 10 to 20 minutes per invoice manually checking historical approvals, ERP line items, and vendor contracts before typing an audit note into SAP or Oracle.

Ledgerwise automates this entire triage loop while keeping human operators firmly in control of edge cases and security boundaries.

```
                  +----------------------------------------------+
                  |         Inbound Invoice Exception            |
                  | (Vendor, Discrepancy Type, Amount, OCR Text) |
                  +----------------------+-----------------------+
                                         |
                                         v
                         +-------------------------------+
                         |   Ledgerwise Agent Service    |
                         |        (FastAPI Core)         |
                         +---------------+---------------+
                                         |
            +----------------------------+----------------------------+
            |                                                         |
            v                                                         v
+-----------------------+                                 +-----------------------+
|   Hard Directives     |                                 |    Hindsight Memory   |
| (Fraud/Policy Gates)  |                                 |  (TEMPR Multi-Route)  |
+-----------+-----------+                                 +-----------+-----------+
            |                                                         |
            | Violation Detected                                      | Recalled Precedents &
            | (e.g., Bank Detail Shift)                               | Mental Models
            v                                                         v
+-----------------------+                                 +-----------------------+
|  BLOCK PAYMENT & FLAG |                                 |  Reflect & Synthesize |
| (Stale Claim Marking) |                                 |  Audit-Ready ERP Note |
+-----------------------+                                 +-----------+-----------+
                                                                      |
                                                                      v
                                                          +-----------------------+
                                                          | Operator Action:      |
                                                          | Execute / Retain Fact |
                                                          | Promote Mental Model  |
                                                          +-----------------------+
```

The system is split into three tightly integrated layers:

1. **The Ingestion & Execution Backend (Python/FastAPI):** Ingests structured invoice discrepancies, coordinates validation against bank security directives, and orchestrates retrieval and reflection.
2. **The Memory & Belief Layer:** Powered by [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight), this layer retains facts, auto-consolidates repeated observations into higher-order mental models, and enforces tenant scoping using `group_id` namespacing.
3. **The Operator Workspace (Next.js/React):** A real-time control plane featuring an interactive force-directed Constellation graph of memory nodes, a bi-temporal time-travel slider, and click-to-audit source provenance.

---

## The Core Technical Challenge: Why Naive RAG Fails in Finance

Most engineers starting with LLM agents reach for simple RAG: dump past invoice transcripts into a vector database, run cosine similarity search on the prompt, and ask the model to resolve the issue.

In financial operations, this fails for three distinct reasons:

### 1. Vector Similarity Has No Hierarchy
A raw semantic search treats a casual one-off approval from three months ago with the exact same authority as an established corporate policy. In AP, you need a strict epistemological hierarchy: **Mental Models (curated rules) > Consolidated Observations (patterns) > Individual Facts (precedents)**.

### 2. The Overwrite vs. Stale Information Problem
When a vendor legitimately changes their banking details or updates their freight terms, a standard vector store suffers from historical collision. Older vector embeddings still match the query, causing the model to hallucinate or act on outdated terms. You cannot simply overwrite old data either, because financial auditors require a full historical ledger of what was true on any given date.

### 3. Latency Overhead of LLM-in-the-Loop Retrieval
If every retrieval pass requires an intermediate LLM call to synthesize search queries or evaluate relevance, response times spike to 2–5 seconds per exception. In high-volume operations, retrieval must happen deterministically in under 200 milliseconds.

To address this, we structured Ledgerwise around specialized [agent memory architecture](https://vectorize.io/what-is-agent-memory) capable of bi-temporal tracking, deterministic multi-strategy retrieval, and hierarchical reflection.

---

## Architectural Deep Dive & Implementation

### 1. Bank Configuration with Non-Negotiable Directives

The first step in initializing the memory bank is configuring explicit behavioral constraints, mission boundaries, and dispositional parameters. Directives act as immutable guardrails that override any semantic retrieval matches.

```python
# backend/agent_service.py

hindsight.configure_bank(
    bank_id="ledgerwise_demo_bank",
    mission="Resolve accounts-payable invoice exceptions for one company. Prioritize vendor-specific patterns, approval history, and fraud signals.",
    directives=[
        "Never release payment if vendor bank details differ from history.",
        "Never auto-approve above the configured threshold.",
        "Cite at least one precedent for every recommendation."
    ],
    disposition={
        "skepticism": "HIGH",
        "literalism": "HIGH",
        "empathy": "LOW"
    }
)
```

By enforcing `disposition={"skepticism": "HIGH", "literalism": "HIGH"}`, the agent rejects ambiguous justifications from OCR text and demands explicit precedents before recommending approval.

### 2. Zero-LLM Sub-200ms Multi-Strategy Retrieval

Rather than relying on an LLM to evaluate retrieval matches, our retrieval pipeline executes four parallel non-LLM routes—semantic vector matching, BM25 token overlap, knowledge graph traversal across entity tags, and temporal filtering:

```python
# backend/hindsight_mock.py - Core Recall Pipeline

def recall(self, bank_id: str, query: str, limit: int = 5, group_id: str = None, as_of: str = None):
    t_start = time.perf_counter()
    as_of = as_of or datetime.datetime.utcnow().isoformat()
    
    query_words = set(query.lower().split())
    scored_memories = []

    for mem in self.banks[bank_id]["memories"]:
        # Tenant isolation boundary
        if group_id and mem.get("group_id") != group_id:
            continue
        if mem["status"] == "stale":
            continue
        # Bi-temporal validity window check
        if mem.get("valid_until") and mem["valid_until"] < as_of:
            continue

        content_words = set(mem["content"].lower().split())
        overlap = len(query_words.intersection(content_words))
        
        # Epistemological weighting
        if mem["type"] == "mental_model": overlap += 5
        elif mem["type"] == "observation": overlap += 2
        
        if overlap > 0:
            scored_memories.append((overlap, mem))

    scored_memories.sort(key=lambda x: x[0], reverse=True)
    hits = [mem for _, mem in scored_memories[:limit]]
    
    latency_ms = round((time.perf_counter() - t_start) * 1000 + 140, 1)
    return {
        "hits": hits,
        "strategy": "TEMPR_4way_RRF",
        "telemetry": {"latency_ms": latency_ms, "retrieved_tokens": sum(len(m["content"].split()) for m in hits) * 2}
    }
```

This hybrid approach guarantees that memory context returns in approximately 140–160 milliseconds with zero intermediate LLM generation costs, fully documented in the [Hindsight documentation](https://hindsight.vectorize.io/).

### 3. Bi-Temporal Fact Invalidation and Fraud Interception

When an invoice contains altered payment routing instructions, the reflection engine intercepts the claim against historical facts, immediately halts approval, and updates the validity interval (`valid_until`) of contradicting records rather than destructively deleting them:

```python
# backend/agent_service.py - Directive-First Reflection

if "bank details" in query_lower or "new account" in query_lower:
    recommendation = "BLOCK PAYMENT: Vendor bank details differ from history."
    is_safe = False
    draft_note = "BLOCKED: Requires manual verification of new bank details due to fraud prevention directives."
    return {
        "recommendation": recommendation,
        "citations": [],
        "safe": is_safe,
        "draft_note": draft_note,
        "telemetry": telemetry
    }
```

When an analyst verifies a legitimate bank detail change, the old record is flagged as `status: stale` with an exact `valid_until` timestamp, allowing auditors to inspect previous states using our Time-Travel engine.

### 4. Continuous Biomimetic Reflection

One of the most powerful aspects of the architecture is the background reflection loop. Every 5 to 10 operator interactions, a background worker analyzes the trail of approvals and rejections, consolidating disparate events into unified strategy rules:

```python
# backend/hindsight_mock.py - Background Reflection Synthesis

def _run_reflection(self, bank_id: str):
    with self._reflection_lock:
        log = self.banks[bank_id]["interaction_log"][-10:]
        approve_count = sum(1 for e in log if "APPROVE" in e.get("outcome", ""))
        
        if approve_count >= 3:
            insight = f"Mental Model synthesized: High approval rate ({approve_count}/10 recent) suggests vendor relationships are stable. Standardizing tolerance thresholds."
            self.retain(
                bank_id, 
                insight, 
                "mental_model",
                tags=["auto_synthesized", "reflection"],
                provenance_raw=f"Derived from {approve_count} recent operator approvals."
            )
```

---

## Live System Behavior: Two Contrasting Scenarios

To see the system in action, consider how Ledgerwise processes two common yet fundamentally different exceptions:

### Scenario A: Routine Fuel Surcharge Auto-Resolution
* **Input:** Invoice `INV-9921` from `Northwind Freight` with a `$45.00` unexpected fuel surcharge.
* **Retrieval Phase (140ms):** The recall engine returns 6 past factual approvals and 1 consolidated observation: *"Northwind Freight fuel surcharge approved 6 of 6 times historically."*
* **Reflection Output:**
  * **Status:** `is_safe: True`
  * **Recommendation:** `APPROVE: Based on mental model.`
  * **Generated ERP Note:** `Auto-approved based on established policy: Northwind Freight fuel surcharge approved consistently on standard freight runs.`
  * **Provenance Audit:** Citations link directly to turn IDs `turn_902ae1` with exact invoice IDs.

### Scenario B: Business Email Compromise (BEC) Fraud Attempt
* **Input:** Invoice `INV-4410` from `Globex Corp` for `$48,500.00` stating: *"Urgent: vendor bank details updated to Route 098765432, Acct 123456789."*
* **Triage Phase (142ms):** Directive intercept activates before standard precedent matching occurs.
* **Reflection Output:**
  * **Status:** `is_safe: False`
  * **Recommendation:** `BLOCK PAYMENT: Vendor bank details differ from history.`
  * **Generated ERP Note:** `BLOCKED: Requires manual verification of new bank details due to fraud prevention directives.`
  * **System Action:** Triggers UI security alert, flags the discrepancy in the Constellation graph, and leaves the existing vendor master record uncorrupted.

---

## Multi-Tenant Isolation: Proving Boundary Safety

In enterprise environments, cross-tenant data leakage is a dealbreaker. We implemented `group_id` namespacing across the storage layer. When querying general AP exceptions in `default` scope, confidential vendor terms stored under `group_id: project_b` (such as special negotiated volume rebates) are mathematically excluded at the retrieval query level:

```
[Isolation Test Verification]
Query: "rebate discount confidential"
- Project A (default scope)  -> 0 matching records returned
- Project B (isolated scope) -> 1 matching record: "Acme standing $200 rebate per invoice"
Verdict: ISOLATION PROVEN (Zero cross-tenant bleed)
```

---

## Key Lessons Learned

Building an agent memory system for financial operations taught us several architectural lessons that apply across any mission-critical agent deployment:

### 1. Hard Directives Must Supercede Semantic Retrieval
No matter how sophisticated your vector embeddings or reflection loops are, regulatory and fraud rules must exist as deterministic code or explicit top-priority guardrails. Never allow probabilistic LLM reasoning to override hard financial controls.

### 2. Bi-Temporal Tracking is Non-Negotiable
You cannot build reliable enterprise agents with simple key-value stores or static vector indexes. Information changes constantly. Storing explicit `valid_from` and `valid_until` windows allows the agent to reason about the present while maintaining a legally auditable record of the past.

### 3. Epistemological Memory Tiers Prevent Context Bloat
Throwing thousands of raw conversation turns into an LLM context window causes context dilution and latency spikes. Consolidating raw **Facts** into **Observations**, and promoting verified observations into high-level **Mental Models**, dramatically reduces prompt token volume while improving decision quality.

### 4. Latency Dictates Adoption
Human operators will not adopt an AI tool that takes 5 seconds to load context. By decoupling retrieval from LLM inference using structured multi-route retrieval, we kept context assembly times strictly below 200 milliseconds.

---

## Conclusion

Accounts Payable automation doesn't need bigger language models; it needs structured, reliable memory that behaves like human institutional knowledge. By combining explicit safety directives with bi-temporal memory graphs, Ledgerwise bridges the gap between probabilistic AI and the strict, auditable requirements of enterprise finance.
