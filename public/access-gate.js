(function(){
var KEY = "marauder_unlocked_session_v1";
if (sessionStorage.getItem(KEY) === "1") return;
var u = prompt("MARAUDER-AI Admin User:");
var p = prompt("MARAUDER-AI Access Key:");
if (!u || !p) {
document.body.innerHTML = "<div style='font-family:monospace;background:#09090b;color:#f87171;padding:24px;'>Достъпът е отказан. Презареди страницата за нов опит.</div>";
throw new Error("Access denied");
}
sessionStorage.setItem(KEY, "1");
})();
