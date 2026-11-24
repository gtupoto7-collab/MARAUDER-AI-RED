import json
import subprocess
import time
import hashlib

with open("data/agent-army/agents.json", encoding="utf-8") as f:
    d = json.load(f)

agents = d if isinstance(d, list) else d["agents"]

results = []

for agent in agents[:10]:
    agent_id = agent["id"]
    role = agent.get("role", "Unknown")
    caps = ", ".join(agent.get("capabilities", []))

    prompt = f"""
You are a distinct runtime agent.

AGENT_ID: {agent_id}
ROLE: {role}
CAPABILITIES: {caps}

You are NOT another agent.
Identify yourself using exactly three lines:

AGENT_ID={agent_id}
ROLE={role}
CAPABILITIES={caps}

Do not mention other agents.
"""

    started = time.time()

    try:
        r = subprocess.run(
            ["ollama", "run", "llama3.2:latest", prompt],
            capture_output=True,
            text=True,
            timeout=90
        )

        output = r.stdout.strip()
        digest = hashlib.sha256(output.encode()).hexdigest()

        results.append({
            "agentId": agent_id,
            "role": role,
            "exitCode": r.returncode,
            "latencySec": round(time.time() - started, 2),
            "outputSha256": digest,
            "verified": r.returncode == 0 and agent_id in output and role in output
        })

    except Exception as e:
        results.append({
            "agentId": agent_id,
            "role": role,
            "verified": False,
            "error": str(e)
        })

print("\n=== INDEPENDENT AGENT RUNTIME TEST ===")

for r in results:
    print(
        r["agentId"],
        "|",
        r["role"],
        "| VERIFIED=" + str(r["verified"]),
        "| LATENCY=" + str(r.get("latencySec", "?"))
    )

ok = sum(1 for r in results if r["verified"])

print("\nTESTED:", len(results))
print("INDEPENDENT RUNTIME VERIFIED:", ok)
print("FAILED:", len(results) - ok)
