from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import datetime

from hindsight_mock import hindsight

BANK_ID = "ledgerwise_demo_bank"

# ─────────────────────────────────────────────
# SEED DATA  (runs at startup via lifespan)
# ─────────────────────────────────────────────
def seed_memory():
    hindsight.configure_bank(
        bank_id=BANK_ID,
        mission="Resolve accounts-payable invoice exceptions for one company. Prioritize vendor-specific patterns, approval history, and fraud signals.",
        directives=[
            "Never release payment if vendor bank details differ from history.",
            "Never auto-approve above the configured threshold.",
            "Cite at least one precedent for every recommendation.",
        ],
        disposition={"skepticism": "HIGH", "literalism": "HIGH", "empathy": "LOW"},
    )

    # Historical facts – Northwind Freight surcharges
    for i in range(6):
        ts = (datetime.datetime.utcnow() - datetime.timedelta(days=30 - i * 5)).isoformat()
        hindsight.retain(
            BANK_ID,
            f"Invoice INV-NW-00{i} from Northwind Freight with fuel surcharge approved by AP Manager.",
            "fact",
            tags=["Northwind", "surcharge", "freight"],
            valid_from=ts,
            provenance_raw=f"ERP approval record INV-NW-00{i} dated {ts[:10]}.",
        )

    # Consolidated observation
    hindsight.retain(
        BANK_ID,
        "Northwind Freight fuel surcharge approved 6 of 6 times historically.",
        "observation",
        tags=["Northwind", "surcharge", "pattern"],
        provenance_raw="Auto-consolidated from 6 individual approval facts.",
    )

    # Pre-seed multi-tenant Project B data (to demonstrate isolation)
    hindsight.retain(
        BANK_ID,
        "Project B confidential: Acme Supplies has a standing $200 rebate per invoice negotiated in Q3.",
        "fact",
        tags=["Acme", "rebate", "confidential"],
        group_id="project_b",
        provenance_raw="Contract amendment signed 2026-07-15.",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_memory()
    yield


# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────
app = FastAPI(title="Ledgerwise Agent Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────
class ExceptionRequest(BaseModel):
    vendor_name: str
    discrepancy_type: str
    details: str
    amount: float
    group_id: Optional[str] = "default"


class ResolutionResponse(BaseModel):
    recommendation: str
    draft_note: str
    citations: List[Dict]
    is_safe: bool
    nodes_fired: List[str]
    telemetry: Dict


class TeachRequest(BaseModel):
    content: str
    type: str = "mental_model"
    group_id: Optional[str] = "default"
    provenance_raw: Optional[str] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None


class StaleRequest(BaseModel):
    memory_id: str


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────
@app.post("/api/triage", response_model=ResolutionResponse)
async def triage_exception(request: ExceptionRequest):
    query = f"vendor {request.vendor_name} discrepancy {request.discrepancy_type} details {request.details}"
    result = hindsight.reflect(BANK_ID, query, group_id=request.group_id)
    return ResolutionResponse(
        recommendation=result["recommendation"],
        draft_note=result["draft_note"],
        citations=result["citations"],
        is_safe=result["safe"],
        nodes_fired=result.get("nodes_fired", []),
        telemetry=result.get("telemetry", {}),
    )


@app.post("/api/teach")
async def teach_agent(request: TeachRequest):
    result = hindsight.retain(
        BANK_ID,
        request.content,
        request.type,
        group_id=request.group_id,
        provenance_raw=request.provenance_raw or request.content,
        valid_from=request.valid_from,
        valid_until=request.valid_until,
    )
    return {"status": "success", "id": result["id"]}


@app.get("/api/memory_inspector")
async def get_memory():
    if BANK_ID not in hindsight.banks:
        return {"error": "Bank not initialized"}
    bank = hindsight.banks[BANK_ID]
    return {
        "memories": bank["memories"],
        "bank_config": {
            "mission": bank["mission"],
            "directives": bank["directives"],
            "disposition": bank["disposition"],
        },
    }


@app.get("/api/constellation")
async def get_constellation(fired: Optional[str] = None):
    """
    Returns the full constellation graph for the React force-graph.
    Pass ?fired=mem_abc,mem_def to highlight the nodes that fired in the last recall.
    """
    fired_ids = fired.split(",") if fired else []
    graph = hindsight.get_constellation_graph(BANK_ID, fired_ids)
    return graph


@app.get("/api/reflection_log")
async def get_reflection_log():
    """Returns synthesized mental model insights for the toast notifications."""
    return {"log": hindsight.get_reflection_log(BANK_ID)}


@app.get("/api/memory_timeline")
async def get_memory_timeline(as_of_days_ago: int = 0):
    """
    Bi-temporal time-travel endpoint.
    Returns only memories that were valid at the given point in time.
    as_of_days_ago=0 → now,  as_of_days_ago=30 → 30 days ago
    """
    if BANK_ID not in hindsight.banks:
        return {"error": "Bank not initialized"}
    as_of = (datetime.datetime.utcnow() - datetime.timedelta(days=as_of_days_ago)).isoformat()
    memories = [
        m for m in hindsight.banks[BANK_ID]["memories"]
        if m.get("valid_from", "") <= as_of
        and (m.get("valid_until") is None or m["valid_until"] > as_of)
    ]
    return {"memories": memories, "as_of": as_of, "days_ago": as_of_days_ago}


@app.get("/api/isolation_test")
async def isolation_test(query: str = "rebate discount confidential", group_id: str = "default"):
    """
    Multi-tenant isolation demo: runs same query against different group_id scopes
    and proves that Project B data never leaks into Project A.
    """
    result_a = hindsight.recall(BANK_ID, query, group_id="default")
    result_b = hindsight.recall(BANK_ID, query, group_id="project_b")
    return {
        "project_a_hits": result_a["hits"],
        "project_b_hits": result_b["hits"],
        "isolation_proven": not any(
            m.get("group_id") == "project_b" for m in result_a["hits"]
        ),
        "telemetry": result_a["telemetry"],
    }


@app.post("/api/mark_stale")
async def mark_stale(request: StaleRequest):
    success = hindsight.mark_stale(BANK_ID, request.memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "success"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
