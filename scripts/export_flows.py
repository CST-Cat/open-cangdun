# mitmproxy addon: export request/response as JSONL for analysis
# Usage: mitmdump -nr capture/session.flow -s scripts/export_flows.py
import json, sys
from mitmproxy import ctx

OUT = "/Users/cat/git-use/苍盾/capture/flows.jsonl"

class Exporter:
    def response(self, flow):
        req = flow.request
        try:
            body = req.get_text() or ""
        except Exception:
            body = "<binary %d bytes>" % (len(req.raw_content or b""))
        try:
            resp = flow.response.get_text() if flow.response else ""
        except Exception:
            resp = "<binary>"
        rec = {
            "ts": flow.request.timestamp_start,
            "method": req.method,
            "url": req.pretty_url,
            "host": req.pretty_host,
            "path": req.path,
            "req_headers": dict(req.headers),
            "req_body": body[:20000],
            "status": flow.response.status_code if flow.response else None,
            "resp_headers": dict(flow.response.headers) if flow.response else {},
            "resp_body": resp,
        }
        with open(OUT, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

addons = [Exporter()]
