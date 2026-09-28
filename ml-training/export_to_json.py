"""
JSON Model Conversion and Verification Pipeline for LandslideShield AI.

Loads trained scikit-learn model (GradientBoostingClassifier or RandomForestClassifier)
from ml-training/model.pkl, exports tree structures, features, learning rate, and initial score
to server/ml/model.json for zero-dependency native TypeScript inference on Vercel.
"""

import os
import sys
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

MODEL_PKL_PATH = os.path.join(SCRIPT_DIR, "model.pkl")
DATASET_PATH = os.path.join(SCRIPT_DIR, "data", "training_dataset.csv")
JSON_OUTPUT_PATH = os.path.join(PROJECT_ROOT, "server", "ml", "model.json")

FEATURE_COLS = [
    "avg_rainfall_7d",
    "avg_soil_moisture_7d",
    "slope_degrees",
    "historical_landslide_density",
]


def export_model_to_json(model) -> dict:
    """Exports a scikit-learn GradientBoostingClassifier or RandomForestClassifier to dict."""
    model_type = type(model).__name__

    if isinstance(model, GradientBoostingClassifier):
        learning_rate = float(model.learning_rate)
        # Calculate init_raw_score (log-odds of class prior)
        if hasattr(model, "_raw_predict_init"):
            dummy_x = np.zeros((1, len(FEATURE_COLS)))
            init_raw_score = float(model._raw_predict_init(dummy_x)[0, 0])
        elif hasattr(model, "init_") and hasattr(model.init_, "class_prior_"):
            p0, p1 = model.init_.class_prior_
            init_raw_score = float(np.log(p1 / p0))
        else:
            init_raw_score = 0.0

        trees = []
        # GradientBoostingClassifier stores estimators as 2D array of shape (n_estimators, 1)
        estimators = model.estimators_[:, 0] if model.estimators_.ndim == 2 else model.estimators_
        for est in estimators:
            t = est.tree_
            # For GBDT regressor trees, t.value shape is (n_nodes, 1, 1)
            values = [float(v[0][0]) for v in t.value]
            trees.append({
                "children_left": t.children_left.tolist(),
                "children_right": t.children_right.tolist(),
                "feature": t.feature.tolist(),
                "threshold": [float(x) for x in t.threshold.tolist()],
                "values": values,
            })

        return {
            "model_type": model_type,
            "feature_names": FEATURE_COLS,
            "learning_rate": learning_rate,
            "init_raw_score": init_raw_score,
            "trees": trees,
        }

    elif isinstance(model, RandomForestClassifier):
        trees = []
        for est in model.estimators_:
            t = est.tree_
            # For RF classifier trees, t.value shape is (n_nodes, 1, 2)
            values = []
            for v in t.value:
                c0, c1 = v[0]
                total = c0 + c1
                values.append(float(c1 / total) if total > 0 else 0.0)
            trees.append({
                "children_left": t.children_left.tolist(),
                "children_right": t.children_right.tolist(),
                "feature": t.feature.tolist(),
                "threshold": [float(x) for x in t.threshold.tolist()],
                "values": values,
            })

        return {
            "model_type": model_type,
            "feature_names": FEATURE_COLS,
            "learning_rate": 1.0,
            "init_raw_score": 0.0,
            "trees": trees,
        }

    else:
        raise ValueError(f"Unsupported model type: {model_type}. Expected GradientBoostingClassifier or RandomForestClassifier.")


def predict_proba_from_json(model_data: dict, x: np.ndarray) -> np.ndarray:
    """Re-implements tree traversal in Python from model_data dict only."""
    model_type = model_data["model_type"]
    trees = model_data["trees"]

    if model_type == "GradientBoostingClassifier":
        init_raw_score = model_data["init_raw_score"]
        learning_rate = model_data["learning_rate"]
        raw_score = init_raw_score
        for tree in trees:
            node = 0
            c_left = tree["children_left"]
            c_right = tree["children_right"]
            feature = tree["feature"]
            threshold = tree["threshold"]
            values = tree["values"]

            while c_left[node] != -1:
                f = feature[node]
                th = threshold[node]
                if x[f] <= th:
                    node = c_left[node]
                else:
                    node = c_right[node]

            raw_score += learning_rate * values[node]

        prob_class_1 = 1.0 / (1.0 + np.exp(-raw_score))
        return np.array([1.0 - prob_class_1, prob_class_1])

    elif model_type == "RandomForestClassifier":
        prob_sum = 0.0
        for tree in trees:
            node = 0
            c_left = tree["children_left"]
            c_right = tree["children_right"]
            feature = tree["feature"]
            threshold = tree["threshold"]
            values = tree["values"]

            while c_left[node] != -1:
                f = feature[node]
                th = threshold[node]
                if x[f] <= th:
                    node = c_left[node]
                else:
                    node = c_right[node]

            prob_sum += values[node]

        prob_class_1 = prob_sum / len(trees)
        return np.array([1.0 - prob_class_1, prob_class_1])

    else:
        raise ValueError(f"Unknown model_type: {model_type}")


def main():
    print("=" * 70, flush=True)
    print("  LandslideShield AI -- JSON Model Export & Verification", flush=True)
    print("=" * 70, flush=True)

    if not os.path.exists(MODEL_PKL_PATH):
        print(f"[FAIL] Missing model pickle: {MODEL_PKL_PATH}")
        sys.exit(1)

    print(f"[*] Loading model from: {MODEL_PKL_PATH}", flush=True)
    with open(MODEL_PKL_PATH, "rb") as f:
        model = pickle.load(f)

    print(f"[*] Exporting model ({type(model).__name__}) to JSON structure...", flush=True)
    model_data = export_model_to_json(model)

    os.makedirs(os.path.dirname(JSON_OUTPUT_PATH), exist_ok=True)
    with open(JSON_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(model_data, f, indent=2)

    print(f"[SUCCESS] Exported JSON model to:\n          {JSON_OUTPUT_PATH}", flush=True)

    # Verification on training dataset
    if not os.path.exists(DATASET_PATH):
        print(f"[FAIL] Dataset missing for verification: {DATASET_PATH}")
        sys.exit(1)

    df = pd.read_csv(DATASET_PATH)
    X = df[FEATURE_COLS].values
    num_verify = min(len(X), 25)

    print(f"\n[*] Verifying JSON tree traversal on {num_verify} rows from training dataset...", flush=True)
    sk_probs = model.predict_proba(X[:num_verify])

    json_probs = []
    for i in range(num_verify):
        p = predict_proba_from_json(model_data, X[i])
        json_probs.append(p)
    json_probs = np.array(json_probs)

    max_diff = float(np.max(np.abs(sk_probs - json_probs)))
    print(f"    - Sample count verified: {num_verify}")
    print(f"    - Max Absolute Difference: {max_diff:.10e}")

    assert max_diff < 1e-6, f"Max difference {max_diff} exceeds 1e-6 tolerance threshold!"
    print(f"[SUCCESS] JSON Model verification passed! Max difference is {max_diff:.10e} (< 1e-6).")
    print("=" * 70, flush=True)


if __name__ == "__main__":
    main()
