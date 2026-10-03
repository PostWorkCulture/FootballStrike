import urllib.request
import re

url = 'https://kenney.nl/assets/sports-kit'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode()
        links = re.findall(r'href=[\"\']([^\"\']+\.zip)[\"\']', html)
        print('Zip links:', links)
except Exception as e:
    print('Failed:', e)
