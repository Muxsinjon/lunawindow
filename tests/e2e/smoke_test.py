"""Playwright smoke tests (webapp-testing skill pattern).

Usage:  python tests/e2e/smoke_test.py [base_url]     (default http://localhost:4173/)
Covers: load, pick site, scrub time, compare 2 sites, landing calendar, share link restores state,
and zero console errors/warnings. Exits non-zero on failure.
"""
import re
import sys

from playwright.sync_api import expect, sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
problems: list[str] = []
passed: list[str] = []


def check(name, fn):
    try:
        fn()
        passed.append(name)
        print("PASS", name)
    except Exception as e:  # noqa: BLE001 - report every failing check
        problems.append(f"{name}: {e}")
        print("FAIL", name, "-", (str(e).splitlines() or [repr(e)])[0])


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("try{localStorage.setItem('llsn.onboarded','1')}catch(e){}")
    page = ctx.new_page()
    console: list[str] = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

    def load():
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        expect(page.get_by_role("heading", name="Nobile Rim 2 (optimal point)")).to_be_visible()
        expect(page.get_by_role("img", name=re.compile(r"^Sky view at"))).to_be_visible()
        expect(page.get_by_text("Sunset in")).to_be_visible()

    def pick_site():
        page.get_by_label("Landing site").select_option("im-2")
        expect(page.get_by_role("heading", name="IM-2 Athena (Intuitive Machines)")).to_be_visible()
        expect(page).to_have_url(re.compile(r"site=im-2"))

    def scrub_time():
        slider = page.get_by_label("Time within the window")
        before = slider.get_attribute("aria-valuetext")
        slider.focus()
        for _ in range(12):
            page.keyboard.press("ArrowRight")
        after = slider.get_attribute("aria-valuetext")
        assert before != after, f"time did not move ({before})"
        page.locator("body").click(position={"x": 5, "y": 5})
        page.keyboard.press("Shift+ArrowRight")  # global shortcut: +1 day
        assert slider.get_attribute("aria-valuetext") != after

    def compare_two():
        page.get_by_role("tab", name="Compare").click()
        expect(page.get_by_role("heading", name="Compare sites and dates")).to_be_visible()
        rows = page.locator("article.cmp-row")
        n = rows.count()
        assert n >= 2, f"expected at least 2 scenarios, got {n}"
        page.get_by_label("Site to add").select_option("im-1")
        page.get_by_role("button", name="Add scenario").click()
        expect(rows).to_have_count(n + 1)
        expect(page.locator(".delta").first).to_be_visible()

    def landing_calendar():
        page.get_by_role("tab", name="Landing calendar").click()
        expect(page.get_by_role("heading", name="Landing calendar")).to_be_visible()
        cells = page.locator(".cell.ok")
        assert cells.count() > 0, "no viable days shown"
        cells.first.click()
        expect(page.get_by_role("tab", name="Explore a site")).to_have_attribute("aria-selected", "true")

    def share_link():
        url = BASE + "#site=im-1&t=2026-12-01T00%3A00Z&at=2026-12-01T06%3A00Z&w=30&tab=site&mode=explore&tz=utc"
        p2 = ctx.new_page()
        p2.goto(url)
        p2.wait_for_load_state("networkidle")
        expect(p2.get_by_role("heading", name="IM-1 Odysseus, Malapert A")).to_be_visible()
        expect(p2.get_by_role("radio", name="Explore")).to_have_attribute("aria-checked", "true")
        expect(p2.get_by_label("Time within the window")).to_have_attribute("aria-valuetext", "2026-12-01 06:00 UTC")
        expect(p2.get_by_role("complementary", name="Plain-language explanation")).to_be_visible()
        p2.close()

    def data_page():
        page.get_by_role("tab", name="Data and methods").click()
        expect(page.get_by_role("heading", name="About the data and methods")).to_be_visible()
        expect(page.get_by_role("heading", name="Validated against a real mission")).to_be_visible()

    def interactions():
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        # info tooltip opens on focus and explains the metric
        page.get_by_role("button", name="About Sun above terrain").focus()
        expect(page.get_by_role("tooltip")).to_contain_text("upper limb")
        page.keyboard.press("Escape")
        # play advances time
        slider = page.get_by_label("Time within the window")
        before = slider.get_attribute("aria-valuetext")
        page.get_by_role("button", name="Play through the window").click()
        expect(slider).not_to_have_attribute("aria-valuetext", before, timeout=5000)
        page.get_by_role("button", name="Pause").click()
        # clicking the polar map creates a custom site computed in the browser
        page.locator(".mapbox canvas").wait_for(state="visible", timeout=20000)
        box = page.locator(".mapbox").bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.35, box["y"] + box["height"] * 0.4)
        expect(page.get_by_role("heading", name=re.compile(r"^Custom spot"))).to_be_visible(timeout=15000)
        expect(page).to_have_url(re.compile(r"site=custom"))
        # theme toggle
        page.get_by_role("button", name="Switch to light theme").click()
        expect(page.locator("html")).to_have_attribute("data-theme", "light")
        page.get_by_role("button", name="Switch to dark theme").click()
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")

    for name, fn in [
        ("load", load),
        ("pick site", pick_site),
        ("scrub time", scrub_time),
        ("compare 2 sites", compare_two),
        ("landing calendar", landing_calendar),
        ("share link restores state", share_link),
        ("data and methods page", data_page),
        ("tooltip, playback, map click, theme", interactions),
    ]:
        check(name, fn)

    if console:
        problems.append("console: " + " | ".join(console))
        print("FAIL console errors/warnings:", console)
    else:
        print("PASS no console errors or warnings")
    browser.close()

print(f"\n{len(passed)} passed, {len(problems)} failed")
sys.exit(1 if problems else 0)
