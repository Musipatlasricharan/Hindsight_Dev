import uuid
import time
import datetime
import threading
from typing import List, Dict, Any, Optional

class MockHindsightClient:
    """
    Advanced mock of the Hindsight memory client.
    Implements:
      - Bi-temporal memory (valid_from / valid_until)
      - Group-ID multi-tenant namespacing
      - Constellation / co-occurrence graph data
      - Provenance tracking (source_turn_id)
      - Retrieval telemetry (latency, token count)
      - Background reflection loop (mental model synthesis)
    """

    def __init__(self):
        self.banks: Dict[str, Any] = {}
        self._interaction_counter: Dict[str, int] = {}
        self._reflection_lock = threading.Lock()

    # ─────────────────────────────────────────────
    # BANK CONFIGURATION
    # ─────────────────────────────────────────────
    def configure_bank(self, bank_id: str, mission: str, directives: List[str], disposition: Dict[str, str]):
        self.banks[bank_id] = {
            "mission": mission,
            "directives": directives,
            "disposition": disposition,
            "memories": [],
            "interaction_log": [],   # raw turns for provenance
            "reflection_log": [],    # synthesized reflections history
        }
        self._interaction_counter[bank_id] = 0
        print(f"[Hindsight] Bank '{bank_id}' configured.")
        return {"status": "success", "bank_id": bank_id}

    # ─────────────────────────────────────────────
    # RETAIN  (bi-temporal + provenance + group_id)
    # ─────────────────────────────────────────────
    def retain(self, bank_id: str, content: str, memory_type: str = "fact",
               tags: List[str] = None, source_turn_id: str = None,
               valid_from: str = None, valid_until: str = None,
               group_id: str = "default", provenance_raw: str = None):
        if bank_id not in self.banks:
            raise ValueError(f"Bank {bank_id} not found")

        now = datetime.datetime.utcnow().isoformat()
        item_id = f"mem_{uuid.uuid4().hex[:8]}"
        memory = {
            "id": item_id,
            "content": content,
            "type": memory_type,
            "tags": tags or [],
            "timestamp": now,
            "status": "fresh",
            "group_id": group_id,
            # --- Bi-temporal fields ---
            "valid_from": valid_from or now,
            "valid_until": valid_until or None,   # None = still valid
            # --- Provenance ---
            "source_turn_id": source_turn_id or f"turn_{uuid.uuid4().hex[:6]}",
            "provenance_raw": provenance_raw or content,
            # --- Graph metrics (updated by build_graph) ---
            "connections": 0,
            "link_type": self._infer_link_type(memory_type),
        }
        self.banks[bank_id]["memories"].append(memory)
        print(f"[Hindsight] Retained {memory_type}: {content[:50]}...")
        return {"id": item_id, "status": "retained"}

    def _infer_link_type(self, memory_type: str) -> str:
        return {
            "fact": "semantic",
            "observation": "temporal",
            "mental_model": "causal",
        }.get(memory_type, "entity")

    # ─────────────────────────────────────────────
    # RECALL  (with telemetry + bi-temporal filter)
    # ─────────────────────────────────────────────
    def recall(self, bank_id: str, query: str, limit: int = 5,
               group_id: str = None, as_of: str = None):
        if bank_id not in self.banks:
            raise ValueError(f"Bank {bank_id} not found")

        t_start = time.perf_counter()
        now_str = datetime.datetime.utcnow().isoformat()
        as_of = as_of or now_str

        query_words = set(query.lower().split())
        scored_memories = []

        for mem in self.banks[bank_id]["memories"]:
            # Multi-tenant isolation
            if group_id and mem.get("group_id") != group_id:
                continue
            if mem["status"] == "stale":
                continue
            # Bi-temporal filter
            if mem.get("valid_until") and mem["valid_until"] < as_of:
                continue

            content_words = set(mem["content"].lower().split())
            overlap = len(query_words.intersection(content_words))
            if mem["type"] == "mental_model":
                overlap += 5
            elif mem["type"] == "observation":
                overlap += 2
            if overlap > 0:
                scored_memories.append((overlap, mem))

        scored_memories.sort(key=lambda x: x[0], reverse=True)
        hits = [mem for _, mem in scored_memories[:limit]]

        # Update connectivity for constellation view
        for mem in hits:
            mem["connections"] = mem.get("connections", 0) + 1

        latency_ms = round((time.perf_counter() - t_start) * 1000 + 140, 1)  # realistic sim
        token_count = sum(len(m["content"].split()) for m in hits) * 2

        return {
            "hits": hits,
            "strategy": "TEMPR_4way_RRF",
            "telemetry": {
                "latency_ms": latency_ms,
                "retrieved_tokens": token_count,
                "strategies_used": ["semantic", "bm25", "kg_traversal", "temporal"],
            }
        }

    # ─────────────────────────────────────────────
    # REFLECT
    # ─────────────────────────────────────────────
    def reflect(self, bank_id: str, query: str, context: List[Dict] = None,
                group_id: str = None):
        if bank_id not in self.banks:
            raise ValueError(f"Bank {bank_id} not found")

        recall_result = self.recall(bank_id, query, limit=10, group_id=group_id)
        recalled = recall_result["hits"]
        telemetry = recall_result["telemetry"]

        recommendation = "ESCALATE: Generic exception, no clear precedent."
        citations = []
        is_safe = True
        draft_note = "Please review this exception."

        query_lower = query.lower()

        # Directive: block bank detail changes
        if "bank details" in query_lower or "new account" in query_lower or "bank detail" in query_lower:
            recommendation = "BLOCK PAYMENT: Vendor bank details differ from history."
            is_safe = False
            draft_note = "BLOCKED: Requires manual verification of new bank details due to fraud prevention directives."
            self._log_interaction(bank_id, query, recommendation, group_id)
            return {"recommendation": recommendation, "citations": citations,
                    "safe": is_safe, "draft_note": draft_note, "telemetry": telemetry,
                    "nodes_fired": []}

        nodes_fired = []

        # Mental models first (highest priority)
        for mem in recalled:
            if mem["type"] == "mental_model":
                if "always approve" in mem["content"].lower() or "pre-approved" in mem["content"].lower():
                    recommendation = "APPROVE: Mental Model override — known vendor pattern."
                    citations.append(mem)
                    nodes_fired.append(mem["id"])
                    draft_note = f"Auto-approved via Mental Model: {mem['content']}"
                    self._log_interaction(bank_id, query, recommendation, group_id)
                    return {"recommendation": recommendation, "citations": citations,
                            "safe": True, "draft_note": draft_note, "telemetry": telemetry,
                            "nodes_fired": nodes_fired}

        # Observations second
        for mem in recalled:
            if mem["type"] == "observation":
                if "approved" in mem["content"].lower():
                    recommendation = "RECOMMEND APPROVAL: Consistent historical pattern observed."
                    citations.append(mem)
                    nodes_fired.append(mem["id"])
                    draft_note = f"Recommendation to approve based on observation: {mem['content']}"
                    self._log_interaction(bank_id, query, recommendation, group_id)
                    return {"recommendation": recommendation, "citations": citations,
                            "safe": True, "draft_note": draft_note, "telemetry": telemetry,
                            "nodes_fired": nodes_fired}

        # Facts last
        precedents = [m for m in recalled if m["type"] == "fact" and "approved" in m["content"].lower()]
        if precedents:
            recommendation = "RECOMMEND APPROVAL: Precedents found in memory."
            citations = precedents[:3]
            nodes_fired = [m["id"] for m in citations]
            draft_note = "Recommendation to approve based on prior successful resolutions."
            self._log_interaction(bank_id, query, recommendation, group_id)
            return {"recommendation": recommendation, "citations": citations,
                    "safe": True, "draft_note": draft_note, "telemetry": telemetry,
                    "nodes_fired": nodes_fired}

        self._log_interaction(bank_id, query, recommendation, group_id)
        return {"recommendation": recommendation, "citations": citations,
                "safe": is_safe, "draft_note": draft_note, "telemetry": telemetry,
                "nodes_fired": nodes_fired}

    # ─────────────────────────────────────────────
    # INTERACTION LOGGING (for provenance + reflection trigger)
    # ─────────────────────────────────────────────
    def _log_interaction(self, bank_id: str, query: str, outcome: str, group_id: str = None):
        turn_id = f"turn_{uuid.uuid4().hex[:6]}"
        self.banks[bank_id]["interaction_log"].append({
            "turn_id": turn_id,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "query": query,
            "outcome": outcome,
            "group_id": group_id or "default",
        })
        self._interaction_counter[bank_id] = self._interaction_counter.get(bank_id, 0) + 1

        # Trigger background reflection every 5 interactions
        count = self._interaction_counter[bank_id]
        if count > 0 and count % 5 == 0:
            t = threading.Thread(target=self._run_reflection, args=(bank_id,), daemon=True)
            t.start()

    # ─────────────────────────────────────────────
    # BACKGROUND REFLECTION LOOP (Mental Model synthesis)
    # ─────────────────────────────────────────────
    def _run_reflection(self, bank_id: str):
        with self._reflection_lock:
            log = self.banks[bank_id]["interaction_log"][-10:]
            approve_count = sum(1 for e in log if "APPROVE" in e.get("outcome", ""))
            block_count = sum(1 for e in log if "BLOCK" in e.get("outcome", ""))

            insights = []
            if approve_count >= 3:
                insight = f"Mental Model synthesized: High approval rate ({approve_count}/10 recent) suggests vendor relationships are stable. Consider lowering review threshold."
                result = self.retain(bank_id, insight, "mental_model",
                                     tags=["auto_synthesized", "reflection"],
                                     provenance_raw=f"Derived from {approve_count} recent approval outcomes.")
                insights.append({"content": insight, "id": result["id"]})

            if block_count >= 1:
                insight = f"Mental Model synthesized: {block_count} fraud attempt(s) detected recently. Elevate vigilance on bank detail changes."
                result = self.retain(bank_id, insight, "mental_model",
                                     tags=["auto_synthesized", "fraud_signal"],
                                     provenance_raw=f"Derived from {block_count} BLOCK outcomes.")
                insights.append({"content": insight, "id": result["id"]})

            if insights:
                self.banks[bank_id]["reflection_log"].append({
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "insights": insights,
                })
                print(f"[Hindsight] Reflection complete — {len(insights)} mental model(s) synthesized.")

    # ─────────────────────────────────────────────
    # CONSTELLATION GRAPH  (Feature 1)
    # ─────────────────────────────────────────────
    def get_constellation_graph(self, bank_id: str, fired_node_ids: List[str] = None):
        if bank_id not in self.banks:
            return {"nodes": [], "links": []}

        memories = self.banks[bank_id]["memories"]
        fired_node_ids = set(fired_node_ids or [])

        color_map = {
            "semantic":  "#3b82f6",   # blue   – facts
            "temporal":  "#14b8a6",   # teal   – observations
            "causal":    "#a855f7",   # purple – mental models
            "entity":    "#f59e0b",   # amber  – entity links
        }
        type_map = {
            "fact": "semantic",
            "observation": "temporal",
            "mental_model": "causal",
        }

        nodes = [{
            "id": "agent_core",
            "label": "Ledgerwise Core",
            "type": "core",
            "group": 0,
            "val": 25,
            "color": "#1a73e8",
            "firing": True,
            "connections": len(memories),
        }]
        links = []

        for mem in memories:
            link_type = type_map.get(mem["type"], "entity")
            is_firing = mem["id"] in fired_node_ids
            brightness = min(1.0, 0.4 + mem.get("connections", 0) * 0.1)
            nodes.append({
                "id": mem["id"],
                "label": mem["content"][:60] + ("…" if len(mem["content"]) > 60 else ""),
                "full_content": mem["content"],
                "type": mem["type"],
                "link_type": link_type,
                "group": {"fact": 3, "observation": 2, "mental_model": 1}.get(mem["type"], 4),
                "val": 18 if mem["type"] == "mental_model" else 12,
                "color": color_map[link_type],
                "firing": is_firing,
                "brightness": brightness,
                "status": mem.get("status", "fresh"),
                "valid_from": mem.get("valid_from"),
                "valid_until": mem.get("valid_until"),
                "provenance_raw": mem.get("provenance_raw", ""),
                "source_turn_id": mem.get("source_turn_id", ""),
                "group_id": mem.get("group_id", "default"),
                "connections": mem.get("connections", 0),
                "tags": mem.get("tags", []),
            })
            links.append({
                "source": "agent_core",
                "target": mem["id"],
                "type": link_type,
                "color": color_map[link_type],
                "firing": is_firing,
                "width": 3 if is_firing else 1,
            })

        # Entity co-occurrence links between nodes that share tags
        tag_index: Dict[str, List[str]] = {}
        for mem in memories:
            for tag in mem.get("tags", []):
                tag_index.setdefault(tag, []).append(mem["id"])

        added_links = set()
        for tag, ids in tag_index.items():
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    pair = tuple(sorted([ids[i], ids[j]]))
                    if pair not in added_links:
                        added_links.add(pair)
                        links.append({
                            "source": ids[i],
                            "target": ids[j],
                            "type": "entity",
                            "color": color_map["entity"],
                            "firing": ids[i] in fired_node_ids or ids[j] in fired_node_ids,
                            "width": 1,
                        })

        return {"nodes": nodes, "links": links}

    # ─────────────────────────────────────────────
    # MARK STALE  (bi-temporal invalidation)
    # ─────────────────────────────────────────────
    def mark_stale(self, bank_id: str, memory_id: str):
        if bank_id in self.banks:
            for mem in self.banks[bank_id]["memories"]:
                if mem["id"] == memory_id:
                    mem["status"] = "stale"
                    mem["valid_until"] = datetime.datetime.utcnow().isoformat()
                    return True
        return False

    # ─────────────────────────────────────────────
    # REFLECTION LOG  (for UI toast)
    # ─────────────────────────────────────────────
    def get_reflection_log(self, bank_id: str):
        return self.banks.get(bank_id, {}).get("reflection_log", [])


# Global instance for FastAPI
hindsight = MockHindsightClient()
