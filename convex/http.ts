import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { upload, download, preflight } from "./photos";
const http = httpRouter();
auth.addHttpRoutes(http);
for (const path of ["/customer-photo", "/admin-photo"])
  http.route({ path, method: "OPTIONS", handler: preflight });
http.route({ path: "/customer-photo", method: "POST", handler: upload });
http.route({ path: "/admin-photo", method: "GET", handler: download });
export default http;
