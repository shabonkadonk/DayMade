import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // An isolated cache lets QA run beside an existing developer-owned server.
  distDir: process.env.DAYMADE_VERIFY === "1" ? ".next-verify" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // Let Next serve client chunks to the phone/tablet on the development LAN.
  // Override this when the host's LAN address changes.
  allowedDevOrigins: [process.env.DAYMADE_DEV_ORIGIN ?? "10.141.29.126"],
};
export default nextConfig;
