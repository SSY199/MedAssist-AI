from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ehr


app = FastAPI(title="MedAssistAI API")

# Domains allowed to call this API from the browser.
# Add each new frontend URL you deploy to (Vercel preview URLs won't
# match this list — add them individually if you need to test previews).
origins = [
    "http://localhost:3000",
    "https://med-assist-ai-kohl.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ehr.router)


@app.get("/health")
def health_check():
    """Hit this to confirm the server is running: GET /health"""
    return {"status": "ok"}