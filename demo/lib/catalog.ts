/**
 * Artificial 1.2 s server delay so the RSC navigation is visible to the eye.
 */
export async function delay(mode: "plain" | "synced"): Promise<string> {
  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return `${mode} render took ${Date.now() - started} ms`;
}

export const PRODUCTS = [
  { id: 1, title: "Book: Modern React", category: "books" },
  { id: 2, title: "Book: RSC in Practice", category: "books" },
  { id: 3, title: "Video: Server Components Deep Dive", category: "videos" },
  { id: 4, title: "Video: Streaming SSR", category: "videos" },
  { id: 5, title: "Course: App Router Fundamentals", category: "courses" },
];

export function filterProducts(search: string, category: string) {
  return PRODUCTS.filter(
    (product) =>
      (category === "all" || product.category === category) &&
      product.title.toLowerCase().includes(search.toLowerCase()),
  );
}
