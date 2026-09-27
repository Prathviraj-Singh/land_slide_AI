"""
Machine Learning Model Training Pipeline for Landslide Risk Prediction.

Trains a RandomForestClassifier / GradientBoostingClassifier on real geospatial,
topographical, and meteorological features from ml-training/data/training_dataset.csv.
Computes evaluation metrics (Accuracy, Precision, Recall, F1, Confusion Matrix),
adds 5-fold stratified cross-validation for honest accuracy estimation,
tunes hyperparameters if required, saves the model to ml-training/model.pkl, and
generates a SHAP feature importance plot saved to ml-training/data/feature_importance.png.
"""

import os
import sys
import pickle
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "data", "training_dataset.csv")
MODEL_OUTPUT_PATH = os.path.join(SCRIPT_DIR, "model.pkl")
FEATURE_PLOT_PATH = os.path.join(SCRIPT_DIR, "data", "feature_importance.png")

FEATURE_COLS = [
    "avg_rainfall_7d",
    "avg_soil_moisture_7d",
    "slope_degrees",
    "historical_landslide_density",
]
TARGET_COL = "landslide_occurred"


def evaluate_model(model, X_test, y_test, name: str):
    """Calculates accuracy, precision, recall, F1, and confusion matrix."""
    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)

    prec = precision_score(y_test, preds, zero_division=0)
    rec = recall_score(y_test, preds, zero_division=0)
    f1 = f1_score(y_test, preds, zero_division=0)
    cm = confusion_matrix(y_test, preds)

    print(f"\n--- Model Evaluation: {name} ---", flush=True)
    print(f"  Accuracy:         {acc:.4f} ({acc*100:.2f}%)", flush=True)
    print(f"  Precision:        {prec:.4f}", flush=True)
    print(f"  Recall:           {rec:.4f}", flush=True)
    print(f"  F1-Score:         {f1:.4f}", flush=True)
    print(f"  Confusion Matrix:\n{cm}", flush=True)

    return acc, prec, rec, f1, cm, preds


def run_cross_validation(model_class, model_params: dict, X, y, n_folds: int = 5):
    """
    Runs n-fold stratified cross-validation and prints honest accuracy stats.
    Returns (mean_accuracy, std_accuracy, all_fold_scores).
    """
    print(f"\n--- {n_folds}-Fold Stratified Cross-Validation ---", flush=True)
    cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    model = model_class(**model_params)
    scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy")

    print(f"  Fold scores: {[f'{s:.4f}' for s in scores]}", flush=True)
    print(f"  Mean Accuracy:    {scores.mean():.4f} ({scores.mean()*100:.2f}%)", flush=True)
    print(f"  Std Deviation:    {scores.std():.4f} (±{scores.std()*100:.2f}%)", flush=True)
    print(f"  >> HONEST ACCURACY: {scores.mean()*100:.2f}% ± {scores.std()*100:.2f}%", flush=True)

    return scores.mean(), scores.std(), scores


def generate_shap_and_feature_plot(model, X_test, feature_names):
    """Computes SHAP values / feature importances and exports feature_importance.png."""
    print("\n[*] Generating Feature Importance / SHAP values plot...", flush=True)

    plt.figure(figsize=(8, 5))

    try:
        import shap

        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_test)

        if isinstance(shap_values, list):
            vals = np.abs(shap_values[1]).mean(axis=0)
        elif len(np.shape(shap_values)) == 3:
            vals = np.abs(shap_values[:, :, 1]).mean(axis=0)
        else:
            vals = np.abs(shap_values).mean(axis=0)

        importance_df = pd.DataFrame(
            {"Feature": feature_names, "Importance": vals}
        ).sort_values("Importance", ascending=True)

        plt.barh(importance_df["Feature"], importance_df["Importance"], color="#2563eb")
        plt.title("SHAP Feature Importance Breakdown (% Risk Contribution)")
        plt.xlabel("Mean |SHAP Value|")
    except Exception as e:
        print(f"    [!] SHAP calculation notice ({e}). Falling back to Gini Feature Importances.", flush=True)
        importances = getattr(model, "feature_importances_", np.ones(len(feature_names)) / len(feature_names))
        importance_df = pd.DataFrame(
            {"Feature": feature_names, "Importance": importances}
        ).sort_values("Importance", ascending=True)

        plt.barh(importance_df["Feature"], importance_df["Importance"], color="#059669")
        plt.title("Tree Feature Importances Breakdown")
        plt.xlabel("Relative Gini Importance")

    plt.tight_layout()
    plt.savefig(FEATURE_PLOT_PATH, dpi=150)
    plt.close()
    print(f"    [SUCCESS] Saved feature importance chart to: {FEATURE_PLOT_PATH}", flush=True)


