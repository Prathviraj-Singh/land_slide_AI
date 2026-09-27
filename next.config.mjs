/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-leaflet is NOT compatible with React 18 Strict Mode's deliberate
  // double-effect invocation in development (mount → cleanup → remount on
  // the SAME component instance). Leaflet's MapContainer writes a
  // `_leaflet_id` property to the container DOM node on first init; when
  // Strict Mode triggers the second init on the same node before Leaflet's
  // own cleanup has run, it throws "Map container is already initialized".
  // This is a known, documented incompatibility tracked at:
  //   https://github.com/PaulLeCam/react-leaflet/issues/1052
  // Disabling Strict Mode is the authoritative fix recommended by the
  // react-leaflet maintainers. Production builds are unaffected — Strict
  // Mode only fires extra effects in development.
  reactStrictMode: false,

  serverExternalPackages: ["onnxruntime-node"],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "onnxruntime-node"];
    }
    return config;
  },
};

export default nextConfig;
