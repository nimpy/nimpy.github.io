#!/usr/bin/env python3
"""
Extract words from the site's HTML files, embed them via the Trellis API
(text-embedding-3-large), reduce to 3D with PCA, and write js/word-data.json.

Usage:
    python scripts/generate-embeddings.py

Reads TRELLIS_API_KEY and TRELLIS_API_BASE from .env in the repo root.
Run from the repo root whenever site content changes.
"""

import glob
import html
import json
import os
import re
import sys
import urllib.request

import numpy as np
from openai import OpenAI
from sklearn.decomposition import PCA

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(REPO_ROOT, "js", "word-data.json")

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "its", "this", "that", "are",
    "was", "were", "be", "been", "has", "have", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "can", "shall",
    "not", "no", "nor", "so", "if", "as", "up", "out", "about", "into",
    "than", "then", "too", "very", "just", "also", "more", "how", "all",
    "each", "every", "both", "few", "most", "other", "some", "such", "only",
    "own", "same", "over", "after", "before", "between", "through", "during",
    "under", "again", "further", "once", "here", "there", "when", "where",
    "why", "what", "which", "who", "whom", "these", "those", "am", "your",
    "you", "we", "our", "my", "me", "i", "he", "she", "they", "them",
    "his", "her", "him", "their", "us", "while", "because", "although",
    "since", "until", "unless", "yet", "still", "even", "though", "much",
    "many", "well", "back", "get", "got", "like", "make", "made",
}

HTML_FILES = [
    "index.html",
    "photos.html",
    "photos/*.html",
    "projects/*.html",
]

EXTERNAL_URLS = [
    "https://gaim.ugent.be/post/phd_nina/",
]

EXTERNAL_TEXT = """
Bancontact Company Penny AI assistant customer support tickets categorizes inquiries
generates personalized template responses human review Azure Cloud infrastructure
App Services OpenAI models Table Storage integrated Jira Confluence backlog reduced
eight thousand near zero response time improved working days agent satisfaction
jumped irreplaceable support team processed daily monthly informational requests
intervention categorize tickets personalized template based responses subject
human review deployed classification urgent common routing multi language

Start Run keeping runners injury free beginners typically run fast research
new runners quit first half year injuries lack motivation app scalable solution
sports lab manual testing machine learning processing speed heart rate data
personalized pace recommendations Sportinnovator grant initiative Long Short Term
Memory LSTM neural network analyzing running sequences intuitive app interface
personalized reports coach interactions cloud backend scalability launched
predictions lab tested safety margins user retention market positioning
Golazo Energy running sessions sports science expertise physiological
"""


def extract_text_from_html(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
    content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL)
    content = re.sub(r"<[^>]+>", " ", content)
    content = html.unescape(content)
    return content


def fetch_url(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  Warning: could not fetch {url}: {e}")
        return ""


def extract_text_from_string(content):
    content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
    content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL)
    content = re.sub(r"<[^>]+>", " ", content)
    content = html.unescape(content)
    return content


def extract_words():
    words = set()
    for pattern in HTML_FILES:
        for filepath in glob.glob(os.path.join(REPO_ROOT, pattern)):
            text = extract_text_from_html(filepath)
            tokens = re.findall(r"[a-zA-ZÀ-ɏ]{3,}", text)
            for t in tokens:
                w = t.lower()
                if w not in STOP_WORDS and len(w) >= 3:
                    words.add(w)
    for url in EXTERNAL_URLS:
        print(f"  Fetching {url}...")
        content = fetch_url(url)
        if content:
            text = extract_text_from_string(content)
            tokens = re.findall(r"[a-zA-ZÀ-ɏ]{3,}", text)
            for t in tokens:
                w = t.lower()
                if w not in STOP_WORDS and len(w) >= 3:
                    words.add(w)
    tokens = re.findall(r"[a-zA-ZÀ-ɏ]{3,}", EXTERNAL_TEXT)
    for t in tokens:
        w = t.lower()
        if w not in STOP_WORDS and len(w) >= 3:
            words.add(w)
    return sorted(words)


def get_embeddings(words, api_key, base_url, batch_size=100):
    client = OpenAI(
        base_url=base_url,
        api_key=api_key,
    )
    all_embeddings = []
    for i in range(0, len(words), batch_size):
        batch = words[i : i + batch_size]
        print(f"  Embedding batch {i // batch_size + 1} ({len(batch)} words)...")
        response = client.embeddings.create(
            model="text-embedding-3-large",
            input=batch,
        )
        for item in response.data:
            all_embeddings.append(item.embedding)
    return np.array(all_embeddings)


def reduce_to_3d(embeddings):
    pca = PCA(n_components=3)
    coords = pca.fit_transform(embeddings)
    # Normalize to [-1, 1] range
    for dim in range(3):
        mn, mx = coords[:, dim].min(), coords[:, dim].max()
        if mx - mn > 0:
            coords[:, dim] = 2 * (coords[:, dim] - mn) / (mx - mn) - 1
    return coords


def load_env():
    env_path = os.path.join(REPO_ROOT, ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip())


def main():
    load_env()
    api_key = os.environ.get("TRELLIS_API_KEY")
    if not api_key:
        print("Error: set TRELLIS_API_KEY in .env or as environment variable")
        sys.exit(1)

    print("Extracting words from HTML...")
    words = extract_words()
    print(f"  Found {len(words)} unique words")

    base_url = os.environ.get("TRELLIS_API_BASE", "https://api.openai.com/v1")
    print(f"Getting embeddings from {base_url}...")
    embeddings = get_embeddings(words, api_key, base_url)

    print("Reducing to 3D with PCA...")
    coords = reduce_to_3d(embeddings)

    data = []
    for i, word in enumerate(words):
        data.append({
            "w": word,
            "x": round(float(coords[i, 0]), 4),
            "y": round(float(coords[i, 1]), 4),
            "z": round(float(coords[i, 2]), 4),
        })

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))

    print(f"Wrote {len(data)} words to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
