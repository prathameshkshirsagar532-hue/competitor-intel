import os
import json
import re
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
print("KEY LOADED:", GEMINI_API_KEY[:10] if GEMINI_API_KEY else "NONE FOUND")

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={GEMINI_API_KEY}"


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
    company_domain = data.get("companyDomain", "").strip()
    competitors = data.get("competitors", [])

    if not company_name or not competitors:
        return jsonify({"error": "Missing company name or competitors"}), 400

    comp_list = "; ".join(
        f"{c.get('name','')} ({c.get('domain','')})" if c.get("domain") else c.get("name", "")
        for c in competitors
    )

    prompt = f"""You are a competitive intelligence analyst. Use your knowledge to research the following company and its competitors, then respond with ONLY valid JSON — no markdown fences, no commentary before or after — matching exactly this schema:

{{
  "company": {{"name": string, "summary": string (max 20 words)}},
  "competitors": [
    {{
      "name": string,
      "domain": string,
      "threat_level": "Low" | "Medium" | "High",
      "positioning": string (max 22 words),
      "strengths": [string, string] (max 7 words each),
      "weaknesses": [string, string] (max 7 words each),
      "recent_moves": [string, string] (max 10 words each),
      "pricing_signal": string (max 14 words)
    }}
  ],
  "comparison_matrix": {{
    "dimensions": [string, string, string, string],
    "rows": {{ "CompanyOrCompetitorName": [string, string, string, string] (max 5 words each, one row per company AND per competitor) }}
  }},
  "recommendations": [string, string, string] (max 16 words each)
}}

Keep every string short, punchy, analyst-briefing tone. No fluff.

Subject company: {company_name}{f' ({company_domain})' if company_domain else ''}.
Competitors to investigate: {comp_list}."""

    try:
        response = requests.post(
            GEMINI_URL,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
            },
            timeout=90,
        )
        response.raise_for_status()
        result = response.json()

        candidates = result.get("candidates", [])
        if not candidates:
            return jsonify({"error": "No response from Gemini", "raw": result}), 502

        parts = candidates[0].get("content", {}).get("parts", [])
        full_text = "\n".join(p.get("text", "") for p in parts).strip()

        full_text = re.sub(r"^```json\s*", "", full_text)
        full_text = re.sub(r"^```\s*", "", full_text)
        full_text = re.sub(r"```\s*$", "", full_text)

        first_brace = full_text.find("{")
        last_brace = full_text.rfind("}")
        if first_brace == -1 or last_brace == -1:
            return jsonify({"error": "No JSON found in AI response", "raw_text": full_text}), 502

        json_str = full_text[first_brace:last_brace + 1]
        parsed = json.loads(json_str)
        return jsonify(parsed)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Request to Gemini API failed: {str(e)}"}), 502
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Could not parse AI response as JSON: {str(e)}", "raw_text": full_text}), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)
