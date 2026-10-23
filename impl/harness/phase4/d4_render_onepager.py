"""D4: render drafts/ONE_PAGER.md to PDF (at most two A4 pages) with a local headless Edge.

Usage: python -I d4_render_onepager.py <ONE_PAGER.md> <out.pdf> <work dir> <msedge.exe>

markdown-it renders the Markdown to HTML with a small print stylesheet; Edge prints it with a fresh profile in the
work dir (no network use: the page has no external resources); pypdf counts the pages.
"""
import pathlib
import subprocess
import sys

from markdown_it import MarkdownIt
from pypdf import PdfReader

src, out_pdf, work, edge = sys.argv[1:5]
work = pathlib.Path(work)
work.mkdir(parents=True, exist_ok=True)
body = MarkdownIt("commonmark").enable("table").render(pathlib.Path(src).read_text(encoding="utf-8"))
css = """
@page { size: A4; margin: 14mm 15mm 14mm 15mm; }
body { font-family: "Segoe UI", Arial, sans-serif; font-size: 9.4pt; line-height: 1.32; color: #111; }
h1 { font-size: 17pt; margin: 0 0 4pt 0; }
h2 { font-size: 11.5pt; margin: 9pt 0 3pt 0; border-bottom: 1px solid #bbb; padding-bottom: 1pt; }
p { margin: 3pt 0; }
ul, ol { margin: 2pt 0 2pt 0; padding-left: 16pt; }
li { margin: 1pt 0; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0; font-size: 8.8pt; }
th, td { border: 1px solid #bbb; padding: 2.5pt 4pt; vertical-align: top; text-align: left; }
th { background: #eee; }
code { font-family: Consolas, monospace; font-size: 8.6pt; }
"""
html = f"<!doctype html><html><head><meta charset='utf-8'><title>Retiring decryption authority</title>" \
       f"<style>{css}</style></head><body>{body}</body></html>"
page = work / "ONE_PAGER.html"
page.write_text(html, encoding="utf-8")
subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={work / 'edge-profile'}", "--no-pdf-header-footer", "--print-to-pdf-no-header",
                f"--print-to-pdf={out_pdf}", page.resolve().as_uri()], check=True, capture_output=True, timeout=120)
pages = len(PdfReader(out_pdf).pages)
print("pages", pages)
sys.exit(0 if pages <= 2 else 1)
