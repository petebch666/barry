"""
Standalone sanity check for the Overpass query used by
supabase/functions/fetch-nearby-places/index.ts — runs the exact same
query directly against Overpass, with no Supabase/webhook plumbing, to
verify Overpass itself returns data for a given coordinate.

Usage: python scripts/overpass_test.py
"""
import json
import urllib.request
import urllib.parse

LATITUDE = 48.90532288698502
LONGITUDE = 2.338147166002216

SEARCH_RADIUS_M = 400
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def build_query(lat: float, lng: float, radius_m: int) -> str:
    return "\n".join([
        "[out:json][timeout:25];",
        "(",
        f'  node["amenity"~"^(restaurant|bar)$"](around:{radius_m},{lat},{lng});',
        f'  way["amenity"~"^(restaurant|bar)$"](around:{radius_m},{lat},{lng});',
        ");",
        "out body center;",
    ])


def fetch_elements(query: str) -> list[dict]:
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BarryApp/1.0 (social meetup app)",
    }

    for mirror in OVERPASS_MIRRORS:
        try:
            req = urllib.request.Request(mirror, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as res:
                if res.status != 200:
                    print(f"Mirror {mirror} returned status {res.status}")
                    continue
                data = json.loads(res.read().decode("utf-8"))
                return data.get("elements", [])
        except Exception as err:
            print(f"Mirror {mirror} failed: {err}")

    return []


def parse_element(el: dict) -> dict | None:
    if el.get("type") == "node":
        lat, lon = el.get("lat"), el.get("lon")
    else:
        center = el.get("center") or {}
        lat, lon = center.get("lat"), center.get("lon")

    tags = el.get("tags") or {}
    name = tags.get("name")
    if lat is None or lon is None or not name:
        return None

    return {
        "name": name,
        "category": tags.get("amenity"),
        "latitude": lat,
        "longitude": lon,
    }


def main() -> None:
    query = build_query(LATITUDE, LONGITUDE, SEARCH_RADIUS_M)
    print(f"Querying Overpass for restaurant|bar within {SEARCH_RADIUS_M}m of "
          f"({LATITUDE}, {LONGITUDE})...\n")

    elements = fetch_elements(query)
    print(f"Raw elements returned: {len(elements)}")

    places = [p for p in (parse_element(el) for el in elements) if p is not None]
    print(f"Parsed places (with a name): {len(places)}\n")

    for place in places:
        print(f"- {place['name']} ({place['category']}) "
              f"@ {place['latitude']}, {place['longitude']}")


if __name__ == "__main__":
    main()
