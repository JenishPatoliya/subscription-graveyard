# backend/ml/subscription_clusterer.py
# K-Means Clustering for subscription segmentation

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from datetime import datetime


class SubscriptionClusterer:
    """
    Groups subscriptions into usage clusters using K-Means.
    Features: amount, total_receipts, days_since_last_receipt,
              receipt_frequency_days, total_spent, amount_consistency,
              subscription_age_days
    """

    CLUSTER_LABELS = {
        0: {"label": "Heavily Used", "color": "#00E676", "emoji": "🟢"},
        1: {"label": "Active", "color": "#42A5F5", "emoji": "🔵"},
        2: {"label": "Low Usage", "color": "#FFB800", "emoji": "🟡"},
        3: {"label": "Likely Unused", "color": "#FF4455", "emoji": "🔴"},
    }

    def __init__(self):
        self.scaler = StandardScaler()

    def cluster(self, subscriptions: list, receipts: list) -> dict:
        """Run K-Means clustering on subscriptions"""
        if not subscriptions or len(subscriptions) < 4:
            return self._fallback(subscriptions)

        today = datetime.utcnow()

        # Group receipts by subscription
        sub_receipts = {}
        for r in receipts:
            sid = r.get("subscription_id", "")
            if sid not in sub_receipts:
                sub_receipts[sid] = []
            sub_receipts[sid].append(r)

        # Build feature matrix
        features = []
        sub_refs = []

        for sub in subscriptions:
            sid = sub["id"]
            recs = sub_receipts.get(sid, [])

            amount = float(sub.get("amount", 0))
            total_receipts = int(sub.get("total_receipts", 0))
            total_spent = float(sub.get("total_spent", 0))

            # Days since last receipt
            days_since = 365
            if sub.get("last_receipt_date"):
                try:
                    last = datetime.fromisoformat(sub["last_receipt_date"])
                    days_since = (today - last).days
                except Exception:
                    pass

            # Receipt frequency (avg days between receipts)
            frequency = 30
            if len(recs) >= 2:
                dates = sorted([
                    datetime.fromisoformat(r["receipt_date"])
                    for r in recs if r.get("receipt_date")
                ])
                if len(dates) >= 2:
                    gaps = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
                    frequency = np.mean(gaps) if gaps else 30

            # Amount consistency (std dev of amounts)
            consistency = 0
            if len(recs) >= 2:
                amounts = [float(r.get("amount", 0)) for r in recs if r.get("amount")]
                if amounts:
                    consistency = np.std(amounts)

            # Subscription age
            age_days = 30
            if sub.get("first_receipt_date"):
                try:
                    first = datetime.fromisoformat(sub["first_receipt_date"])
                    age_days = (today - first).days
                except Exception:
                    pass

            features.append([
                amount, total_receipts, days_since,
                frequency, total_spent, consistency, age_days
            ])
            sub_refs.append(sub)

        X = np.array(features)
        X_scaled = self.scaler.fit_transform(X)

        # Determine optimal K using elbow method
        n_clusters = min(4, len(subscriptions))
        elbow_data = []

        for k in range(2, min(7, len(subscriptions))):
            km = KMeans(n_clusters=k, n_init=10, random_state=42)
            km.fit(X_scaled)
            elbow_data.append({"k": k, "inertia": round(float(km.inertia_), 2)})

        # Fit final model
        model = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        labels = model.fit_predict(X_scaled)

        # Assign meaningful labels based on centroid characteristics
        cluster_stats = {}
        for c_id in range(n_clusters):
            mask = labels == c_id
            cluster_features = X[mask]
            if len(cluster_features) > 0:
                cluster_stats[c_id] = {
                    "avg_days_since": np.mean(cluster_features[:, 2]),
                    "avg_receipts": np.mean(cluster_features[:, 1]),
                    "avg_frequency": np.mean(cluster_features[:, 3]),
                    "count": int(np.sum(mask))
                }

        # Sort clusters by "engagement" (lower days_since + higher receipts = more engaged)
        sorted_clusters = sorted(
            cluster_stats.items(),
            key=lambda x: x[1]["avg_days_since"] - x[1]["avg_receipts"] * 10
        )

        # Map original cluster IDs to our ordered labels
        label_map = {}
        for order_idx, (orig_id, _) in enumerate(sorted_clusters):
            label_map[orig_id] = min(order_idx, 3)

        # Build results
        results = []
        for i, sub in enumerate(sub_refs):
            orig_label = int(labels[i])
            mapped_label = label_map.get(orig_label, 0)
            label_info = self.CLUSTER_LABELS.get(mapped_label, self.CLUSTER_LABELS[0])

            results.append({
                "subscriptionId": sub["id"],
                "serviceName": sub.get("service_name", "Unknown"),
                "clusterId": mapped_label,
                "clusterLabel": label_info["label"],
                "clusterColor": label_info["color"],
                "clusterEmoji": label_info["emoji"],
                "features": {
                    "amount": features[i][0],
                    "totalReceipts": features[i][1],
                    "daysSinceLastReceipt": features[i][2],
                    "receiptFrequency": round(features[i][3], 1),
                    "totalSpent": features[i][4],
                }
            })

        return {
            "clusters": results,
            "clusterSummary": [
                {
                    "id": mapped_id,
                    **self.CLUSTER_LABELS.get(mapped_id, {}),
                    "count": stats["count"]
                }
                for mapped_id, stats in [
                    (label_map[orig_id], stats)
                    for orig_id, stats in cluster_stats.items()
                ]
            ],
            "elbowData": elbow_data,
            "optimalK": n_clusters
        }

    def _fallback(self, subscriptions: list) -> dict:
        """Simple rule-based fallback for < 4 subscriptions"""
        results = []
        for sub in (subscriptions or []):
            days_since = 365
            if sub.get("last_receipt_date"):
                try:
                    days_since = (datetime.utcnow() - datetime.fromisoformat(sub["last_receipt_date"])).days
                except Exception:
                    pass

            if days_since <= 35:
                cluster = 0
            elif days_since <= 90:
                cluster = 1
            elif days_since <= 180:
                cluster = 2
            else:
                cluster = 3

            label_info = self.CLUSTER_LABELS.get(cluster, self.CLUSTER_LABELS[0])
            results.append({
                "subscriptionId": sub["id"],
                "serviceName": sub.get("service_name", "Unknown"),
                "clusterId": cluster,
                "clusterLabel": label_info["label"],
                "clusterColor": label_info["color"],
                "clusterEmoji": label_info["emoji"],
                "features": {}
            })

        return {
            "clusters": results,
            "clusterSummary": [],
            "elbowData": [],
            "optimalK": 0
        }
