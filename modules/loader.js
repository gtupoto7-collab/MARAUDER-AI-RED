const fs = require("fs");
const path = require("path");

function walkJsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(full, acc);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".js") &&
      !entry.name.startsWith("_") &&
      path.resolve(full) !== path.resolve(__filename)
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function loadModules(baseDir = __dirname) {
  const files = walkJsFiles(baseDir).sort();
  const loaded = [];
  const errors = [];

  for (const file of files) {
    try {
      const resolved = require.resolve(file);
      delete require.cache[resolved];
      const mod = require(resolved);
      loaded.push({
        file: path.relative(path.dirname(baseDir), file),
        name: mod.name || path.basename(file, ".js"),
        title: mod.title || "",
        category: mod.category || path.basename(path.dirname(file)),
        hasRun: typeof mod.run === "function",
        module: mod
      });
    } catch (err) {
      errors.push({
        file: path.relative(path.dirname(baseDir), file),
        error: err && err.message ? err.message : String(err)
      });
    }
  }

  return { loaded, errors };
}

if (require.main === module) {
  const res = loadModules(__dirname);
  console.log(JSON.stringify({
    count: res.loaded.length,
    modules: res.loaded.map(({ module, ...meta }) => meta),
    errors: res.errors
  }, null, 2));
}

module.exports = { loadModules, walkJsFiles };
