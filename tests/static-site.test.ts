// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
const pages = [
  "index",
  "services",
  "estimate",
  "appointments",
  "inventory",
  "contact",
  "privacy",
];
describe("plain HTTP / Live Server compatibility", () => {
  it.each(pages)(
    "%s includes the logo and navigation without running JavaScript",
    (page) => {
      const document = new JSDOM(readFileSync(`${page}.html`, "utf8")).window
        .document;
      const logo = document.querySelector("header img");
      expect(logo?.getAttribute("alt")).toBe("Botticello Auto Repair");
      expect(existsSync(`.${logo?.getAttribute("src")}`)).toBe(true);
      expect(
        document.querySelector('nav[aria-label="Main navigation"]'),
      ).not.toBeNull();
      expect(document.querySelector("footer img")).not.toBeNull();
    },
  );
  it("loads the API configuration with native ES modules, without Vite transforms", () => {
    const result = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const {CONVEX_URL,call}=await import('./assets/config.js');let request;globalThis.fetch=async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({status:'success',value:[]})}};await call('query','inventory:available');process.stdout.write(JSON.stringify({CONVEX_URL,request}));`,
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(result)).toEqual({
      CONVEX_URL: "https://sincere-turtle-299.convex.cloud",
      request: {
        url: "https://sincere-turtle-299.convex.cloud/api/query",
        body: { path: "inventory:available", args: {}, format: "json" },
      },
    });
  });
  it("renders two shop photos in the homepage hero using existing image files", () => {
    const document = new JSDOM(readFileSync("index.html", "utf8")).window
      .document;
    const photos = [...document.querySelectorAll(".hero img")];
    expect(photos).toHaveLength(2);
    for (const photo of photos)
      expect(existsSync(`.${photo.getAttribute("src")}`)).toBe(true);
  });
});
