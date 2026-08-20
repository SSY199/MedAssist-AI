"""
Seeds ChromaDB with placeholder general-health content.

IMPORTANT: this is NOT verified clinical literature or sourced medical
guidelines — it's a small set of generic, self-written informational text,
here only to prove the RAG pipeline (embed -> store -> retrieve -> generate)
works end to end. Sourcing real, verified medical content is a separate,
later task before this app is used for anything beyond development.

Run once from the backend/ directory:
    uv run python -m ingestion.load_medical_kb
"""

from app.core.vector_store import get_collection

SEED_DOCS = [
    {
        "id": "fever-general",
        "text": (
            "A mild fever (under 38.5°C / 101.3°F) in an otherwise healthy "
            "adult is often the body's normal response to a minor infection. "
            "Rest, fluids, and monitoring are usually reasonable first steps. "
            "Seek care if fever exceeds 39.4°C (103°F), lasts more than three "
            "days, or is accompanied by severe headache, stiff neck, "
            "confusion, or difficulty breathing."
        ),
    },
    {
        "id": "hydration-general",
        "text": (
            "Adequate hydration supports recovery from common illnesses like "
            "colds and mild gastrointestinal upset. Signs of dehydration "
            "include dark urine, dizziness, and dry mouth. Persistent "
            "vomiting or inability to keep fluids down for over 24 hours "
            "warrants medical attention, especially in children or older "
            "adults."
        ),
    },
    {
        "id": "type2-diabetes-lifestyle",
        "text": (
            "For people managing Type 2 Diabetes, consistent meal timing, "
            "regular physical activity, and monitoring blood glucose as "
            "advised by a doctor are common lifestyle components. Symptoms "
            "of very high or very low blood sugar (confusion, extreme "
            "thirst, shakiness, sweating) should be treated as urgent."
        ),
    },
    {
        "id": "hypertension-lifestyle",
        "text": (
            "Hypertension management commonly involves reducing sodium "
            "intake, regular exercise, limiting alcohol, and taking "
            "prescribed medication consistently. A sudden severe headache, "
            "vision changes, or chest pain alongside high blood pressure "
            "readings should be treated as a potential emergency."
        ),
    },
    {
        "id": "medication-safety-general",
        "text": (
            "Always check with a pharmacist or doctor before combining "
            "new medications, including over-the-counter drugs, with "
            "existing prescriptions. Known allergies should be disclosed "
            "before starting any new medication."
        ),
    },
    {
        "id": "when-to-seek-emergency-care",
        "text": (
            "Certain symptoms warrant immediate emergency care rather than "
            "routine advice: chest pain or pressure, difficulty breathing, "
            "sudden severe headache, sudden confusion or slurred speech, "
            "severe uncontrolled bleeding, or loss of consciousness."
        ),
    },
]


def main():
    collection = get_collection()
    collection.add(
        ids=[doc["id"] for doc in SEED_DOCS],
        documents=[doc["text"] for doc in SEED_DOCS],
    )
    print(f"Loaded {len(SEED_DOCS)} documents into the '{collection.name}' collection.")


if __name__ == "__main__":
    main()