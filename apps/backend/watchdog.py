import re
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from dataclasses import dataclass
from types import SimpleNamespace


@dataclass(frozen=True)
class WatchdogFinding:
    rule: str
    message: str


RULES = (
    ("download-and-execute", re.compile(r"\b(?:curl|wget)\b[^\n|]{0,300}\|\s*(?:sh|bash|zsh)\b", re.I), "Download piped directly into a shell."),
    ("destructive-shell", re.compile(r"\brm\s+-[^\n]*\brf\b[^\n]*\s+/(?:\s|$)", re.I), "Recursive deletion from the filesystem root."),
    ("encoded-powershell", re.compile(r"\b(?:powershell|pwsh)\b[^\n]*(?:-enc(?:odedcommand)?\b|invoke-expression\b|\biex\b)", re.I), "Encoded or dynamically evaluated PowerShell."),
    ("command-execution", re.compile(r"\b(?:os\.system|subprocess\.(?:run|popen|call)|child_process\.(?:exec|spawn|execfile))\s*\(", re.I), "Direct operating-system command execution."),
    ("fork-bomb", re.compile(r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;", re.I), "Shell fork bomb signature."),
)


def scan_files(files):
    findings = []
    for index, file in enumerate(files):
        for rule, pattern, message in RULES:
            if pattern.search(file.content):
                findings.append({"fileIndex": index, "path": file.path, "rule": rule, "message": message})
    return findings


class WatchdogHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/scan":
            self.send_error(404)
            return
        length = int(self.headers.get("content-length", "0"))
        payload = json.loads(self.rfile.read(length))
        findings = scan_files(
            [SimpleNamespace(path=item["path"], content=item["content"]) for item in payload["files"]]
        )
        body = json.dumps({"findings": findings}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/health":
            self.send_error(404)
            return
        self.send_response(200)
        self.end_headers()

    def log_message(self, *_):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 9000), WatchdogHandler).serve_forever()
