/** Demo config: transpile the workspace-linked library and keep the build light. */
const nextConfig = {
  transpilePackages: ["rsc-state-sync"],
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
