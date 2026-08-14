import os
import json
import re
import time
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
print("KEY LOADED:", GEMINI_API_KEY[:10] if GEMINI_API_KEY else "NONE FOUND")

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/form")
def form():
    return render_template("form.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()

    company_name = data.get("companyName", "").strip()
    competitors = data.get("competitors", [])

    if not company_name or not competitors:
        return jsonify({"error": "Missing company name or competitors"}), 400


    # TEMPORARY MOCK DATA — replace this block with the real Gemini call later.
    time.sleep(3)  # simulates research taking a moment

    mock_result = {
        "company": {
            "name": company_name,
            "summary": f"{company_name} is a fast-growing player carving out its own niche in a crowded market."
        },
        "competitors": [],
        "comparison_matrix": {
            "dimensions": ["Pricing", "Target market", "Core strength", "Momentum"],
            "rows": {}
        },
        "recommendations": [
            "Double down on your strongest differentiator before competitors catch up.",
            "Watch pricing moves closely over the next two quarters.",
            "Consider a focused campaign around your top weakness area."
        ]
    }

    threat_levels = ["Low", "Medium", "High"]
    for i, c in enumerate(competitors):
        name = c.get("name", "Unknown")
        domain = c.get("domain", "")
        mock_result["competitors"].append({
            "name": name,
            "domain": domain,
            "threat_level": threat_levels[i % 3],
            "positioning": f"{name} positions itself as a premium alternative with a focus on enterprise buyers.",
            "strengths": ["Strong brand recognition", "Established customer base"],
            "weaknesses": ["Higher pricing tier", "Slower feature releases"],
            "recent_moves": ["Launched a new integration", "Raised prices on top plan"],
            "pricing_signal": "Mid-to-high pricing, annual contracts favored."
        })
        mock_result["comparison_matrix"]["rows"][name] = ["$$$", "Enterprise", "Brand trust", "Steady"]

    mock_result["comparison_matrix"]["rows"][company_name] = ["$$", "SMB & mid-market", "Agility", "Rising"]

    return jsonify(mock_result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)