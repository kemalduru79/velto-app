#!/usr/bin/python3
"""Stage 5E1G-B trusted calculation worker. No dynamic code, files, shell, or network."""

import hashlib
import json
import math
import statistics
import sys

WORKER_VERSION = "stage-5e1g-b-python-worker-v1"
MAX_VALUES = 10_000
MAX_ABS_VALUE = 1e100


def fail(reason):
    sys.stdout.write(json.dumps({"error": f"STAGE_5E1G_B_{reason}"}, sort_keys=True, separators=(",", ":")))
    sys.exit(2)


def exact_keys(value, keys, label):
    if not isinstance(value, dict) or set(value.keys()) != set(keys):
        fail(f"{label}_SCHEMA_INVALID")


def finite_number(value, label, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        fail(f"{label}_INVALID")
    result = float(value)
    if not math.isfinite(result) or abs(result) > MAX_ABS_VALUE or (positive and result <= 0):
        fail(f"{label}_INVALID")
    return result


def values(value, label, minimum=1, positive=False):
    if not isinstance(value, list) or len(value) < minimum or len(value) > MAX_VALUES:
        fail(f"{label}_INVALID")
    return [finite_number(item, label, positive) for item in value]


def rounded(value, places):
    if value is None:
        return None
    if not math.isfinite(value):
        fail("NONFINITE_RESULT")
    return round(value, places)


def confidence_z(level):
    supported = {0.90: 1.6448536269514722, 0.95: 1.959963984540054, 0.99: 2.5758293035489004}
    for candidate, z_value in supported.items():
        if abs(level - candidate) <= 1e-12:
            return z_value
    fail("CONFIDENCE_LEVEL_UNSUPPORTED")


def descriptive(parameters, places):
    exact_keys(parameters, ["values", "ddof"], "PARAMETERS")
    sample = values(parameters["values"], "VALUES")
    ddof = parameters["ddof"]
    if isinstance(ddof, bool) or ddof not in (0, 1) or len(sample) <= ddof:
        fail("DDOF_INVALID")
    mean = statistics.fmean(sample)
    variance = sum((item - mean) ** 2 for item in sample) / (len(sample) - ddof)
    return {
        "n": len(sample), "mean": rounded(mean, places), "median": rounded(statistics.median(sample), places),
        "minimum": rounded(min(sample), places), "maximum": rounded(max(sample), places),
        "variance": rounded(variance, places), "standardDeviation": rounded(math.sqrt(variance), places),
    }, ["DESCRIPTIVE_ONLY_NO_CAUSAL_INTERPRETATION"]


def cohens_d(parameters, places):
    exact_keys(parameters, ["groupA", "groupB"], "PARAMETERS")
    group_a = values(parameters["groupA"], "GROUP_A", 2)
    group_b = values(parameters["groupB"], "GROUP_B", 2)
    var_a = statistics.variance(group_a)
    var_b = statistics.variance(group_b)
    denominator = len(group_a) + len(group_b) - 2
    pooled_variance = ((len(group_a) - 1) * var_a + (len(group_b) - 1) * var_b) / denominator
    if pooled_variance <= 1e-24:
        fail("POOLED_VARIANCE_UNSTABLE")
    result = (statistics.fmean(group_a) - statistics.fmean(group_b)) / math.sqrt(pooled_variance)
    return {
        "nA": len(group_a), "nB": len(group_b), "cohensD": rounded(result, places),
        "pooledStandardDeviation": rounded(math.sqrt(pooled_variance), places),
    }, ["ASSUMES_INDEPENDENT_GROUPS", "USES_POOLED_SAMPLE_STANDARD_DEVIATION"]


def normal_mean_ci(parameters, places):
    exact_keys(parameters, ["values", "populationSigma", "confidenceLevel"], "PARAMETERS")
    sample = values(parameters["values"], "VALUES", 1)
    sigma = finite_number(parameters["populationSigma"], "POPULATION_SIGMA", True)
    level = finite_number(parameters["confidenceLevel"], "CONFIDENCE_LEVEL", True)
    z_value = confidence_z(level)
    mean = statistics.fmean(sample)
    margin = z_value * sigma / math.sqrt(len(sample))
    return {
        "n": len(sample), "mean": rounded(mean, places), "confidenceLevel": level,
        "lower": rounded(mean - margin, places), "upper": rounded(mean + margin, places),
        "marginOfError": rounded(margin, places),
    }, ["VALID_ONLY_WHEN_POPULATION_STANDARD_DEVIATION_IS_KNOWN", "NORMAL_SAMPLING_ASSUMPTION_REQUIRED"]


def scipy_mean_t_ci(parameters, places, expected_scipy):
    exact_keys(parameters, ["values", "confidenceLevel"], "PARAMETERS")
    sample = values(parameters["values"], "VALUES", 2)
    level = finite_number(parameters["confidenceLevel"], "CONFIDENCE_LEVEL", True)
    if level <= 0 or level >= 1:
        fail("CONFIDENCE_LEVEL_UNSUPPORTED")
    try:
        import scipy
        from scipy import stats
    except Exception:
        fail("SCIPY_RUNTIME_UNAVAILABLE")
    if scipy.__version__ != expected_scipy:
        fail("SCIPY_VERSION_DRIFT")
    mean = statistics.fmean(sample)
    standard_error = statistics.stdev(sample) / math.sqrt(len(sample))
    critical = float(stats.t.ppf((1 + level) / 2, len(sample) - 1))
    if not math.isfinite(critical):
        fail("SCIPY_RESULT_INVALID")
    margin = critical * standard_error
    return {
        "n": len(sample), "degreesOfFreedom": len(sample) - 1, "mean": rounded(mean, places),
        "confidenceLevel": level, "lower": rounded(mean - margin, places),
        "upper": rounded(mean + margin, places), "marginOfError": rounded(margin, places),
    }, ["ASSUMES_INDEPENDENT_IDENTICALLY_DISTRIBUTED_OBSERVATIONS", "SCIPY_T_DISTRIBUTION_QUANTILE"]


def exponential_growth(parameters, places):
    exact_keys(parameters, ["startValue", "endValue", "elapsedTime"], "PARAMETERS")
    start = finite_number(parameters["startValue"], "START_VALUE", True)
    end = finite_number(parameters["endValue"], "END_VALUE", True)
    elapsed = finite_number(parameters["elapsedTime"], "ELAPSED_TIME", True)
    rate = math.log(end / start) / elapsed
    doubling = math.log(2) / rate if rate > 1e-15 else None
    return {
        "multiplier": rounded(end / start, places), "logGrowthRatePerUnit": rounded(rate, places),
        "doublingTime": rounded(doubling, places),
    }, ["TWO_POINT_EXPONENTIAL_SUMMARY_NOT_A_MODEL_VALIDATION"]


def log_linear_fit(parameters, places):
    exact_keys(parameters, ["x", "y"], "PARAMETERS")
    x_values = values(parameters["x"], "X", 3)
    y_values = values(parameters["y"], "Y", 3, True)
    if len(x_values) != len(y_values):
        fail("OBSERVATION_LENGTH_MISMATCH")
    x_mean = statistics.fmean(x_values)
    log_y = [math.log(item) for item in y_values]
    y_mean = statistics.fmean(log_y)
    sxx = sum((item - x_mean) ** 2 for item in x_values)
    if sxx <= 1e-24:
        fail("SINGULAR_MODEL_FIT")
    slope = sum((x_values[i] - x_mean) * (log_y[i] - y_mean) for i in range(len(x_values))) / sxx
    intercept = y_mean - slope * x_mean
    predicted = [intercept + slope * item for item in x_values]
    residual_sum = sum((log_y[i] - predicted[i]) ** 2 for i in range(len(x_values)))
    total_sum = sum((item - y_mean) ** 2 for item in log_y)
    if total_sum <= 1e-24:
        fail("MODEL_VARIANCE_UNSTABLE")
    r_squared = 1 - residual_sum / total_sum
    rmse = math.sqrt(residual_sum / len(x_values))
    doubling = math.log(2) / slope if slope > 1e-15 else None
    return {
        "n": len(x_values), "logIntercept": rounded(intercept, places), "logSlope": rounded(slope, places),
        "rSquaredLogSpace": rounded(r_squared, places), "rmseLogSpace": rounded(rmse, places),
        "doublingTime": rounded(doubling, places),
    }, ["FIT_DIAGNOSTIC_NOT_FORECAST_AUTHORITY", "OBSERVATIONS_ARE_NOT_INDEPENDENT_REPLICATIONS_OF_THE_MODEL"]


def main():
    raw = sys.stdin.buffer.read(1_000_001)
    if len(raw) > 1_000_000:
        fail("INPUT_TOO_LARGE")
    try:
        payload = json.loads(raw)
    except Exception:
        fail("INPUT_JSON_INVALID")
    exact_keys(payload, ["workerVersion", "expectedPythonVersion", "expectedScipyVersion", "operation", "parameters", "precision"], "WORKER_INPUT")
    if payload["workerVersion"] != WORKER_VERSION:
        fail("WORKER_VERSION_DRIFT")
    actual_python = ".".join(str(item) for item in sys.version_info[:3])
    if payload["expectedPythonVersion"] != actual_python:
        fail("PYTHON_VERSION_DRIFT")
    places = payload["precision"]
    if isinstance(places, bool) or not isinstance(places, int) or places < 4 or places > 15:
        fail("PRECISION_INVALID")
    operation = payload["operation"]
    handlers = {
        "descriptive_statistics_v1": lambda: descriptive(payload["parameters"], places),
        "cohens_d_independent_v1": lambda: cohens_d(payload["parameters"], places),
        "normal_mean_ci_known_sigma_v1": lambda: normal_mean_ci(payload["parameters"], places),
        "mean_t_ci_scipy_v1": lambda: scipy_mean_t_ci(payload["parameters"], places, payload["expectedScipyVersion"]),
        "exponential_growth_doubling_v1": lambda: exponential_growth(payload["parameters"], places),
        "log_linear_model_fit_v1": lambda: log_linear_fit(payload["parameters"], places),
    }
    if operation not in handlers:
        fail("OPERATION_UNSUPPORTED")
    result, limitations = handlers[operation]()
    result_json = json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False)
    output = {
        "workerVersion": WORKER_VERSION,
        "pythonVersion": actual_python,
        "operation": operation,
        "result": result,
        "resultSha256": hashlib.sha256(result_json.encode("utf-8")).hexdigest(),
        "limitations": limitations,
        "reproducibility": "TOLERANCE_BOUNDED_DETERMINISTIC_ALGORITHM",
    }
    sys.stdout.write(json.dumps(output, sort_keys=True, separators=(",", ":"), allow_nan=False))


if __name__ == "__main__":
    main()
