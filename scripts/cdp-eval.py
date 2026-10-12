#!/usr/bin/env python3
"""Evaluate one JavaScript expression against a running page and print the result as JSON.

Why this exists: `globals.css` carries unlayered plain CSS (`.btn-primary`, `.heading`, ...) which beats
Tailwind's layered utilities in the cascade. A utility class can therefore be present in the markup and
still not apply, so "the class is in the HTML" is not evidence anything changed. This reads RESOLVED
values — `getComputedStyle`, `getBoundingClientRect` — which is the only honest check.

Drives the Chromium that Playwright already has cached, over raw CDP, because the Hermes browser harness
refuses to start here (`browser.use_real_profile` with a non-Chromium default browser).

Usage:
    python3 scripts/cdp-eval.py <url> '<js expression>'
    python3 scripts/cdp-eval.py <url> '<js expression>' [width]x[height]
    python3 scripts/cdp-eval.py http://localhost:3000/ 'getComputedStyle(document.querySelector("h1")).fontSize'
    python3 scripts/cdp-eval.py http://localhost:3000/contact 'innerWidth' 820x900

Note: a selector can legitimately come back null on the first run after a source edit — Next's dev server
compiles the route on demand, and Chrome may hit it mid-rebuild. Re-run before concluding anything.
"""
import asyncio
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request


def find_chrome() -> str:
    for pattern in (
        "~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome",
        "~/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
    ):
        hits = glob.glob(os.path.expanduser(pattern))
        if hits:
            return sorted(hits)[-1]
    raise SystemExit("no cached Chromium found under ~/.cache/ms-playwright")


def free_port() -> int:
    """A per-run port: a fixed one was being held by a leftover Chrome from an earlier run, so the probe
    silently connected to the stale instance and read an old, unstyled document."""
    import socket

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    url, expr = sys.argv[1], sys.argv[2]
    size = (sys.argv[3] if len(sys.argv) > 3 else "1440x900").replace("x", ",")
    profile_dir = tempfile.mkdtemp(prefix="cdp-eval-")
    port = free_port()

    proc = subprocess.Popen(
        [
            find_chrome(),
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--remote-debugging-port={port}",
            # Fresh profile per run: a stale lock on a shared --user-data-dir made Chrome come up without the
            # page loaded (probes then read an empty or unstyled document — the "Times New Roman" trap).
            f"--user-data-dir={profile_dir}",
            f"--window-size={size}",
            url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        ws_url = None
        for _ in range(80):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=2) as resp:
                    targets = json.load(resp)
                pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.25)
        if not ws_url:
            raise SystemExit("no page target on the debugging port")

        import websockets

        async with websockets.connect(ws_url, max_size=16 * 1024 * 1024) as ws:
            await ws.send(json.dumps({
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": (
                        "new Promise(r => {"
                        "  const ready = () => {"
                        "    try {"
                        "      const body = document.body ? document.body.innerHTML.length : 0;"
                        "      const sheets = [...document.styleSheets].filter(s => s.href && s.href.includes('.css'));"
                        "      const styled = sheets.length > 0 && sheets.every(s => {"
                        "        try { return !!s.cssRules && s.cssRules.length > 3; } catch (e) { return true; }"
                        "      });"
                        "      return body > 2000 && styled;"
                        "    } catch (e) { return false; }"
                        "  };"
                        "  const wait = (n) => (ready() || n <= 0) ? setTimeout(() => r(1), 400)"
                        "    : setTimeout(() => wait(n - 1), 500);"
                        "  if (document.readyState === 'complete') wait(60);"
                        "  else window.addEventListener('load', () => wait(60));"
                        "})"
                    ),
                    "awaitPromise": True,
                    "returnByValue": True,
                },
            }))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == 1:
                    break

            await ws.send(json.dumps({
                "id": 2,
                "method": "Runtime.evaluate",
                "params": {"expression": expr, "awaitPromise": True, "returnByValue": True},
            }))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == 2:
                    result = msg.get("result", {})
                    value = result.get("result", {}).get("value")
                    if result.get("exceptionDetails"):
                        print(json.dumps(result["exceptionDetails"], indent=2))
                    else:
                        print(json.dumps(value, indent=2))
                    break
    finally:
        proc.terminate()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
