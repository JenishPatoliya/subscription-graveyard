# backend/ml/anomaly_detector.py
# Isolation Forest Anomaly Detection

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime


class SubscriptionAnomalyDetector:
    """
    Detects unusual charges using Isolation Forest.
    Features: amount_normalized, amount_z_score, days_between_receipts,
              day_of_month, amount_change_pct
    """

    def __init__(self, contamination=0.1):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42
        )
        self.scaler = StandardScaler()

    def detect(self, subscriptions: list, receipts: list) -> list:
        """Run anomaly detection across all receipts"""
        if not receipts or len(receipts) < 3:
            return []

        # Group receipts by subscription
        sub_receipts = {}
        for r in receipts:
            sid = r.get("subscription_id", "")
            if sid not in sub_receipts:
                sub_receipts[sid] = []
            sub_receipts[sid].append(r)

        # Build sub name lookup
        sub_names = {s["id"]: s.get("service_name", "Unknown") for s in subscriptions}

        all_features = []
        receipt_refs = []

        for sid, recs in sub_receipts.items():
            if len(recs) < 2:
                continue

            # Sort by date
            recs.sort(key=lambda x: x.get("receipt_date", "") or "")

            amounts = [float(r.get("amount", 0)) for r in recs]
            mean_amount = np.mean(amounts) if amounts else 0
            std_amount = np.std(amounts) if len(amounts) > 1 else 1

            for i, r in enumerate(recs):
                amount = float(r.get("amount", 0))

                # Feature 1: amount_normalized (0-1 within subscription)
                max_a = max(amounts) if amounts else 1
                min_a = min(amounts) if amounts else 0
                amount_norm = (amount - min_a) / (max_a - min_a + 0.01)

                # Feature 2: amount_z_score
                z_score = (amount - mean_amount) / (std_amount + 0.01)

                # Feature 3: days_between_receipts
                days_between = 30  # default
                if i > 0 and recs[i].get("receipt_date") and recs[i - 1].get("receipt_date"):
                    try:
                        d1 = datetime.fromisoformat(recs[i]["receipt_date"])
                        d2 = datetime.fromisoformat(recs[i - 1]["receipt_date"])
                        days_between = abs((d1 - d2).days)
                    except Exception:
                        pass

                # Feature 4: day_of_month
                day_of_month = 15
                if r.get("receipt_date"):
                    try:
                        day_of_month = datetime.fromisoformat(r["receipt_date"]).day
                    except Exception:
                        pass

                # Feature 5: amount_change_pct
                change_pct = 0
                if i > 0 and amounts[i - 1] > 0:
                    change_pct = ((amount - amounts[i - 1]) / amounts[i - 1]) * 100

                all_features.append([amount_norm, z_score, days_between, day_of_month, change_pct])
                receipt_refs.append({
                    "receipt": r,
                    "subscription_id": sid,
                    "service_name": sub_names.get(sid, "Unknown"),
                    "expected_amount": mean_amount
                })

        if len(all_features) < 3:
            return []

        # Fit and predict
        X = np.array(all_features)
        X_scaled = self.scaler.fit_transform(X)

        predictions = self.model.fit_predict(X_scaled)
        scores = self.model.decision_function(X_scaled)

        # Build results for anomalies
        anomalies = []
        for i, pred in enumerate(predictions):
            if pred == -1:  # Anomaly
                ref = receipt_refs[i]
                actual = float(ref["receipt"].get("amount", 0))
                expected = ref["expected_amount"]

                # Determine anomaly type
                if actual > expected * 1.5:
                    anomaly_type = "price_hike"
                elif all_features[i][2] < 15:  # days_between < 15
                    anomaly_type = "double_charge"
                elif all_features[i][2] > 60:  # days_between > 60
                    anomaly_type = "unusual_timing"
                else:
                    anomaly_type = "amount_spike"

                # Severity based on score
                score_val = float(scores[i])
                severity = "high" if score_val < -0.3 else "medium"

                anomalies.append({
                    "subscriptionId": ref["subscription_id"],
                    "serviceName": ref["service_name"],
                    "expectedAmount": round(expected, 2),
                    "actualAmount": round(actual, 2),
                    "type": anomaly_type,
                    "severity": severity,
                    "anomalyScore": round(score_val, 4),
                    "receiptDate": ref["receipt"].get("receipt_date")
                })

        return anomalies
