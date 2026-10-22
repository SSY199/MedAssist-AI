"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Heart,
  Package,
  Pill,
  Search,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  prescriptionLabels,
  referencePrice,
  trustedSellerUrl,
  type CatalogResponse,
  type FavoritesResponse,
  type Product,
} from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const control =
  "h-10 rounded-lg border border-panel-border bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-trace";
const outline = "border-panel-border bg-bg-deep text-ink hover:bg-white/5";
const PAGE_SIZE = 12;

function SourceLink({ product }: { product: Product }) {
  const url = trustedSellerUrl(product.source.url);
  return (
    <p className="text-xs text-ink-dim">
      Source:{" "}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-trace underline underline-offset-4"
        >
          {product.source.name} ↗
        </a>
      ) : (
        product.source.name
      )}
      {" · Checked "}
      {product.source.checked_on}
    </p>
  );
}

function Price({ product }: { product: Product }) {
  return (
    <div className="space-y-2">
      {product.reference_price && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
          Reference MRP · {product.pack}
        </p>
      )}
      <p
        className={
          product.reference_price
            ? "font-display text-2xl font-bold text-ink"
            : "text-sm text-ink-muted"
        }
      >
        {referencePrice(product)}
      </p>
      <SourceLink product={product} />
    </div>
  );
}

