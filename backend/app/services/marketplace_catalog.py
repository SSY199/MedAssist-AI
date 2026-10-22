"""Reviewed factual metadata only; no scraping, clinical advice or live offers."""
import json
from datetime import date
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Seller(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    url: str

    @field_validator("url")
    @classmethod
    def trusted_url(cls, value: str) -> str:
        url = urlsplit(value)
        if (url.scheme != "https" or url.hostname not in
                {"www.1mg.com", "www.apollopharmacy.in"} or url.username
                or url.password or url.port not in (None, 443)
                or url.query or url.fragment):
            raise ValueError("Catalog links must use reviewed HTTPS destinations")
        return value


class Source(Seller):
    checked_on: date


class ReferencePrice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_minor: int = Field(strict=True, gt=0)
    currency: Literal["INR"]
    kind: Literal["MRP"]


class Product(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[a-z0-9-]{1,80}$")
    name: str
    kind: Literal["medicine", "health_supply"]
    category: str
    composition: str | None
    form: str
    pack: str
    prescription: Literal["required", "not_required", "unknown", "not_applicable"]
    aliases: list[str]
    source: Source
    reference_price: ReferencePrice | None
    sellers: list[Seller] = Field(min_length=1)

    @model_validator(mode="after")
    def medicine_status(self):
        if self.kind == "medicine" and self.prescription == "not_applicable":
            raise ValueError("Medicines require reviewed or unknown prescription status")
        return self


PRODUCTS = tuple(Product.model_validate(row) for row in json.loads(
    (Path(__file__).resolve().parents[1] / "data" / "marketplace.json").read_text()
))
BY_ID = {product.id: product for product in PRODUCTS}
if len(BY_ID) != len(PRODUCTS):
    raise ValueError("Catalog IDs must be unique")
CATEGORIES = sorted({product.category for product in PRODUCTS})


def matches(product: Product, query: str, category: str | None,
            kind: str | None, prescription: str | None) -> bool:
    # Literal, case-insensitive terms; user input never becomes a Mongo regex.
    haystack = " ".join([product.name, product.composition or "", product.category,
                         product.form, product.pack, *product.aliases]).casefold()
    return (all(term in haystack for term in query.casefold().split())
            and (category is None or product.category == category)
            and (kind is None or product.kind == kind)
            and (prescription is None or product.prescription == prescription))
