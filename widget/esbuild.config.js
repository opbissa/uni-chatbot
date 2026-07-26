import { context, build } from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/widget.js"],
  outfile: "dist/widget.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2018",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching widget/src for changes...");
} else {
  await build(options);
  console.log("built dist/widget.js");
}
