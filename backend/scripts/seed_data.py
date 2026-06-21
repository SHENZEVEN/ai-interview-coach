"""Standalone script to load seed data into ChromaDB.

Usage:
    python scripts/seed_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from rag.vector_store import get_vector_store, load_seed_data, get_collection_count

def main():
    api_key = os.getenv("LLM_API_KEY", "")
    if not api_key or api_key == "your_api_key_here":
        print("[ERROR] Please set LLM_API_KEY in .env file first!")
        print("  1. Copy .env.example to .env")
        print("  2. Fill in your API key")
        sys.exit(1)

    print("[INFO] Connecting to ChromaDB...")
    vs = get_vector_store()

    count = get_collection_count(vs)
    if count > 0:
        print(f"[WARN] Collection already has {count} records. Delete chroma_data/ to reset.")

    print("[INFO] Loading seed data (this calls the embedding API)...")
    try:
        n = load_seed_data(vs)
        print(f"[OK] Successfully loaded {n} interview QA pairs")
    except Exception as e:
        print(f"[ERROR] Failed: {e}")
        print("[HINT] Make sure your LLM_API_KEY is valid and the API endpoint supports embeddings")
        sys.exit(1)

if __name__ == "__main__":
    main()
