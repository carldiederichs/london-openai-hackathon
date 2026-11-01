// @ts-expect-error Build-time module containing the complete client and artwork.
import assets from "site-assets";
import { gameApi, type Env } from "./game";
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/")) return gameApi(request, env);
    const asset =
      assets[path === "/" ? "/index.html" : path] ??
      (!path.split("/").pop()?.includes(".")
        ? assets["/index.html"]
        : undefined);
    if (!asset) return new Response("Not found", { status: 404 });
    return new Response(
      Uint8Array.from(atob(asset.base64), (c: string) => c.charCodeAt(0)),
      {
        headers: {
          "Content-Type": asset.mime,
          "Cache-Control": path.startsWith("/assets/")
            ? "public,max-age=31536000,immutable"
            : "public,max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  },
};
