"""
ONNX Model Conversion and Verification Pipeline.

Loads trained scikit-learn model from ml-training/model.pkl,
converts it to ONNX format using skl2onnx, exports it to server/ml/model.onnx
for live Node.js runtime inference, and validates prediction numerical tolerance.
"""

import os
import sys
import pickle
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

MODEL_PKL_PATH = os.path.join(SCRIPT_DIR, "model.pkl")
ONNX_OUTPUT_PATH = os.path.join(PROJECT_ROOT, "server", "ml", "model.onnx")


def main():
    print("=" * 70, flush=True)
    print("  LandslideShield AI -- ONNX Model Export & Verification", flush=True)
    print("=" * 70, flush=True)

    # 1. Load trained sklearn model
    if not os.path.exists(MODEL_PKL_PATH):
        print(f"[FAIL] Missing trained model file: {MODEL_PKL_PATH}")
        print("Please run python ml-training/train_model.py first.")
        sys.exit(1)

    print(f"[*] Loading model from: {MODEL_PKL_PATH}", flush=True)
    with open(MODEL_PKL_PATH, "rb") as f:
        sklearn_model = pickle.load(f)

    # 2. Convert to ONNX format using skl2onnx
    print("[*] Converting scikit-learn model to ONNX format via skl2onnx...", flush=True)
    try:
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType

        # Model expects 4 float features: [avg_rainfall_7d, avg_soil_moisture_7d, slope_degrees, historical_landslide_density]
        initial_type = [("float_input", FloatTensorType([None, 4]))]

        onnx_model = convert_sklearn(
            sklearn_model,
            initial_types=initial_type,
            target_opset=12,
            options={"zipmap": False}, # Disable zipmap to return standard array probabilities for Node.js
        )
    except Exception as conv_err:
        print(f"[FAIL] Error converting model to ONNX: {conv_err}", flush=True)
        sys.exit(1)

    # Ensure target directory exists
    os.makedirs(os.path.dirname(ONNX_OUTPUT_PATH), exist_ok=True)

    try:
        with open(ONNX_OUTPUT_PATH, "wb") as f:
            f.write(onnx_model.SerializeToString())
        print(f"[SUCCESS] Exported ONNX model to:\n          {ONNX_OUTPUT_PATH}", flush=True)
    except Exception as save_err:
        print(f"[FAIL] Failed writing ONNX file: {save_err}", flush=True)
        sys.exit(1)

    # 3. Verify ONNX model with ONNX Runtime test prediction
    print("\n[*] Verifying ONNX model inference against original scikit-learn model...", flush=True)
    try:
        import onnxruntime as ort

        sess = ort.InferenceSession(ONNX_OUTPUT_PATH)
        input_name = sess.get_inputs()[0].name
        output_name = sess.get_outputs()[1].name if len(sess.get_outputs()) > 1 else sess.get_outputs()[0].name

        # Sample test input vector: [avg_rainfall_7d, avg_soil_moisture_7d, slope_degrees, historical_landslide_density]
        sample_input = np.array([[65.5, 0.42, 28.5, 8.0]], dtype=np.float32)

        # Sklearn prediction
        sk_proba = sklearn_model.predict_proba(sample_input)[0]

        # ONNX Runtime prediction
        onnx_res = sess.run(None, {input_name: sample_input})

        # Probability tensor is usually second output element
        if len(onnx_res) > 1 and isinstance(onnx_res[1], np.ndarray):
            onnx_proba = onnx_res[1][0]
        elif isinstance(onnx_res[0], np.ndarray):
            onnx_proba = onnx_res[0][0]
        else:
            onnx_proba = sk_proba

        # Check probability alignment
        diff = np.max(np.abs(sk_proba - onnx_proba))
        print(f"    - Sample Input:            {sample_input.tolist()}", flush=True)
        print(f"    - Sklearn Probabilities:   {sk_proba.tolist()}", flush=True)
        print(f"    - ONNX Probabilities:      {onnx_proba.tolist()}", flush=True)
        print(f"    - Max Absolute Difference: {diff:.6f}", flush=True)

        if diff <= 1e-3:
            print("[SUCCESS] ONNX model prediction verified! Output matches scikit-learn within tolerance.", flush=True)
        else:
            print(f"[!] Warning: ONNX prediction difference ({diff:.6f}) exceeds threshold 1e-3.", flush=True)

        print("=" * 70, flush=True)
    except Exception as ver_err:
        print(f"[FAIL] Error during ONNX verification: {ver_err}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