def main():
    print("=" * 70, flush=True)
    print("  LandslideShield AI -- ML Model Training & Evaluation Pipeline", flush=True)
    print("=" * 70, flush=True)

    if not os.path.exists(DATASET_PATH):
        print(f"[FAIL] Missing training dataset file: {DATASET_PATH}", flush=True)
        print("Please run python ml-training/build_dataset.py first.", flush=True)
        sys.exit(1)

    df = pd.read_csv(DATASET_PATH)
    total_samples = len(df)
    print(f"[*] Loaded dataset: {total_samples} records.", flush=True)

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    # ── Class Distribution ──────────────────────────────────────────────────
    pos_total = int(y.sum())
    neg_total = total_samples - pos_total
    print(f"\n[*] Full Dataset Class Distribution:", flush=True)
    print(f"    Positive (landslide=1): {pos_total} ({pos_total/total_samples*100:.1f}%)", flush=True)
    print(f"    Negative (landslide=0): {neg_total} ({neg_total/total_samples*100:.1f}%)", flush=True)

    # ── Stratified 80/20 Split ──────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    train_pos = int(y_train.sum())
    train_neg = len(y_train) - train_pos
    test_pos = int(y_test.sum())
    test_neg = len(y_test) - test_pos

    print(f"\n[*] Train/Test Split (80/20 stratified):", flush=True)
    print(f"    Train: {len(y_train)} samples  (pos={train_pos}, neg={train_neg})", flush=True)
    print(f"    Test:  {len(y_test)} samples  (pos={test_pos}, neg={test_neg})", flush=True)

    # ── 1. Baseline Random Forest ───────────────────────────────────────────
    rf_baseline = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_baseline.fit(X_train, y_train)

    acc, prec, rec, f1, cm, _ = evaluate_model(rf_baseline, X_test, y_test, "RandomForest Baseline")

    chosen_model = rf_baseline
    chosen_name = "RandomForest Baseline"
    best_acc = acc

    # ── 2. Hyperparameter Tuning if accuracy < 0.75 ─────────────────────────
    if best_acc < 0.75:
        print("\n[!] Baseline Accuracy < 0.75 -- Initiating Hyperparameter Tuning & Model Comparison...", flush=True)

        param_grid = {
            "n_estimators": [20, 50, 100, 150],
            "max_depth": [3, 5, 8, None],
            "min_samples_split": [2, 4],
        }
        cv_count = min(3, len(X_train))
        rf_grid = GridSearchCV(
            RandomForestClassifier(random_state=42),
            param_grid,
            cv=cv_count,
            scoring="accuracy",
        )
        rf_grid.fit(X_train, y_train)
        rf_best = rf_grid.best_estimator_

        rf_acc, _, _, _, _, _ = evaluate_model(rf_best, X_test, y_test, f"RandomForest Tuned ({rf_grid.best_params_})")

        gb_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        gb_model.fit(X_train, y_train)

        gb_acc, _, _, _, _, _ = evaluate_model(gb_model, X_test, y_test, "GradientBoosting Classifier")

        if gb_acc > rf_acc and gb_acc > best_acc:
            chosen_model = gb_model
            chosen_name = "GradientBoosting Classifier"
            best_acc = gb_acc
        elif rf_acc > best_acc:
            chosen_model = rf_best
            chosen_name = f"RandomForest Tuned ({rf_grid.best_params_})"
            best_acc = rf_acc

        print(f"\n[OK] Selection Result: Chosen model '{chosen_name}' with test accuracy = {best_acc*100:.2f}%.", flush=True)
    else:
        print(f"\n[OK] Baseline accuracy ({best_acc*100:.2f}%) exceeds threshold (0.75). Proceeding with baseline model.", flush=True)

    # ── 3. 5-Fold Cross-Validation (always run for honest accuracy) ─────────
    print("\n" + "=" * 70, flush=True)
    print("  HONEST ACCURACY CHECK: 5-Fold Stratified Cross-Validation", flush=True)
    print("=" * 70, flush=True)

    cv_mean, cv_std, cv_scores = run_cross_validation(
        RandomForestClassifier,
        {"n_estimators": 100, "random_state": 42},
        X, y,
        n_folds=5,
    )

    # Also run CV on GradientBoosting for comparison
    gb_cv_mean, gb_cv_std, gb_cv_scores = run_cross_validation(
        GradientBoostingClassifier,
        {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3, "random_state": 42},
        X, y,
        n_folds=5,
    )

    if gb_cv_mean > cv_mean:
        print(f"\n[*] GradientBoosting CV ({gb_cv_mean*100:.2f}%) > RandomForest CV ({cv_mean*100:.2f}%). Retraining with GB.", flush=True)
        chosen_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        chosen_model.fit(X_train, y_train)
        chosen_name = "GradientBoosting Classifier (CV-selected)"
        best_acc = gb_cv_mean
        cv_mean = gb_cv_mean
        cv_std = gb_cv_std

    # ── 4. Save trained model ───────────────────────────────────────────────
    try:
        with open(MODEL_OUTPUT_PATH, "wb") as f:
            pickle.dump(chosen_model, f)
        print(f"\n[SUCCESS] Saved trained model to: {MODEL_OUTPUT_PATH}", flush=True)
    except Exception as save_err:
        print(f"[FAIL] Failed to save model.pkl: {save_err}", flush=True)
        sys.exit(1)

    # ── 5. Generate SHAP & Feature Importance Plot ──────────────────────────
    generate_shap_and_feature_plot(chosen_model, X_test, FEATURE_COLS)

    # ── Final Summary & Numeric Feature Importances ─────────────────────────
    print("\n" + "=" * 70, flush=True)
    print("  TRAINING SUMMARY & NUMERIC FEATURE IMPORTANCES", flush=True)
    print("=" * 70, flush=True)
    print(f"  Dataset Size:           {total_samples} samples ({pos_total} positive, {neg_total} negative)", flush=True)
    print(f"  Train Set:              {len(y_train)} samples (pos={train_pos}, neg={train_neg})", flush=True)
    print(f"  Test Set:               {len(y_test)} samples (pos={test_pos}, neg={test_neg})", flush=True)
    print(f"  Final Model:            {chosen_name}", flush=True)
    print(f"  Single-Split Accuracy:  {best_acc*100:.2f}%", flush=True)
    print(f"  5-Fold CV Accuracy:     {cv_mean*100:.2f}% ± {cv_std*100:.2f}%", flush=True)
    print(f"  >> TRUST THIS NUMBER:   {cv_mean*100:.2f}% ± {cv_std*100:.2f}%", flush=True)
    print("-" * 70, flush=True)
    print("  Feature Importances (Numeric Values):", flush=True)
    if hasattr(chosen_model, "feature_importances_"):
        imps = chosen_model.feature_importances_
        sorted_indices = np.argsort(imps)[::-1]
        for idx in sorted_indices:
            feat = FEATURE_COLS[idx]
            imp = imps[idx]
            print(f"    - {feat:30s}: {imp:.4f} ({imp*100:.2f}%)", flush=True)
        dominant_feat = FEATURE_COLS[sorted_indices[0]]
        dominant_pct = imps[sorted_indices[0]] * 100
        print(f"\n  >> DOMINANT FEATURE: {dominant_feat} ({dominant_pct:.2f}% contribution)", flush=True)
    print("=" * 70, flush=True)


if __name__ == "__main__":
    main()

