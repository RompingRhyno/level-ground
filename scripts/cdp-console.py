#!/usr/bin/env python3
"""Load a URL headless, capture console errors/warnings, print them. Session cookie optional.

Usage: python3 scripts/cdp-console.py <url> [cookie-value]
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

async def main():
    url = sys.argv[1]
    cookie = sys.argv[2] if len(sys.argv) > 2 else None
    port = free_port(); profile = tempfile.mkdtemp(prefix="cdp-console-")
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
        messages = []
        async with websockets.connect(ws_url, max_size=32 * 1024 * 1024) as ws:
            mid = 0
            async def send(method, params=None):
                nonlocal mid
                mid += 1
                await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
                return mid
            await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable")
            if cookie:
                await send("Network.enable")
                await send("Network.setCookie", {"name": "better-auth.session_token", "value": cookie,
                                                 "domain": "localhost", "path": "/"})
            await send("Page.navigate", {"url": url})
            deadline = time.time() + 14
            while time.time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=1.5)
                except asyncio.TimeoutError:
                    continue
                msg = json.loads(raw)
                m = msg.get("method")
                if m == "Runtime.consoleAPICalled":
                    typ = msg["params"]["type"]
                    if typ in ("error", "warning"):
                        text = " ".join(str(a.get("value", a.get("description", ""))) for a in msg["params"]["args"])
                        messages.append(f"[console.{typ}] {text[:600]}")
                elif m == "Runtime.exceptionThrown":
                    d = msg["params"]["exceptionDetails"]
                    messages.append(f"[exception] {(d.get('exception') or {}).get('description', d.get('text',''))[:600]}")
                elif m == "Log.entryAdded":
                    e = msg["params"]["entry"]
                    if e.get("level") in ("error", "warning"):
                        messages.append(f"[log.{e['level']}] {e.get('text','')[:600]}")
            for i, m in enumerate(messages, 1):
                print(f"--- {i}\n{m}")
            print(f"TOTAL={len(messages)}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

asyncio.run(main())
