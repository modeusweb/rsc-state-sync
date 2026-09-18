import Link from "next/link";
import ProductTools from "../components/product-tools";
import { delay, filterProducts } from "../lib/catalog";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Server Component. This page is re-rendered on every navigation, which is
 * exactly why plain `useState` inside the client filter panel is lost — and
 * why the client panels register their state with rsc-state-sync instead.
 */
export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode: "plain" | "synced" = params.mode === "plain" ? "plain" : "synced";
  await delay(mode);

  const search = typeof params.search === "string" ? params.search : "";
  const category = typeof params.category === "string" ? params.category : "all";
  const products = filterProducts(search, category);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
      <h1>Products ({mode === "plain" ? "without rsc-state-sync" : "with rsc-state-sync"})</h1>
      <p>
        Server-rendered at {new Date().toISOString()} — every navigation re-renders this
        page on the server. The filter panel, tab bar and modal below are client
        components.
      </p>
      <p>
        {mode === "plain" ? (
          <Link href="/?mode=synced">Switch to: WITH rsc-state-sync</Link>
        ) : (
          <Link href="/?mode=plain">Switch to: WITHOUT rsc-state-sync</Link>
        )}
      </p>
      <hr />
      <strong>Server result for search={JSON.stringify(search)}, category={category}:</strong>
      <ul>
        {products.map((product) => (
          <li key={product.id}>{product.title}</li>
        ))}
        {products.length === 0 && <li>No products match.</li>}
      </ul>
      <hr />
      <ProductTools mode={mode} />
    </main>
  );
}

