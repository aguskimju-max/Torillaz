from dotenv import load_dotenv
from pathlib import Path
import os
load_dotenv(Path(__file__).parent / ".env")

import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from db import client
import seed
from auth_router import router as auth_router
from master_router import router as master_router
from stock_router import router as stock_router
from dashboard_router import router as dashboard_router
from production_router import router as production_router
from sales_router import router as sales_router
from finance_router import router as finance_router
from misc_router import router as misc_router
from settings_router import router as settings_router

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("erp")

app = FastAPI(title="ERP Manajemen Usaha Terpadu")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


health = APIRouter(prefix="/api")


@health.get("/")
async def root():
    return {"status": "ok", "service": "ERP Manajemen Usaha Terpadu"}


app.include_router(health)
app.include_router(auth_router)
app.include_router(master_router)
app.include_router(stock_router)
app.include_router(dashboard_router)
app.include_router(production_router)
app.include_router(sales_router)
app.include_router(finance_router)
app.include_router(misc_router)
app.include_router(settings_router)

origins = [o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await seed.run_all()
        logger.info("ERP seed complete")
    except Exception as e:
        logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
