"""Unqualified v2 serialization helper; no calculation, subprocess or container.

A future reviewed worker must obtain runtime versions/identity independently.
Supplying this helper with labels is not runtime attestation or authority.
"""
import hashlib
import json
import math
import re


def encode_scientific_result_v2(*, request_sha256, profile_sha256, operation,
                                python_version, numpy_version, scipy_version,
                                worker_sha256, result):
    for digest in (request_sha256, profile_sha256, worker_sha256):
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise ValueError("SCIENTIFIC_V2_IDENTITY_INVALID")
    for version in (python_version, numpy_version, scipy_version):
        if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
            raise ValueError("SCIENTIFIC_V2_VERSION_INVALID")
    operations = {"descriptive_statistics_v1", "cohens_d_independent_v1",
                  "normal_mean_ci_known_sigma_v1", "mean_t_ci_scipy_v1",
                  "exponential_growth_doubling_v1", "log_linear_model_fit_v1"}
    if operation not in operations or not isinstance(result, dict) or not result or len(result) > 10:
        raise ValueError("SCIENTIFIC_V2_RESULT_INVALID")
    for key, value in result.items():
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9]{0,63}", key):
            raise ValueError("SCIENTIFIC_V2_RESULT_INVALID")
        if value is None and key == "doublingTime":
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("SCIENTIFIC_V2_RESULT_INVALID")
        # v2 supports finite binary64 floats and safe-range integers only.
        # Python arbitrary precision integers must not cross into rounded JS values.
        if abs(value) > 9007199254740991:
            raise ValueError("SCIENTIFIC_V2_NUMERIC_DOMAIN_INVALID")
    # Preserve these exact bytes, including Python's 2.0 lexeme, across JS parsing.
    result_json = json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False)
    output = {"protocol": "scientific-result-v2", "requestIdentitySha256": request_sha256,
              "profileSha256": profile_sha256, "operation": operation,
              "pythonVersion": python_version, "numpyVersion": numpy_version,
              "scipyVersion": scipy_version, "workerSha256": worker_sha256,
              "result": result, "resultJson": result_json,
              "resultSha256": hashlib.sha256(result_json.encode("utf-8")).hexdigest()}
    encoded = json.dumps(output, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    if len(encoded) > 1_000_000:
        raise ValueError("SCIENTIFIC_V2_OUTPUT_LIMIT_EXCEEDED")
    return encoded
