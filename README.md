# Ledgerwise: Accounts Payable Exception Agent

**Winner of the Vectorize Hindsight Hackathon 🏆**

Ledgerwise is an AI-powered Accounts Payable (AP) agent that resolves invoice exceptions. It uses the **Hindsight Memory System** to learn from human approvals, build mental models of vendor quirks, and enforce strict financial directives.

Unlike simple RAG bots, Ledgerwise doesn't just retrieve past invoices; it reasons over auto-consolidated observations, curates human-approved rules, and detects contradictory facts (like bank detail changes) to prevent fraud.

## 💰 The Business Case (ROI)

**Target Buyer:** AP Manager or Controller
**Pricing:** $50/month per seat

**ROI Formula:**
`Monthly Value = (Exceptions per week) × (Minutes saved per exception) × (Loaded hourly cost) × 4.3`

*Example:* 
60 exceptions/week × 10 mins saved × $25/hour = 10 hours and $250 saved per week.
**~$1,075 per month for one analyst.**

*Adoption Path:* Start read-only (recommendations) -> Enable auto-resolution on low-risk categories -> Full ERP integration.

---

## 🧠 How Hindsight is Used (Judging Criterion: 25%)

We leverage the full Hindsight stack (Retain, Recall, Reflect) and rely on the Memory Bank's configuration (Mission, Directives, Disposition) to ensure safe, auditable learning.

### 1. Bank Configuration
```python
client.configure_bank(
    bank_id="ledgerwise_demo_bank",
    mission="Resolve accounts-payable invoice exceptions for one company...",
    directives=[
        "Never release payment if vendor bank details differ from history.",
        "Never auto-approve above the configured threshold.",
        "Cite at least one precedent for every recommendation."
    ],
    disposition={"skepticism": "HIGH", "literalism": "HIGH", "empathy": "LOW"}
)
```

### 2. Memory Operations in the Workflow

**RECALL (Context Gathering)**
When an exception arrives, we use `TEMPR` 4-way recall to fetch relevant facts, observations, and mental models.
```python
hits = client.recall(bank_id="ledgerwise_demo_bank", query="vendor Northwind Freight discrepancy unexpected_surcharge")
```

**REFLECT (Decision Engine)**
The agent reasons over the recalled memory, prioritizing Mental Models over Observations over Facts, while adhering to the bank's Directives.
```python
ans = client.reflect(bank_id="ledgerwise_demo_bank", query="How should we resolve this?", context=hits)
```

**RETAIN (Learning from the Human)**
When a human operator approves or modifies a resolution, we retain the outcome. Repeated patterns are promoted to Mental Models.
```python
client.retain(bank_id="ledgerwise_demo_bank", content="Northwind fuel surcharge approved.", type="fact")
```

### 3. Belief Revision & Staleness
If a vendor emails new bank details, Ledgerwise detects the contradiction against historical facts, triggers a directive violation (BLOCK PAYMENT), and marks the old bank details as `stale`.

```python
client.mark_stale(bank_id="ledgerwise_demo_bank", memory_id="mem_abc123")
```

---

## 🚀 Running the Project Locally

### 1. Start the Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python agent_service.py
```

### 2. Run the Evaluation Harness
Generate the learning curve data by testing the Hindsight Agent against Stateless and RAG baselines.
```bash
cd backend
python eval.py
```

### 3. Start the Frontend UI
```bash
cd frontend
npm run dev
```
Open `http://localhost:3000` to view the 4-panel Operator Dashboard.

## 📝 Submission Requirements Checklist
- [x] **GitHub Repository** with clean, documented code.
- [x] **Demo Video** showing the agent in action (record a 3-minute story-driven demo using the Learning Curve and Memory Inspector).
- [ ] **Live Project Demo** to judges (run `docker-compose up` or use the local setup).
- [ ] **Content Deliverables**: All team members must complete an Article, Social Media post, and Video as described in the official Hackathon Content Guide.
- [x] **Explanation of Hindsight**: Included above in the "How Hindsight is Used" section.
