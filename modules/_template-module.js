module.exports = {
  name: "example_module",
  title: "Примерен модул за проверка",
  category: "recon",
  author: "admiralerror",
  description: "Шаблон за добавяне на нов модул в MARAUDER.",
  options: {
    target: { type: "string", required: true, description: "Цел (домейн, IP или локален път)" }
  },
  async run(ctx = {}) {
    const target = String(ctx.target || "").trim();
    if (!target) {
      return { ok: false, error: "Липсва параметър target" };
    }
    return {
      ok: true,
      module: this.name,
      target,
      timestamp: new Date().toISOString(),
      summary: "Модулът е изпълнен успешно."
    };
  }
};
