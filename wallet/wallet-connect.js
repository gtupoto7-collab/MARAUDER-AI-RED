(function () {
  const DEFAULT_ADDR = "UQBOxLg-Vq86U_y1oJyUFTmvn6tedptaPQ4d3CDUq4O2T_7H";
  window.MarauderWalletConnect = {
    getAddress: function () {
      const el = document.getElementById("mw-ton-input");
      return (el && el.value.trim()) || DEFAULT_ADDR;
    },
    fetchTonBalance: async function (address) {
      const addr = (address || "").trim();
      if (!addr) throw new Error("Липсва TON адрес");
      try {
        const apiRes = await fetch("/api/wallet/ton/balance?address=" + encodeURIComponent(addr));
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (typeof data.balanceTon === "number") return data;
        }
      } catch (_) {}
      const rpcRes = await fetch("https://toncenter.com/api/v2/getAddressInformation?address=" + encodeURIComponent(addr));
      if (!rpcRes.ok) throw new Error("Неуспешно четене от TON RPC");
      const rpcJson = await rpcRes.json();
      const rawNano = (rpcJson && rpcJson.result && rpcJson.result.balance) || "0";
      const balanceTon = Number(rawNano) / 1e9;
      return { address: addr, balanceTon: Number.isFinite(balanceTon) ? balanceTon : 0, source: "toncenter-v2" };
    }
  };
})();
