from fastapi import APIRouter

from app.api.routes import ai, assets, auth, enterprise, field_ops, geography, governance, grid, search_routes, simulations, ws

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(geography.router)
api_router.include_router(assets.router)
api_router.include_router(grid.router)
api_router.include_router(search_routes.router)
api_router.include_router(simulations.router)
api_router.include_router(governance.router)
api_router.include_router(ai.router)
api_router.include_router(ws.router)
api_router.include_router(enterprise.router)
api_router.include_router(field_ops.router)
