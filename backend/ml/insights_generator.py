# backend/ml/insights_generator.py
# Groq LLM-powered insights generation

from groq import Groq
from config.settings import get_settings

settings = get_settings()
groq_client = Groq(api_key=settings.GROQ_API_KEY)


class InsightsGenerator:
    """
    Takes outputs from all 4 ML models and generates
    human-readable insights using Groq LLM (Llama 3.1).
    """

    async def generate(
        self,
        subscriptions: list,
        anomalies: list,
        predictions: dict,
        clusters: dict,
        classifier_metrics: dict
    ) -> dict:
        """Generate comprehensive AI insights from all ML outputs"""
        try:
            return await self._llm_insights(
                subscriptions, anomalies, predictions, clusters, classifier_metrics
            )
        except Exception as e:
            print(f"LLM insights failed: {e}")
            return self._template_fallback(
                subscriptions, anomalies, predictions, clusters
            )

    async def _llm_insights(
        self,
        subscriptions: list,
        anomalies: list,
        predictions: dict,
        clusters: dict,
        classifier_metrics: dict
    ) -> dict:
        """Generate insights using Groq LLM"""
        total_monthly = sum(float(s.get("amount", 0)) for s in subscriptions)
        total_yearly = total_monthly * 12

        # Cluster summary
        cluster_summary_parts = []
        for c in (clusters.get("clusterSummary") or []):
            cluster_summary_parts.append(f"{c.get('emoji', '')} {c.get('label', '')}: {c.get('count', 0)} subscriptions")
        cluster_text = "\n".join(cluster_summary_parts) if cluster_summary_parts else "No clustering data"

        # Anomaly summary
        anomaly_text = "None detected"
        if anomalies:
            anomaly_parts = []
            for a in anomalies[:5]:
                anomaly_parts.append(
                    f"- {a['serviceName']}: Expected ₹{a['expectedAmount']}, Got ₹{a['actualAmount']} ({a['type']})"
                )
            anomaly_text = "\n".join(anomaly_parts)

        # Unused subscriptions
        unused = [
            c for c in (clusters.get("clusters") or [])
            if c.get("clusterId") in [2, 3]
        ]
        unused_text = ", ".join([u["serviceName"] for u in unused]) if unused else "None"
        potential_savings = sum(
            float(next((s.get("amount", 0) for s in subscriptions if s["id"] == u["subscriptionId"]), 0))
            for u in unused
        )

        prompt = f"""You are a personal finance AI assistant analyzing subscription data. Be concise and actionable.

USER'S SUBSCRIPTION DATA:
- Active subscriptions: {len(subscriptions)}
- Monthly spending: ₹{round(total_monthly)}
- Yearly spending: ₹{round(total_yearly)}

SPENDING PREDICTION (XGBoost):
- Next 3 months: ₹{predictions.get('next3Months', [0,0,0])}
- Trend: {predictions.get('trend', 'stable')}
- Model confidence (R²): {predictions.get('confidence', 0)}

ANOMALIES DETECTED (Isolation Forest):
{anomaly_text}

SUBSCRIPTION CLUSTERS (K-Means):
{cluster_text}

POTENTIALLY UNUSED SUBSCRIPTIONS:
{unused_text}
Potential monthly savings: ₹{round(potential_savings)}

EMAIL CLASSIFIER PERFORMANCE:
F1 Score: {classifier_metrics.get('f1Score', 0)}
Accuracy: {classifier_metrics.get('accuracy', 0)}

Respond with ONLY this JSON (no other text):
{{
  "healthScore": <0-100 integer>,
  "summary": "<2-3 sentence personalized financial health summary>",
  "recommendations": [
    "<actionable recommendation 1>",
    "<actionable recommendation 2>",
    "<actionable recommendation 3>"
  ],
  "estimatedMonthlySavings": <number>,
  "riskLevel": "<low|medium|high>"
}}"""

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a financial AI. Respond with ONLY valid JSON. No markdown, no explanation."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0
        )

        text = response.choices[0].message.content.strip()

        import json
        import re

        # Clean and parse JSON
        clean = re.sub(r"```json\s*", "", text)
        clean = re.sub(r"```\s*", "", clean).strip()

        try:
            result = json.loads(clean)
        except Exception:
            # Try extracting JSON object
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                result = json.loads(match.group(0))
            else:
                raise ValueError("Could not parse LLM response")

        return {
            "healthScore": max(0, min(100, int(result.get("healthScore", 50)))),
            "summary": result.get("summary", "Analysis complete."),
            "recommendations": result.get("recommendations", [])[:3],
            "estimatedMonthlySavings": round(float(result.get("estimatedMonthlySavings", potential_savings)), 2),
            "riskLevel": result.get("riskLevel", "medium"),
            "source": "groq_llm"
        }

    def _template_fallback(
        self,
        subscriptions: list,
        anomalies: list,
        predictions: dict,
        clusters: dict
    ) -> dict:
        """Template-based fallback when LLM fails"""
        total_monthly = sum(float(s.get("amount", 0)) for s in subscriptions)
        n_subs = len(subscriptions)

        unused = [
            c for c in (clusters.get("clusters") or [])
            if c.get("clusterId") in [2, 3]
        ]
        n_unused = len(unused)
        potential_savings = sum(
            float(next((s.get("amount", 0) for s in subscriptions if s["id"] == u["subscriptionId"]), 0))
            for u in unused
        )

        # Health score
        score = 75
        if n_unused > 2:
            score -= 15
        if anomalies:
            score -= len(anomalies) * 5
        if total_monthly > 5000:
            score -= 10
        score = max(10, min(100, score))

        # Recommendations
        recs = []
        if n_unused > 0:
            unused_names = ", ".join([u["serviceName"] for u in unused[:3]])
            recs.append(f"Consider cancelling unused subscriptions: {unused_names}. You could save ₹{round(potential_savings)}/month.")
        if anomalies:
            recs.append(f"Review {len(anomalies)} billing anomalies detected — check for price hikes or double charges.")
        if total_monthly > 3000:
            recs.append("Your monthly subscription spending is above average. Review each service for value.")
        if not recs:
            recs.append("Your subscription spending looks healthy! Keep monitoring for changes.")

        summary = f"You have {n_subs} active subscriptions costing ₹{round(total_monthly)}/month (₹{round(total_monthly * 12)}/year). "
        if n_unused > 0:
            summary += f"{n_unused} subscriptions appear to be unused and could be cancelled to save ₹{round(potential_savings)}/month."
        else:
            summary += "All subscriptions appear to be actively used."

        return {
            "healthScore": score,
            "summary": summary,
            "recommendations": recs[:3],
            "estimatedMonthlySavings": round(potential_savings, 2),
            "riskLevel": "high" if score < 40 else "medium" if score < 70 else "low",
            "source": "template_fallback"
        }
