"""Serialization test fixture only; supplied version labels are NOT attestation."""
import importlib.util
import json
from pathlib import Path
import sys

module_path = Path(__file__).resolve().parents[1] / "scientific-review" / "scientific_result_v2.py"
spec = importlib.util.spec_from_file_location("scientific_result_v2", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
raw = sys.stdin.buffer.read(1_000_001)
if len(raw) > 1_000_000:
    raise ValueError("FIXTURE_INPUT_TOO_LARGE")
payload = json.loads(raw)
# Explicit synthetic float fixture, not a numerical calculation or attestation.
if isinstance(payload.get("result"), dict):
    for key, value in payload["result"].items():
        if key != "n" and isinstance(value, (int, float)) and not isinstance(value, bool):
            payload["result"][key] = float(value)
result = module.encode_scientific_result_v2(**payload)
sys.stdout.buffer.write(result)
