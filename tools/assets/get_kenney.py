import urllib.request
import re
import zipfile
import io

url = 'https://kenney.nl/assets/sports-pack'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode()
        links = re.findall(r'href=[\"\']([^\"\']+\.zip)[\"\']', html)
        print('Zip links:', links)
except Exception as e:
    print('Failed:', e)
