import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  async redirects() {
    // The platform admin used to live at /super. Old owner-panel URLs under
    // /admin are NOT redirected: that path now means the platform admin, and
    // the role check sends non-admins to /studio.
    return [{ source: "/super/:path*", destination: "/admin/:path*", permanent: true }];
  },
};

export default nextConfig;
