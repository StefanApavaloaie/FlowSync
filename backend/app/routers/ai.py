import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from PIL import Image, ImageStat

from .. import models
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/assets", tags=["ai"])

UPLOAD_DIR = "uploads"


def _get_owned_asset_or_404(
    db: Session,
    user_id: int,
    asset_id: int,
) -> models.Asset:
    asset = (
        db.query(models.Asset)
        .join(models.Project, models.Asset.project_id == models.Project.id)
        .filter(
            models.Asset.id == asset_id,
            models.Project.owner_id == user_id,
        )
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    return asset


@router.get(
    "/{asset_id}/ai-suggestions",
    status_code=status.HTTP_200_OK,
)
def generate_ai_suggestions(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Generate heuristic 'AI' suggestions for a visual asset.

    This is intentionally deterministic and local:
    - loads the image
    - inspects brightness / contrast / color balance
    - returns structured suggestions for design review.

    In production you would replace this logic with a proper ML/LLM call.
    """
    asset = _get_owned_asset_or_404(db, current_user.id, asset_id)

    if not asset.file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset file path missing",
        )

    file_path = os.path.join(UPLOAD_DIR, asset.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset file not found on disk",
        )

    try:
        img = Image.open(file_path).convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to read image for analysis",
        )

    width, height = img.size
    stat = ImageStat.Stat(img)

    # Average brightness 0-255
    r, g, b = stat.mean
    brightness = (r + g + b) / 3.0

    # simple contrast estimate: mean absolute deviation
    contrast = sum(stat.var) / 3.0  # not true contrast but good enough signal

    # very rough color balance
    suggestions: List[str] = []

    # Layout / resolution
    if width < 800 or height < 800:
        suggestions.append(
            "Increase resolution; current size may appear soft on larger screens."
        )
    else:
        suggestions.append(
            "Resolution is sufficient for most web use; you can safely support retina displays."
        )

    # Brightness
    if brightness < 60:
        suggestions.append(
            "Image is very dark; consider lifting exposure or brightening midtones to reveal detail."
        )
    elif brightness < 90:
        suggestions.append(
            "Image leans dark; a slight exposure increase could improve clarity without losing mood."
        )
    elif brightness > 220:
        suggestions.append(
            "Image is very bright; reduce highlights to avoid washed-out areas."
        )
    elif brightness > 190:
        suggestions.append(
            "Image is on the brighter side; ensure key details are not clipping."
        )
    else:
        suggestions.append(
            "Overall brightness is balanced; no major exposure issues detected."
        )

    # Contrast heuristic
    if contrast < 300:
        suggestions.append(
            "Global contrast appears low; adding subtle contrast can improve separation between subject and background."
        )
    elif contrast > 2500:
        suggestions.append(
            "Contrast is very high; consider softening shadows/highlights for better tonal range."
        )
    else:
        suggestions.append(
            "Contrast is within a healthy range for web/composite use."
        )

    # Color cast heuristic
    if r > g + 10 and r > b + 10:
        suggestions.append(
            "Image has a warm/red cast; check skin tones and whites for accuracy."
        )
    elif b > r + 10 and b > g + 10:
        suggestions.append(
            "Image has a cool/blue cast; consider warming slightly for a more natural feel."
        )
    elif g > r + 10 and g > b + 10:
        suggestions.append(
            "Image is green-tinted; adjust white balance to avoid sickly tones."
        )
    else:
        suggestions.append(
            "Color balance looks neutral; hues appear well-distributed."
        )

    # Simple focal point / crop suggestion based on aspect ratio
    aspect_ratio = width / float(height)
    if aspect_ratio > 2.2:
        suggestions.append(
            "Very wide composition; ensure important content is centered, or consider vertical crops for social formats."
        )
    elif aspect_ratio < 0.6:
        suggestions.append(
            "Unusually tall composition; test how it reads in standard feeds and consider alternate crops."
        )
    else:
        suggestions.append(
            "Aspect ratio is versatile; should adapt well to common placements."
        )

    return {
        "asset_id": asset.id,
        "width": width,
        "height": height,
        "brightness": round(brightness, 2),
        "suggestions": suggestions,
    }
