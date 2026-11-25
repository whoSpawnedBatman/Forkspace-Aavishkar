"""Create three synthetic demo snippets through the authenticated API."""

import os
from pathlib import Path

import httpx
import yaml


def main():
    sample = yaml.safe_load(
        Path(__file__).with_name("openapi.yaml").read_text("utf-8")
    )["paths"]["/snippets"]["post"]["requestBody"]["content"]["application/json"][
        "example"
    ]
    with httpx.Client(
        base_url=os.environ.get("SEED_API_URL", "http://localhost:8000"),
        headers={"Authorization": "Bearer " + os.environ["SEED_OWNER_TOKEN"]},
    ) as api:
        for visibility in ("public", "unlisted", "private"):
            result = api.post("/snippets", json=dict(sample, visibility=visibility))
            result.raise_for_status()
            print(visibility, result.json()["id"])


if __name__ == "__main__":
    main()
