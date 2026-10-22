"""Authenticated catalog discovery and minimal, account-owned favourites."""
import hashlib
import json
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app.core.db import db
from app.core.security import get_current_user
from app.services.marketplace_catalog import BY_ID, CATEGORIES, PRODUCTS, Product, matches

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class CatalogResponse(BaseModel):
    products: list[Product]
    total: int
    categories: list[str]


class FavoritesResponse(BaseModel):
    product_ids: list[str]
    unavailable_ids: list[str]


def identity(user: dict) -> str:
    sub = user.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(401, "Missing account identity")
    return sub


def favorite_key(user_id: str, product_id: str) -> str:
    # Deterministic unique _id uses Mongo's existing primary-key uniqueness.
    return hashlib.sha256(json.dumps([user_id, product_id]).encode()).hexdigest()


def known_product(product_id: str) -> Product:
    product = BY_ID.get(product_id)
    if product is None:
        raise HTTPException(404, "Product is not in the current catalog")
    return product


@router.get("/products", response_model=CatalogResponse)
async def products(
    q: str = Query("", max_length=120),
    category: str | None = Query(None, max_length=80),
    kind: Literal["medicine", "health_supply"] | None = None,
    prescription: Literal["required", "not_required", "unknown", "not_applicable"] | None = None,
    offset: int = Query(0, ge=0, le=10000),
    limit: int = Query(24, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    identity(user)
    if category is not None and category not in CATEGORIES:
        raise HTTPException(422, "Unknown catalog category")
    found = [p for p in PRODUCTS if matches(p, q, category, kind, prescription)]
    return {"products": found[offset:offset + limit], "total": len(found),
            "categories": CATEGORIES}


@router.get("/products/{product_id}", response_model=Product)
async def product_detail(product_id: str, user: dict = Depends(get_current_user)):
    identity(user)
    return known_product(product_id)


@router.get("/favorites", response_model=FavoritesResponse)
async def favorites(user: dict = Depends(get_current_user)):
    user_id = identity(user)
    # At most one record per user/product; do not return stored account IDs.
    rows = await db["marketplaceFavorites"].find(
        {"userId": user_id}, {"productId": 1, "_id": 0}
    ).to_list(length=None)
    ids = {row["productId"] for row in rows}
    return {"product_ids": sorted(ids & BY_ID.keys()),
            "unavailable_ids": sorted(ids - BY_ID.keys())}


@router.put("/favorites/{product_id}")
async def save_favorite(product_id: str, user: dict = Depends(get_current_user)):
    user_id = identity(user)
    known_product(product_id)
    try:
        await db["marketplaceFavorites"].update_one(
            {"_id": favorite_key(user_id, product_id), "userId": user_id},
            {"$setOnInsert": {"userId": user_id, "productId": product_id,
                              "savedAt": datetime.now(timezone.utc)}},
            upsert=True,
        )
    except DuplicateKeyError:
        # Concurrent identical upserts may race; primary-key uniqueness wins.
        pass
    return {"product_id": product_id, "saved": True}


@router.delete("/favorites/{product_id}")
async def remove_favorite(product_id: str, user: dict = Depends(get_current_user)):
    user_id = identity(user)
    # Allow removal of retired IDs, but never another account's entry.
    await db["marketplaceFavorites"].delete_one(
        {"_id": favorite_key(user_id, product_id), "userId": user_id}
    )
    return {"product_id": product_id, "saved": False}
