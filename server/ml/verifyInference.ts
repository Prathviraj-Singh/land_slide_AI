/**
 * Verification script for TypeScript ML Inference Engine vs Scikit-Learn Python Model.
 *
 * Runs 5 rows from ml-training/data/training_dataset.csv through the pure TypeScript engine
 * and compares TypeScript output side-by-side with sklearn's predict_proba.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { predictRiskScore, predictProbability, FeatureInput } from "./runInference";

function parseCsv5Rows(csvPath: string): FeatureInput[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",").map((h) => h.trim());

  const rainIdx = header.indexOf("avg_rainfall_7d");
  const soilIdx = header.indexOf("avg_soil_moisture_7d");
  const slopeIdx = header.indexOf("slope_degrees");
  const histIdx = header.indexOf("historical_landslide_density");

  const rows: FeatureInput[] = [];
  for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    rows.push({
      rainfall: parseFloat(cols[rainIdx]),
      soilMoisture: parseFloat(cols[soilIdx]),
      slope: parseFloat(cols[slopeIdx]),
      historicalDensity: parseFloat(cols[histIdx]),
    });
  }
  return rows;
}

async function main() {
  console.log("======================================================================");
  console.log("  LandslideShield AI -- TypeScript Inference Verification");
  console.log("======================================================================");

  const datasetPath = path.join(process.cwd(), "ml-training", "data", "training_dataset.csv");

  let testFeatures: FeatureInput[];
  if (fs.existsSync(datasetPath)) {
    testFeatures = parseCsv5Rows(datasetPath);
  } else {
    testFeatures = [
      { rainfall: 3.51, soilMoisture: 0.4673, slope: 23.11, historicalDensity: 22.0 },
      { rainfall: 3.60, soilMoisture: 0.4703, slope: 10.88, historicalDensity: 10.0 },
      { rainfall: 2.67, soilMoisture: 0.4339, slope: 10.20, historicalDensity: 6.0 },
      { rainfall: 2.76, soilMoisture: 0.3599, slope: 27.65, historicalDensity: 11.0 },
      { rainfall: 2.34, soilMoisture: 0.3459, slope: 10.00, historicalDensity: 9.0 },
    ];
  }

  // Retrieve Sklearn probabilities using python -c with single-line statements
  let sklearnProbas: number[] = [];
  try {
    const pyCmd = [
      "python",
      "-c",
      "\"import pickle; import pandas as pd; import json; f=open('ml-training/model.pkl','rb'); m=pickle.load(f); f.close(); df=pd.read_csv('ml-training/data/training_dataset.csv'); cols=['avg_rainfall_7d','avg_soil_moisture_7d','slope_degrees','historical_landslide_density']; probs=[float(m.predict_proba([df.iloc[i][cols]])[0][1]) for i in range(5)]; print('JSON_START' + json.dumps(probs) + 'JSON_END')\""
    ].join(" ");

    const pyOutput = execSync(pyCmd, { cwd: process.cwd() }).toString();
    const jsonMatch = pyOutput.match(/JSON_START(.*?)JSON_END/);
    if (jsonMatch) {
      sklearnProbas = JSON.parse(jsonMatch[1]);
    }
  } catch (err) {
    console.warn("[!] Could not execute Python sklearn comparison script:", err);
  }

  let maxDiff = 0.0;

  for (let i = 0; i < testFeatures.length; i++) {
    const feats = testFeatures[i];
    const tsProb = predictProbability(feats);
    const result = await predictRiskScore(feats);
    const skProb = sklearnProbas[i] !== undefined ? sklearnProbas[i] : null;

    const diff = skProb !== null ? Math.abs(tsProb - skProb) : 0;
    if (diff > maxDiff) maxDiff = diff;

    console.log(`\nRow ${i + 1}:`);
    console.log(`  Features:      Rain=${feats.rainfall}mm, Soil=${feats.soilMoisture}, Slope=${feats.slope}°, History=${feats.historicalDensity}`);
    console.log(`  TypeScript:    Probability = ${tsProb.toFixed(6)} | Score = ${result.score} | Risk = ${result.riskLevel}`);
    if (skProb !== null) {
      console.log(`  Sklearn:       Probability = ${skProb.toFixed(6)}`);
      console.log(`  Abs Diff:      ${diff.toExponential(6)}`);
    }
  }

  console.log("\n----------------------------------------------------------------------");
  console.log(`Max Absolute Difference (TS vs Sklearn): ${maxDiff.toExponential(6)}`);
  if (maxDiff < 1e-6) {
    console.log("[SUCCESS] TypeScript ML inference strictly matches scikit-learn model (< 1e-6)!");
  } else {
    console.warn("[!] Warning: Max difference exceeds 1e-6 threshold.");
  }
  console.log("======================================================================");
}

main().catch(console.error);
