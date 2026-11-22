const { execFileSync } = require("child_process");
const path = require("path");

module.exports = {
  name: "git_status_check",
  title: "Проверка на Git статус и последни комити",
  category: "git-ops",
  author: "admiralerror",
  description: "Проверява текущия Git клон, променените файлове и последните комити за дадена папка.",
  options: {
    repoPath: {
      type: "string",
      required: false,
      description: "Път до локалното Git репозиторио (по подразбиране текущата директория)"
    }
  },
  async run(ctx = {}) {
    const targetDir = path.resolve(String(ctx.repoPath || process.cwd()));
    try {
      const branch = execFileSync("git", ["-C", targetDir, "rev-parse", "--abbrev-ref", "HEAD"], {
        encoding: "utf8",
        timeout: 10000
      }).trim();

      const statusShort = execFileSync("git", ["-C", targetDir, "status", "-s"], {
        encoding: "utf8",
        timeout: 10000
      }).trim();

      const recentCommits = execFileSync("git", ["-C", targetDir, "log", "-n", "5", "--oneline"], {
        encoding: "utf8",
        timeout: 10000
      }).trim();

      return {
        ok: true,
        module: this.name,
        repoPath: targetDir,
        branch,
        clean: statusShort.length === 0,
        statusShort,
        recentCommits
      };
    } catch (err) {
      return {
        ok: false,
        module: this.name,
        repoPath: targetDir,
        error: err && err.message ? err.message : String(err)
      };
    }
  }
};
