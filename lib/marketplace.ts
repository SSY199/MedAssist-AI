export type Product = {
  id: string;
  name: string;
  kind: "medicine" | "health_supply";
  category: string;
  composition: string | null;
  form: string;
  pack: string;
  prescription: "required" | "not_required" | "unknown" | "not_applicable";
  aliases: string[];
  source: { name: string; url: string; checked_on: string };
  reference_price: {
    amount_minor: number;
    currency: "INR";
    kind: "MRP";
  } | null;
  sellers: { name: string; url: string }[];
};

export type CatalogResponse = {
  products: Product[];
  total: number;
  categories: string[];
};
export type FavoritesResponse = {
  product_ids: string[];
  unavailable_ids: string[];
};

export function trustedSellerUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["www.1mg.com", "www.apollopharmacy.in"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function referencePrice(product: Product): string {
  const price = product.reference_price;
  return price
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: price.currency,
      }).format(price.amount_minor / 100)
    : "Check current price on seller";
}

export const prescriptionLabels: Record<Product["prescription"], string> = {
  required: "Prescription required",
  not_required: "No prescription listed by source",
  unknown: "Prescription status unverified",
  not_applicable: "Health device / supply",
};
