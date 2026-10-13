#!/usr/bin/env python3
"""Capture console.error args (as JSON) by patching console before page scripts run.

Usage: python3 scripts/cdp-errs.py <url> [cookie]
"""
import asyncio, glob, json, os, socket, subprocess, sys, tempfile, time, urllib.request

def find_chrome():
    for pattern in ("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome",
                    "~/.cache/ms-playwright/chromium-*/chrome-linux/chrome"):
        hits = glob.glob(os.path.expanduser(pattern))
        if hits:
            return sorted(hits)[-1]
    raise SystemExit("no cached Chromium")

def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); return s.getsockname()[1]

PATCH = """
const orig = console.error;
window.__errs = [];
console.error = function(...args) {
  try {
    window.__errs.push(args.map((a) => {
      try {
        if (typeof a === "string") return a;
        if (a instanceof Error) return "Error: " + a.message + "\\n" + (a.stack || "");
        return JSON.stringify(a, Object.getOwnPropertyNames(a));
      } catch (e) { return String(a); }
    }));
  } catch (e) {}
  return orig.apply(console, args);
};
"""

async def main():
    url = sys.argv[1]
    cookie = sys.argv[2] if len(sys.argv) > 2 else None
    port = free_port(); profile = tempfile.mkdtemp(prefix="cdp-errs-")
    proc = subprocess.Popen([find_chrome(), "--headless", "--disable-gpu", "--no-sandbox",
                             f"--remote-debugging-port={port}", f"--user-data-dir={profile}",
                             "--window-size=1440,900", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(80):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=2) as resp:
                    targets = json.load(resp)
                pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]; break
            except Exception:
                pass
            time.sleep(0.25)
        import websockets
        async with websockets.connect(ws_url, max_size=32 * 1024 * 1024) as ws:
            mid = 0
            async def send(method, params=None):
                nonlocal mid
                mid += 1
                await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
                return mid
            await send("Page.enable"); await send("Runtime.enable")
            await send("Page.addScriptToEvaluateOnNewDocument", {"source": PATCH})
            if cookie:
                await send("Network.enable")
                await send("Network.setCookie", {"name": "better-auth.session_token", "value": cookie,
                                                 "domain": "localhost", "path": "/"})
            await send("Page.navigate", {"url": url})
            await asyncio.sleep(12)
            r = await send("Runtime.evaluate", {"expression": "JSON.stringify(window.__errs || [])", "returnByValue": True})
            # read the response for that id
            got = None
            deadline = time.time() + 10
            while time.time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=2)
                except asyncio.TimeoutError:
                    break
                m = json.loads(raw)
                if m.get("id") == r:
                    got = m
                    break
            val = (((got or {}).get("result") or {}).get("result") or {}).get("value") or "[]"
            errs = json.loads(val)
            for i, e in enumerate(errs, 1):
                first = (e[0] or "")[:140].replace("\n", " ")
                print(f"### err {i}: {first}")
                for extra in e[1:]:
                    print("   ARG:", str(extra)[:2200])
            print(f"TOTAL={len(errs)}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

asyncio.run(main())
