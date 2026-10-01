"""Cache licensed home photographs so the game never depends on hotlinked images."""
import io,json,time,urllib.request
from pathlib import Path
from PIL import Image
folder=Path(__file__).resolve().parents[1]/"assets/international/photos"
def valid(data):
    with Image.open(io.BytesIO(data)) as im:
        if im.format!="JPEG" or min(im.size)<700: raise ValueError("Invalid football photograph")
        im.verify()
for photo in json.loads((folder/"credits.json").read_text()):
    target=folder/photo["file"]
    if target.exists():
        valid(target.read_bytes())
        continue
    for attempt in range(3):
        try:
            request=urllib.request.Request(photo["url"],headers={"User-Agent":"FootballStrike/2.3 (https://github.com/PostWorkCulture/FootballStrike; licensed-photo-cache)"})
            with urllib.request.urlopen(request,timeout=45) as response: data=response.read()
            valid(data)
            target.write_bytes(data)
            print("Cached",photo["file"],len(data),"bytes")
            break
        except Exception:
            if attempt==2: raise
            time.sleep(3*(attempt+1))
