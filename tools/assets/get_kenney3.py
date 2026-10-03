import urllib.request
import re
req = urllib.request.Request('https://kenney.nl/assets', headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode()
    matches = re.findall(r'href=[\"\'](/assets/[^\"\']+)[\"\']', html)
    for m in set(matches):
        if 'sport' in m.lower():
            print(m)
except Exception as e:
    print(e)
