import requests
import json
import itertools

API_URL = "http://localhost:8000/api/triage"

VENDORS = ["Northwind Freight", "Globex Corp", "Acme Supplies", "Stark Industries", "Wayne Enterprises"]
DISCREPANCIES = ["price_variance", "missing_po", "tax_mismatch", "bank_detail_change", "unexpected_surcharge"]

def test_all_cases():
    print("Testing all possible combinations of vendors and discrepancies...\n")
    
    cases = []
    case_id = 1
    
    # Generate all combinations
    for vendor, discrepancy in itertools.product(VENDORS, DISCREPANCIES):
        details = f"Detected {discrepancy.replace('_', ' ')}."
        
        # Add a bit of context for specific discrepancies to make them realistic
        if discrepancy == "bank_detail_change":
            details = "Vendor emailed new bank details: Route 098765432, Acct 123456789."
        elif discrepancy == "unexpected_surcharge":
            details = "Invoice includes an unexpected fuel surcharge of $45."
            
        case = {
            "id": f"INV-TEST-{case_id}",
            "vendor_name": vendor,
            "discrepancy_type": discrepancy,
            "details": details,
            "amount": 1000.00
        }
        cases.append(case)
        case_id += 1

    # Send each case to the backend
    for case in cases:
        print(f"--- Testing Case: {case['id']} ---")
        print(f"Vendor: {case['vendor_name']}")
        print(f"Discrepancy: {case['discrepancy_type']}")
        
        try:
            response = requests.post(API_URL, json=case)
            if response.status_code == 200:
                result = response.json()
                print(f"Safe: {result.get('is_safe')}")
                print(f"Recommendation: {result.get('recommendation')}")
                print(f"Memory Hits: {len(result.get('memory_context', []))}")
            else:
                print(f"Error: HTTP {response.status_code}")
        except Exception as e:
            print(f"Failed to connect: {e}")
            
        print("-" * 40 + "\n")

if __name__ == "__main__":
    test_all_cases()
