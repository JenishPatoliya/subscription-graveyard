# backend/routes/insights.py
# ML Insights endpoint — calls all 5 ML models

from fastapi import APIRouter, Depends, HTTPException

from config.database import supabase
from middleware.auth import get_current_user
from ml.anomaly_detector import SubscriptionAnomalyDetector
from ml.spending_predictor import SpendingPredictor
from ml.subscription_clusterer import SubscriptionClusterer
from ml.email_classifier import EmailClassifier
from ml.insights_generator import InsightsGenerator

router = APIRouter()

# Initialize ML models (singleton instances)
anomaly_detector = SubscriptionAnomalyDetector()
spending_predictor = SpendingPredictor()
subscription_clusterer = SubscriptionClusterer()
email_classifier = EmailClassifier()
insights_generator = InsightsGenerator()


@router.get("/")
async def get_insights(user: dict = Depends(get_current_user)):
    """
    Run all 5 ML models on user's subscription data.
    Returns: anomalies, predictions, clusters, classifier metrics, AI insights.
    """
    try:
        # ─── Fetch user data ───
        subs_result = supabase.table("subscriptions") \
            .select("*") \
            .eq("user_id", user["userId"]) \
            .execute()

        receipts_result = supabase.table("receipts") \
            .select("*") \
            .eq("user_id", user["userId"]) \
            .order("receipt_date", desc=True) \
            .execute()

        subscriptions = subs_result.data or []
        receipts = receipts_result.data or []

        if not subscriptions:
            return {
                "anomalies": [],
                "predictions": {"next3Months": [0, 0, 0], "trend": "stable", "confidence": 0, "featureImportance": {}, "metrics": {}, "historicalMonthly": [], "model": "none"},
                "clusters": {"clusters": [], "clusterSummary": [], "elbowData": [], "optimalK": 0},
                "classifierMetrics": email_classifier._generate_demo_metrics(),
                "insights": {"healthScore": 50, "summary": "Connect Gmail and scan emails to get AI insights.", "recommendations": ["Connect your Gmail to start"], "estimatedMonthlySavings": 0, "riskLevel": "low", "source": "empty"}
            }

        # ─── Run all 5 ML models ───

        # 1. Isolation Forest — Anomaly Detection
        try:
            anomalies = anomaly_detector.detect(subscriptions, receipts)
        except Exception as e:
            print(f"Anomaly detection error: {e}")
            anomalies = []

        # 2. XGBoost — Spending Prediction
        try:
            predictions = spending_predictor.predict(subscriptions, receipts)
        except Exception as e:
            print(f"Spending prediction error: {e}")
            predictions = spending_predictor._fallback_prediction(subscriptions)

        # 3. K-Means — Subscription Clustering
        try:
            clusters = subscription_clusterer.cluster(subscriptions, receipts)
        except Exception as e:
            print(f"Clustering error: {e}")
            clusters = subscription_clusterer._fallback(subscriptions)

        # 4. TF-IDF + Random Forest — Email Classification
        try:
            # Build training data from receipts (subscription emails) and generate negative samples
            email_texts = []
            for r in receipts:
                text = r.get("raw_subject", "") or ""
                if text:
                    email_texts.append({"text": text, "label": 1})

            # Generate negative samples (common non-subscription subjects)
            negative_samples = [
                "Weekly newsletter digest", "Your order has been shipped",
                "Verify your email address", "New login from Chrome",
                "Check out these deals", "Your OTP is 123456",
                "Welcome to our platform", "Job alert: 5 new matches",
                "Market update: Nifty rises", "Your credit card statement",
                "Free trial available", "Special offer just for you",
                "We miss you!", "Tips for productivity",
                "Your delivery is arriving today", "Payment failed - update card",
                "New follower notification", "Someone commented on your post",
                "Weekly insights report", "Your portfolio summary",
            ]
            for ns in negative_samples:
                email_texts.append({"text": ns, "label": 0})

            classifier_metrics = email_classifier.train_and_evaluate(email_texts)
        except Exception as e:
            print(f"Email classifier error: {e}")
            classifier_metrics = email_classifier._generate_demo_metrics()

        # 5. Groq LLM — AI Insights
        try:
            insights = await insights_generator.generate(
                subscriptions, anomalies, predictions, clusters, classifier_metrics
            )
        except Exception as e:
            print(f"Insights generation error: {e}")
            insights = insights_generator._template_fallback(
                subscriptions, anomalies, predictions, clusters
            )

        # ─── Update subscription records with ML data ───
        try:
            for cluster_item in (clusters.get("clusters") or []):
                supabase.table("subscriptions").update({
                    "usage_score": cluster_item.get("clusterId", 0) * 25,
                    "usage_label": cluster_item.get("clusterLabel", "Unknown"),
                    "cluster_id": cluster_item.get("clusterId", 0)
                }).eq("id", cluster_item["subscriptionId"]).execute()
        except Exception as e:
            print(f"DB update error (non-fatal): {e}")

        return {
            "anomalies": anomalies,
            "predictions": predictions,
            "clusters": clusters,
            "classifierMetrics": classifier_metrics,
            "insights": insights
        }

    except Exception as err:
        print(f"Insights error: {err}")
        raise HTTPException(status_code=500, detail="Failed to generate insights")
