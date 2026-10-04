from fastapi import APIRouter

from api.routes import auth, cases, documents, intelligence, platform, workflow

api_router = APIRouter()
for module in (auth, cases, documents, intelligence, workflow, platform):
    api_router.include_router(module.router)
