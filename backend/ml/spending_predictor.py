# backend/ml/spending_predictor.py
# XGBoost Spending Prediction

import numpy as np
from datetime import datetime


class SpendingPredictor:
    """
    Predicts future spending using XGBoost with 14 engineered features.
    Falls back to moving average if insufficient data or XGBoost unavailable.
    """

    def __init__(self):
        self.model = None
        self.feature_names = [
            "month", "quarter", "is_year_end",
            "active_sub_count", "new_subs_this_month", "cancelled_subs_this_month",
            "spend_lag_1", "spend_lag_2", "spend_lag_3",
            "rolling_mean_3m", "rolling_std_3m", "spend_trend",
            "avg_sub_amount", "max_sub_amount"
        ]

    def predict(self, subscriptions: list, receipts: list) -> dict:
        """Generate spending predictions"""
        if not receipts or len(receipts) < 2:
            return self._fallback_prediction(subscriptions)

        # Build monthly totals from receipts
        monthly_data = self._build_monthly_data(receipts, subscriptions)

        if len(monthly_data) < 3:
            return self._fallback_prediction(subscriptions)

        try:
            return self._xgboost_predict(monthly_data, subscriptions)
        except Exception as e:
            print(f"XGBoost prediction failed: {e}, using fallback")
            return self._fallback_prediction(subscriptions)

    def _build_monthly_data(self, receipts: list, subscriptions: list) -> list:
        """Group receipts into monthly totals"""
        monthly = {}
        for r in receipts:
            if r.get("receipt_date"):
                month_key = r["receipt_date"][:7]  # YYYY-MM
                monthly[month_key] = monthly.get(month_key, 0) + float(r.get("amount", 0))

        # Sort by month
        sorted_months = sorted(monthly.items(), key=lambda x: x[0])
        return [{"month": m, "total": t} for m, t in sorted_months]

    def _xgboost_predict(self, monthly_data: list, subscriptions: list) -> dict:
        """XGBoost-based prediction with feature engineering"""
        from xgboost import XGBRegressor

        totals = [d["total"] for d in monthly_data]
        months_str = [d["month"] for d in monthly_data]

        # Build features for each month
        X = []
        y = []
        active_count = len(subscriptions)

        for i in range(3, len(totals)):
            month_num = int(months_str[i].split("-")[1])
            quarter = (month_num - 1) // 3 + 1
            is_year_end = 1 if month_num in [12, 1] else 0

            features = [
                month_num,                          # month
                quarter,                            # quarter
                is_year_end,                        # is_year_end
                active_count,                       # active_sub_count
                0,                                  # new_subs_this_month (estimated)
                0,                                  # cancelled_subs_this_month
                totals[i - 1],                      # spend_lag_1
                totals[i - 2],                      # spend_lag_2
                totals[i - 3],                      # spend_lag_3
                np.mean(totals[i - 3:i]),           # rolling_mean_3m
                np.std(totals[i - 3:i]) if len(totals[i-3:i]) > 1 else 0,  # rolling_std_3m
                1 if totals[i - 1] > totals[i - 2] else -1,  # spend_trend
                np.mean([float(s.get("amount", 0)) for s in subscriptions]),  # avg_sub_amount
                max([float(s.get("amount", 0)) for s in subscriptions]) if subscriptions else 0,  # max_sub_amount
            ]

            X.append(features)
            y.append(totals[i])

        if len(X) < 2:
            return self._fallback_prediction(subscriptions)

        X = np.array(X)
        y = np.array(y)

        # Train XGBoost
        self.model = XGBRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            reg_alpha=0.1,
            random_state=42
        )
        self.model.fit(X, y)

        # Predict next 3 months
        predictions = []
        last_3 = list(totals[-3:])

        for future_offset in range(1, 4):
            now = datetime.utcnow()
            future_month = ((now.month - 1 + future_offset) % 12) + 1
            future_quarter = (future_month - 1) // 3 + 1

            future_features = np.array([[
                future_month,
                future_quarter,
                1 if future_month in [12, 1] else 0,
                active_count,
                0, 0,
                last_3[-1], last_3[-2], last_3[-3],
                np.mean(last_3),
                np.std(last_3) if len(last_3) > 1 else 0,
                1 if last_3[-1] > last_3[-2] else -1,
                np.mean([float(s.get("amount", 0)) for s in subscriptions]),
                max([float(s.get("amount", 0)) for s in subscriptions]) if subscriptions else 0,
            ]])

            pred = float(self.model.predict(future_features)[0])
            predictions.append(round(max(pred, 0), 2))
            last_3.append(pred)
            last_3 = last_3[-3:]

        # Feature importance
        importance = {}
        if hasattr(self.model, "feature_importances_"):
            for name, imp in zip(self.feature_names, self.model.feature_importances_):
                importance[name] = round(float(imp), 4)

        # Calculate metrics
        y_pred = self.model.predict(X)
        mae = float(np.mean(np.abs(y - y_pred)))
        rmse = float(np.sqrt(np.mean((y - y_pred) ** 2)))
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0

        # Trend
        slope = (totals[-1] - totals[0]) / len(totals) if len(totals) > 1 else 0

        return {
            "next3Months": predictions,
            "trend": "increasing" if slope > 50 else "decreasing" if slope < -50 else "stable",
            "confidence": round(max(min(r2, 1), 0), 2),
            "featureImportance": importance,
            "metrics": {"mae": round(mae, 2), "rmse": round(rmse, 2), "r2": round(r2, 4)},
            "historicalMonthly": [{"month": d["month"], "amount": d["total"]} for d in monthly_data],
            "model": "XGBoost"
        }

    def _fallback_prediction(self, subscriptions: list) -> dict:
        """Simple prediction when insufficient data"""
        monthly_total = sum(float(s.get("amount", 0)) for s in subscriptions)
        return {
            "next3Months": [round(monthly_total, 2)] * 3,
            "trend": "stable",
            "confidence": 0.5,
            "featureImportance": {},
            "metrics": {"mae": 0, "rmse": 0, "r2": 0},
            "historicalMonthly": [],
            "model": "fallback_average"
        }