export default function Marketplace() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [category, setCategory] = useState("");
  const [prescription, setPrescription] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [favorites, setFavorites] = useState<FavoritesResponse | null>(null);
  const [favoriteError, setFavoriteError] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const busy = useRef(new Set<string>());
  const [selected, setSelected] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let ignore = false;
    apiFetch("/marketplace/favorites")
      .then((data: FavoritesResponse) => {
        if (!ignore) {
          setFavorites(data);
          setFavoriteError("");
        }
      })
      .catch(() => {
        if (!ignore)
          setFavoriteError(
            "Saved medicines could not be loaded. Retry to enable saving.",
          );
      });
    return () => {
      ignore = true;
    };
  }, [revision]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setCatalogError(false);
      // Fetch every matching page for the favourites view; the catalog is small
      // today, but saved products must not disappear as curated coverage grows.
      const params = new URLSearchParams({
        q: query,
        offset: String(savedOnly ? 0 : offset),
        limit: String(savedOnly ? 100 : PAGE_SIZE),
      });
      if (kind) params.set("kind", kind);
      if (category) params.set("category", category);
      if (prescription) params.set("prescription", prescription);
      async function load() {
        const first: CatalogResponse = await apiFetch(
          `/marketplace/products?${params}`,
          { signal: controller.signal },
        );
        if (savedOnly) {
          for (
            let start = first.products.length;
            start < first.total;
            start += 100
          ) {
            params.set("offset", String(start));
            const page: CatalogResponse = await apiFetch(
              `/marketplace/products?${params}`,
              { signal: controller.signal },
            );
            first.products.push(...page.products);
          }
        }
        if (!ignore) setCatalog(first);
      }
      load()
        .catch(() => {
          if (!ignore) setCatalogError(true);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 250);
    return () => {
      ignore = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind, category, prescription, offset, savedOnly, revision]);

  async function toggleFavorite(product: Product) {
    if (!favorites || busy.current.has(product.id)) return;
    const saved = favorites.product_ids.includes(product.id);
    busy.current.add(product.id);
    setPending(new Set(busy.current));
    setNotice("");
    try {
      await apiFetch(
        `/marketplace/favorites/${encodeURIComponent(product.id)}`,
        { method: saved ? "DELETE" : "PUT" },
      );
      setFavorites(
        (current) =>
          current && {
            ...current,
            product_ids: saved
              ? current.product_ids.filter((id) => id !== product.id)
              : [...new Set([...current.product_ids, product.id])],
          },
      );
      setNotice(
        `${product.name} ${saved ? "removed from" : "saved to"} favourites.`,
      );
    } catch {
      // A response may be lost after a committed write. Re-read on retry rather
      // than assuming success or silently changing the saved state.
      setFavoriteError(
        "Could not confirm the saved state. Retry to refresh before changing favourites.",
      );
      setFavorites(null);
    } finally {
      busy.current.delete(product.id);
      setPending(new Set(busy.current));
    }
  }

  function saveButton(product: Product) {
    const saved = favorites?.product_ids.includes(product.id) ?? false;
    return (
      <Button
        variant="outline"
        className={outline}
        size="icon"
        disabled={!favorites || pending.has(product.id)}
        aria-pressed={saved}
        aria-label={`${saved ? "Unsave" : "Save"} ${product.name}`}
        onClick={() => toggleFavorite(product)}
      >
        <Heart
          size={17}
          className={saved ? "fill-trace text-trace" : "text-ink-muted"}
        />
      </Button>
    );
  }

  function resetFilters() {
    setQuery("");
    setKind("");
    setCategory("");
    setPrescription("");
    setOffset(0);
  }
  const visible =
    catalog?.products.filter(
      (product) => !savedOnly || favorites?.product_ids.includes(product.id),
    ) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 pb-12 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-trace">
            <ShoppingBag size={14} /> Your medicine shelf
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Find it. Save it. Visit the seller.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Browse medicines and health supplies, keep your essentials close,
            and check current prices with the retailer.
          </p>
        </div>
        <span className="rounded-full border border-panel-border px-3 py-2 font-mono text-xs text-ink-dim">
          Curated India catalog · INR
        </span>
      </header>
      <div className="flex gap-3 rounded-xl border border-panel-border bg-panel p-4 text-xs leading-relaxed text-ink-muted">
        <ShieldCheck size={20} className="shrink-0 text-trace" />
        <p>
          Product information, not medical advice. Use medicines only as advised
          by your clinician. Reference MRPs are sourced snapshots, not live
          offers; batches, prices and availability may change. Sellers handle
          prescriptions and purchases. MedAssist does not dispense medicines.
        </p>
      </div>
      <section aria-label="Search and filters" className="space-y-4">
        <div className="flex gap-2" aria-label="Catalog views">
          <Button
            variant="outline"
            className={
              savedOnly ? outline : `${outline} border-trace text-trace`
            }
            aria-pressed={!savedOnly}
            onClick={() => {
              setSavedOnly(false);
              setOffset(0);
            }}
          >
            All products
          </Button>
          <Button
            variant="outline"
            className={
              savedOnly ? `${outline} border-trace text-trace` : outline
            }
            aria-pressed={savedOnly}
            onClick={() => {
              setSavedOnly(true);
              setOffset(0);
            }}
          >
            <Bookmark size={14} /> Favourites{" "}
            {favorites ? `(${favorites.product_ids.length})` : ""}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search size={16} className="absolute top-3 left-3 text-ink-dim" />
            <Input
              aria-label="Search medicines and supplies"
              placeholder="Search name or ingredient…"
              maxLength={120}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOffset(0);
              }}
              className={`${control} pl-10`}
            />
          </div>
          <select
            aria-label="Product type"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setOffset(0);
            }}
            className={control}
          >
            <option value="">All product types</option>
            <option value="medicine">Medicines</option>
            <option value="health_supply">Health supplies</option>
          </select>
          <select
            aria-label="Category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setOffset(0);
            }}
            className={control}
          >
            <option value="">All categories</option>
            {catalog?.categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Prescription status"
            value={prescription}
            onChange={(event) => {
              setPrescription(event.target.value);
              setOffset(0);
            }}
            className={control}
          >
            <option value="">All prescription statuses</option>
            <option value="required">Prescription required</option>
            <option value="unknown">Status unverified</option>
            <option value="not_applicable">Device / supply</option>
          </select>
        </div>
      </section>
      <div role="status" aria-live="polite" className="text-sm text-trace">
        {notice}
      </div>
      {favoriteError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-panel-border bg-panel p-4 text-sm text-ink-muted"
        >
          {favoriteError}
          <Button
            variant="outline"
            className={outline}
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry saved medicines
          </Button>
        </div>
      )}
      {!!favorites?.unavailable_ids.length && savedOnly && (
        <p className="text-sm text-ink-muted">
          {favorites.unavailable_ids.length} saved product(s) are no longer in
          the reviewed catalog. They have not been replaced with another
          medicine.
        </p>
      )}
      {catalogError ? (
        <div
          role="alert"
          className="rounded-xl border border-panel-border p-8 text-center"
        >
          <p className="mb-4 text-ink-muted">
            The catalog could not be loaded. Check that the backend is running.
          </p>
          <Button
            variant="outline"
            className={outline}
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry catalog
          </Button>
        </div>
      ) : loading || (savedOnly && !favorites && !favoriteError) ? (
        <p role="status" className="py-12 text-center text-ink-muted">
          Loading your medicine shelf…
        </p>
      ) : savedOnly && !favorites ? (
        <p className="py-12 text-center text-ink-muted">
          Retry saved medicines to view your favourites.
        </p>
      ) : (
        <>
          <p className="font-mono text-xs text-ink-dim">
            {savedOnly
              ? `${visible.length} matching favourites`
              : `${catalog?.total ?? 0} curated product${catalog?.total === 1 ? "" : "s"}`}{" "}
            · Search is manual; your health profile is not used.
          </p>
          {!visible.length ? (
            <div className="rounded-xl border border-dashed border-panel-border px-6 py-14 text-center">
              <Package size={28} className="mx-auto mb-4 text-ink-dim" />
              <h2 className="font-display text-lg text-ink">
                {savedOnly
                  ? "No matching favourites yet"
                  : "No matching products"}
              </h2>
              <p className="my-3 text-sm text-ink-muted">
                {savedOnly
                  ? "Save products using the heart button, or clear your filters."
                  : "This is a small curated catalog. Try another name or ingredient, or clear your filters."}
              </p>
              <Button
                variant="outline"
                className={outline}
                onClick={resetFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((product) => (
                <article
                  key={product.id}
                  className="flex flex-col rounded-2xl border border-panel-border bg-panel p-5 transition-colors hover:border-trace/40"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl border border-panel-border bg-bg-deep text-trace">
                      {product.kind === "medicine" ? (
                        <Pill size={22} />
                      ) : (
                        <Package size={22} />
                      )}
                    </div>
                    {saveButton(product)}
                  </div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-trace">
                    {product.category}
                  </p>
                  <button
                    onClick={() => setSelected(product)}
                    className="text-left font-display text-lg font-bold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-trace"
                  >
                    {product.name}
                  </button>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {product.composition ?? product.form} · {product.pack}
                  </p>
                  <p className="mt-3 text-xs text-ink-dim">
                    {prescriptionLabels[product.prescription]}
                  </p>
                  <div className="mt-auto space-y-4 pt-6">
                    <Price product={product} />
                    <Button
                      variant="outline"
                      className={`${outline} w-full`}
                      onClick={() => setSelected(product)}
                    >
                      Details & seller <ArrowUpRight size={14} />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!savedOnly && (catalog?.total ?? 0) > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                className={outline}
                disabled={offset === 0}
                onClick={() =>
                  setOffset((value) => Math.max(0, value - PAGE_SIZE))
                }
              >
                Previous
              </Button>
              <span className="text-sm text-ink-muted">
                Page {Math.floor(offset / PAGE_SIZE) + 1}
              </span>
              <Button
                variant="outline"
                className={outline}
                disabled={offset + PAGE_SIZE >= (catalog?.total ?? 0)}
                onClick={() => setOffset((value) => value + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="center"
          className="max-h-[90dvh] max-w-xl overflow-y-auto rounded-2xl border-panel-border bg-panel p-3 text-ink"
        >
          <SheetHeader>
            <SheetTitle className="pr-8 font-display text-xl text-ink">
              {selected?.name ?? "Product details"}
            </SheetTitle>
            <SheetDescription className="mt-2 text-ink-muted">
              Check the exact strength, form and pack before visiting the
              seller.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="space-y-6 px-4 pb-5">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Category", selected.category],
                  ["Form", selected.form],
                  ["Pack", selected.pack],
                  ["Prescription", prescriptionLabels[selected.prescription]],
                  ["Composition / strength", selected.composition],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="mb-1 text-xs text-ink-dim">{label}</dt>
                      <dd className="text-ink">{value}</dd>
                    </div>
                  ))}
              </dl>
              <div className="rounded-xl border border-panel-border bg-bg-deep p-4">
                <Price product={selected} />
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                  Reference MRP may vary by batch. Confirm the current selling
                  price, prescription requirements, pack and availability with
                  the seller.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {saveButton(selected)}
                <span className="text-sm text-ink-muted">
                  Save to your account for another visit
                </span>
              </div>
              {notice && (
                <p role="status" className="text-sm text-trace">
                  {notice}
                </p>
              )}
              {favoriteError && (
                <div role="alert" className="space-y-3 text-sm text-ink-muted">
                  <p>{favoriteError}</p>
                  <Button
                    variant="outline"
                    className={outline}
                    disabled={pending.size > 0}
                    onClick={() => setRevision((value) => value + 1)}
                  >
                    Retry saved medicines
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {selected.sellers.map((seller) => {
                  const url = trustedSellerUrl(seller.url);
                  return url ? (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg bg-trace px-4 py-3 text-sm font-semibold text-bg-deep hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trace"
                    >
                      View product on {seller.name}
                      <ArrowUpRight size={16} />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null;
                })}
                <p className="text-xs leading-relaxed text-ink-dim">
                  You are leaving MedAssist. No partnership or stock guarantee
                  is implied. The seller manages any prescription verification,
                  payment and delivery.
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
