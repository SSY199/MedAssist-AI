"""Synthetic account tests; no Mongo writes or external seller requests."""
import copy
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.routers import marketplace
from app.services.marketplace_catalog import PRODUCTS, Product, Seller


class MemoryFavorites:
    def __init__(self):
        self.docs = {}

    async def update_one(self, query, update, upsert=False):
        self.docs.setdefault(query["_id"], {"_id": query["_id"], **copy.deepcopy(update["$setOnInsert"])})

    async def delete_one(self, query):
        doc = self.docs.get(query["_id"])
        if doc and doc["userId"] == query["userId"]:
            del self.docs[query["_id"]]

    def find(self, query, projection):
        rows = [{"productId": d["productId"]} for d in self.docs.values() if d["userId"] == query["userId"]]
        class Cursor:
            async def to_list(self, length):
                return rows
        return Cursor()


class MarketplaceTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(marketplace.router)
        self.user = {"sub": "synthetic-a"}
        self.app.dependency_overrides[marketplace.get_current_user] = lambda: self.user
        self.collection = MemoryFavorites()
        self.patch = patch.object(marketplace, "db", {"marketplaceFavorites": self.collection})
        self.patch.start()
        self.client = TestClient(self.app)
        self.id = PRODUCTS[0].id

    def tearDown(self):
        self.client.close()
        self.patch.stop()

    def test_all_routes_require_auth(self):
        self.app.dependency_overrides.clear()
        for method, path in [("GET", "/products"), ("GET", f"/products/{self.id}"), ("GET", "/favorites"), ("PUT", f"/favorites/{self.id}"), ("DELETE", f"/favorites/{self.id}")]:
            self.assertIn(self.client.request(method, "/marketplace" + path).status_code, (401, 403))

    def test_literal_search_and_alias(self):
        self.assertEqual(self.client.get('/marketplace/products', params={"q": "acetaminophen"}).json()["products"][0]["id"], self.id)
        for text in [".*", "[$ne]", "not-a-catalog-medicine"]:
            self.assertEqual(self.client.get('/marketplace/products', params={"q": text}).json()["total"], 0)

    def test_filters_pagination_and_validation(self):
        data = self.client.get('/marketplace/products', params={"kind": "health_supply", "limit": 1}).json()
        self.assertEqual(len(data["products"]), 1)
        self.assertTrue(all(p["kind"] == "health_supply" for p in data["products"]))
        next_data = self.client.get('/marketplace/products', params={"kind": "health_supply", "limit": 1, "offset": 1}).json()
        self.assertNotEqual(data["products"][0]["id"], next_data["products"][0]["id"])
        for params in [{"q": "x" * 121}, {"limit": 101}, {"limit": 0}, {"offset": -1}, {"kind": "bad"}, {"category": "bad"}, {"prescription": "bad"}]:
            self.assertEqual(self.client.get('/marketplace/products', params=params).status_code, 422)
        rx = self.client.get('/marketplace/products?prescription=required').json()
        self.assertTrue(rx["products"])
        self.assertTrue(all(p["prescription"] == "required" for p in rx["products"]))

    def test_unknown_product_cannot_be_saved(self):
        self.assertEqual(self.client.get('/marketplace/products/unknown').status_code, 404)
        self.assertEqual(self.client.put('/marketplace/favorites/unknown').status_code, 404)
        self.assertFalse(self.collection.docs)

    def test_idempotent_account_owned_favorites(self):
        for _ in range(2):
            self.assertEqual(self.client.put(f'/marketplace/favorites/{self.id}').status_code, 200)
        self.assertEqual(len(self.collection.docs), 1)
        self.assertEqual(self.client.get('/marketplace/favorites').json()["product_ids"], [self.id])
        self.user = {"sub": "synthetic-b"}
        self.assertEqual(self.client.get('/marketplace/favorites').json()["product_ids"], [])
        self.client.delete(f'/marketplace/favorites/{self.id}')
        self.assertEqual(len(self.collection.docs), 1)
        self.client.put(f'/marketplace/favorites/{self.id}')
        self.assertEqual(len(self.collection.docs), 2)
        self.user = {"sub": "synthetic-a"}
        for _ in range(2):
            self.client.delete(f'/marketplace/favorites/{self.id}')
        self.assertEqual(self.client.get('/marketplace/favorites').json()["product_ids"], [])
        self.user = {"sub": "synthetic-b"}
        self.assertEqual(self.client.get('/marketplace/favorites').json()["product_ids"], [self.id])

    def test_missing_identity_rejected(self):
        self.user = {}
        self.assertEqual(self.client.get('/marketplace/products').status_code, 401)
        self.assertEqual(self.client.put(f'/marketplace/favorites/{self.id}').status_code, 401)

    def test_retired_product_visible_as_unavailable_and_removable(self):
        key = marketplace.favorite_key(self.user["sub"], "retired")
        self.collection.docs[key] = {"userId": self.user["sub"], "productId": "retired"}
        self.assertEqual(self.client.get('/marketplace/favorites').json()["unavailable_ids"], ["retired"])
        self.client.delete('/marketplace/favorites/retired')
        self.assertFalse(self.collection.docs)

    def test_write_failure_is_not_success(self):
        with patch.object(self.collection, "update_one", side_effect=RuntimeError("synthetic failure")):
            with TestClient(self.app, raise_server_exceptions=False) as client:
                self.assertEqual(client.put(f'/marketplace/favorites/{self.id}').status_code, 500)

    def test_catalog_provenance_and_price_contract(self):
        for product in PRODUCTS:
            data = self.client.get(f'/marketplace/products/{product.id}').json()
            self.assertEqual(data["pack"], product.pack)
            self.assertTrue(data["source"]["checked_on"])
            self.assertTrue(data["sellers"])
            if product.reference_price:
                self.assertGreater(data["reference_price"]["amount_minor"], 0)
                self.assertEqual(data["reference_price"]["kind"], "MRP")
        invalid = PRODUCTS[0].model_dump()
        invalid["reference_price"]["amount_minor"] = 32.28
        with self.assertRaises(ValidationError):
            Product.model_validate(invalid)

    def test_untrusted_links_rejected(self):
        for url in ["javascript:alert(1)", "https://www.1mg.com.evil.test/x", "http://www.1mg.com/x", "https://user@www.1mg.com/x", "https://www.1mg.com/x?token=secret", "https://www.1mg.com:8080/x"]:
            with self.assertRaises(ValidationError):
                Seller(name="test", url=url)
