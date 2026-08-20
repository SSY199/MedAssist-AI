# import httpx
# from fastapi import APIRouter, Depends, HTTPException, Query
# from typing import List, Dict, Any, Optional
# from pydantic import BaseModel

# from app.core.config import settings
# from app.core.security import get_current_user

# router = APIRouter(prefix="/map", tags=["map"])

# categories_queries = {
#     "hospital": "hospital",
#     "pharmacy": "24 hour pharmacy",
#     "clinic": "medical clinic",
#     "lab": "medical laboratory",
#     "er": "emergency room"
# }

# class FacilityResponse(BaseModel):
#     id: str
#     name: str
#     address: str
#     lat: float
#     lng: float
#     rating: Optional[float] = None
#     openNow: Optional[bool] = None

# @router.get("/nearby", response_model=List[FacilityResponse])
# async def get_nearby_facilities(
#     lat: float = Query(..., description="Latitude of user"),
#     lng: float = Query(..., description="Longitude of user"),
#     category: str = Query("hospital", description="Search category category"),
#     current_user: Any = Depends(get_current_user)
# ):
#     search_text = categories_queries.get(category, "hospital")
    
#     # Target endpoint for Google Places API (New) TextSearch engine
#     url = "https://googleapis.com"
    
#     # Modernized FieldMask configuration required by Google V1 Places API
#     headers = {
#         "Content-Type": "application/json",
#         "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
#         "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.regularOpeningHours.openNow"
#     }
    
#     # Establish dynamic circular location restriction zone biased around the user (e.g., 5000m radius)
#     payload = {
#         "textQuery": search_text,
#         "locationBias": {
#             "circle": {
#                 "center": {
#                     "latitude": lat,
#                     "longitude": lng
#                 },
#                 "radius": 5000.0
#             }
#         }
#     }
    
#     async with httpx.AsyncClient() as client:
#         try:
#             response = await client.post(url, json=payload, headers=headers, timeout=10.0)
#             response.raise_for_status()
#             data = response.json()
#         except httpx.HTTPStatusError as exc:
#             raise HTTPException(status_code=exc.response.status_code, detail="Google Places API communication error.")
#         except Exception:
#             raise HTTPException(status_code=500, detail="Internal server map engine timeout failure.")

#     places = data.get("places", [])
#     results = []
    
#     for place in places:
#         loc = place.get("location", {})
#         opening_hours = place.get("regularOpeningHours", {})
        
#         results.append(
#             FacilityResponse(
#                 id=place.get("id", ""),
#                 name=place.get("displayName", {}).get("text", "Unknown Facility"),
#                 address=place.get("formattedAddress", "Address Unavailable"),
#                 lat=loc.get("latitude", 0.0),
#                 lng=loc.get("longitude", 0.0),
#                 rating=place.get("rating"),
#                 openNow=opening_hours.get("openNow") if "openNow" in opening_hours else None
#             )
#         )
        
#     return results
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.security import get_current_user

router = APIRouter(prefix="/map", tags=["map"])

# Mapbox's Search Box API doesn't have a fixed category ID for every one of
# our UI categories, so we use the "forward" (text) search endpoint uniformly
# with proximity bias — same approach the Google version used, and it doesn't
# depend on guessing Mapbox's exact canonical-category taxonomy.
categories_queries = {
    "hospital": "hospital",
    "pharmacy": "24 hour pharmacy",
    "clinic": "medical clinic",
    "lab": "diagnostic laboratory",
    "er": "emergency room",
}

SEARCH_URL = "https://api.mapbox.com/search/searchbox/v1/forward"


@router.get("/nearby")
async def get_nearby_facilities(
    lat: float = Query(...),
    lng: float = Query(...),
    category: str = Query(..., description="hospital | pharmacy | clinic | lab | er"),
    user: dict = Depends(get_current_user),
):
    if category not in categories_queries:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")

    query = categories_queries[category]

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                SEARCH_URL,
                params={
                    "q": query,
                    "proximity": f"{lng},{lat}",  # Mapbox wants [lng, lat] order
                    "access_token": settings.MAPBOX_ACCESS_TOKEN,
                    "limit": 10,
                },
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Mapbox request failed: {exc}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Mapbox API error ({response.status_code}): {response.text}",
        )

    data = response.json()
    facilities = []

    for feature in data.get("features", []):
        props = feature.get("properties", {})
        coordinates = feature.get("geometry", {}).get("coordinates")
        if not coordinates:
            continue  # skip results with no usable location

        facilities.append(
            {
                "id": props.get("mapbox_id", feature.get("id")),
                "name": props.get("name", "Unknown"),
                "address": props.get("full_address") or props.get("place_formatted", ""),
                "lat": coordinates[1],
                "lng": coordinates[0],
                # Mapbox's Search Box API doesn't return ratings or live
                # open/closed status. Returning null (not a guess) — the
                # frontend already hides these badges when null.
                "rating": None,
                "openNow": None,
            }
        )

    return facilities