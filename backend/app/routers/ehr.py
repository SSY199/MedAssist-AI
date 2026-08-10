from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter(prefix="/ehr", tags=["ehr"])


@router.get("/me")
def get_my_profile(user: dict = Depends(get_current_user)):
    """
    user["sub"] is the Better-Auth user ID — use it to look up
    the matching document in your "patientProfiles" MongoDB collection.
    """
    return {"user_id": user["sub"], "email": user.get("email")}