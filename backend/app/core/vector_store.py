import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings

from app.core.config import settings
from app.core.gemini_client import embed_text

COLLECTION_NAME = "medical_kb"


class GeminiEmbeddingFunction(EmbeddingFunction):
    """Wraps our Gemini embed_text() so Chroma can call it internally."""

    def __call__(self, input: Documents) -> Embeddings:
        return [embed_text(text) for text in input]


_client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
_collection = _client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=GeminiEmbeddingFunction(),
)


def get_collection():
    return _collection


def retrieve_context(query: str, k: int = 3) -> list[str]:
    """Returns the k most relevant knowledge-base chunks for a query."""
    results = _collection.query(query_texts=[query], n_results=k)
    documents = results.get("documents", [[]])
    return documents[0] if documents else []