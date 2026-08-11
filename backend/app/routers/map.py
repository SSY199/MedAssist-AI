import httpx
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.config import settings
from app.core.security import get_current_user

router = APIRouter(prefix="/map", tags=["map"])

# Map UI category keys directly to Mapbox text query fields
CATEGORY_QUERIES = {
    "hospital": "hospital",
    "pharmacy": "pharmacy",
    "clinic": "medical clinic",
    "lab": "diagnostic laboratory",
    "er": "emergency room",
}

@router.get("/nearby")
async def get_nearby_facilities(
    lat: float = Query(...),
    lng: float = Query(...),
    category: str = Query(..., description="hospital | pharmacy | clinic | lab | er"),
    user: dict = Depends(get_current_user),
):
    if category not in CATEGORY_QUERIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")

    mapbox_token = os.getenv("MAPBOX_ACCESS_TOKEN")
    if not mapbox_token:
        raise HTTPException(status_code=500, detail="Mapbox credentials misconfigured in environment variables.")

    query_text = CATEGORY_QUERIES[category]
    
    # Mapbox V6 Forward Search/POI Geocoding API endpoint setup
    url = f"https://mapbox.com"
    
    params = {
        "q": query_text,
        "proximity": f"{lng},{lat}", # Mapbox formats spatial queries via [Lng, Lat] sequencing order
        "access_token": mapbox_token,
        "limit": 15
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Downstream spatial processing API error.")
            
            data = response.json()
            
            # Map structural components parsing data formats directly for frontend UI expectations
            transformed_facilities = []
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                geometry = feature.get("geometry", {})
                coordinates = geometry.get("coordinates", [lng, lat]) # fallback
                
                transformed_facilities.append({
                    "id": props.get("mapbox_id", feature.get("id")),
                    "name": props.get("name", "Unknown Healthcare Provider"),
                    "address": props.get("full_address", props.get("address", "Address Not Disclosed")),
                    "lat": coordinates[1], # Extraction index corresponding to Latitude coordinate vector map configurations
                    "lng": coordinates[0], # Longitude coordinate vector map extraction mapping element index 0
                    "rating": round(props.get("poi_rating", 4.2), 1) if "hospital" in query_text else None, # Mock fallback validation
                    "openNow": True if props.get("operational_status") != "closed" else False
                })
                
            return transformed_facilities
            
        except httpx.RequestError as exc:
            raise HTTPException(status_code=500, detail=f"Downstream structural request network timeout: {exc}")
