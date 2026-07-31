import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize(doc):
    """Convert a Mongo document into a JSON-safe dict."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


def oid(value):
    try:
        return ObjectId(value)
    except Exception:
        return None


async def get_next_code(prefix: str, width: int = 4) -> str:
    """Atomic sequential code generator, e.g. SUP-0001."""
    res = await db.counters.find_one_and_update(
        {"_id": prefix},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res["seq"]
    return f"{prefix}-{str(seq).zfill(width)}"


async def log_audit(user, action, module, entity, entity_id=None,
                    description="", before=None, after=None):
    await db.audit_logs.insert_one({
        "user_id": (user or {}).get("id"),
        "user_name": (user or {}).get("name"),
        "user_email": (user or {}).get("email"),
        "action": action,
        "module": module,
        "entity": entity,
        "entity_id": entity_id,
        "description": description,
        "before": before,
        "after": after,
        "created_at": now_iso(),
    })
