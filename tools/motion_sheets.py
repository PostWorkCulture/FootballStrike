import os,json,base64
from PIL import Image,ImageDraw,ImageFont
root='verification/motion'
report=json.load(open(root+'/report.json'))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
for name in dict.fromkeys(f['name'] for f in report['frames']):
 frames=[f for f in report['frames'] if f['name']==name]
 sheet=Image.new('RGB',(1920,1170),'#0c1b24');d=ImageDraw.Draw(sheet)
 for i,f in enumerate(frames):
  x=(i%3)*640;y=(i//3)*390
  sheet.paste(Image.open(root+'/'+f['file']),(x,y))
  d.text((x+14,y+365),f"{name}   {f['time']:.2f}s   {f['stage']}",font=font,fill='#e7f1dd')
 p=root+'/'+name+'-sheet.jpg';sheet.save(p,quality=89)
 with open(p[:-4]+'.base64.txt','w') as h:h.write(base64.b64encode(open(p,'rb').read()).decode())
