"""Genera las imágenes provisionales (1A, 1B, 1C ... 8A, 8B, 8C) y el QR de ejemplo.
A = fondo de la página (1280x960) · B = figura media (recorte) · C = figura frontal (recorte).
Uso: python3 tools/make-placeholders.py   (requiere Pillow)"""
import random, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

random.seed(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'img')
os.makedirs(OUT, exist_ok=True)
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
REG = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
TITLES = ["Bienvenida", "Nuestra historia", "Ceremonia", "Recepción", "Programa", "Detalles", "Regalos", "Confirmación"]
TINTS = [(214,190,150),(200,170,160),(190,200,205),(215,185,170),(205,200,160),(190,185,200),(220,195,150),(205,175,175)]
GOLD = (176,141,60)

def wash(size, tint, n=16):
    W, H = size
    base = Image.new('RGBA', size, (250,245,232,255))
    layer = Image.new('RGBA', size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        cx, cy = random.randint(0, W), random.randint(0, H)
        r = random.randint(min(W,H)//6, min(W,H)//2)
        col = tuple(max(0, min(255, c + random.randint(-25,25))) for c in tint) + (random.randint(60,130),)
        d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=col)
    layer = layer.filter(ImageFilter.GaussianBlur(min(W,H)//12))
    return Image.alpha_composite(base, layer)

def label(img, text, sub, big):
    d = ImageDraw.Draw(img)
    W, H = img.size
    f = ImageFont.truetype(BOLD, big)
    sf = ImageFont.truetype(REG, max(18, big//7))
    d.text((W/2, H/2 - big*0.1), text, font=f, fill=(60,48,40,235), anchor='mm')
    d.text((W/2, H/2 + big*0.55), sub, font=sf, fill=(90,75,60,230), anchor='mm')

def make_A(i):
    img = wash((1280, 960), TINTS[i])
    d = ImageDraw.Draw(img)
    d.rectangle((30,30,1250,930), outline=GOLD+(255,), width=6)
    d.rectangle((48,48,1232,912), outline=GOLD+(160,), width=2)
    label(img, f"{i+1}A", f"Fondo · {TITLES[i]} · 1280×960", 300)
    img.convert('RGB').save(f"{OUT}/{i+1}A.webp", quality=80)

def cutout(size, shape, tint, tag, sub, big):
    W, H = size
    mask = Image.new('L', size, 0)
    md = ImageDraw.Draw(mask)
    m = 26
    if shape == 'arch':
        md.rectangle((m, W//2, W-m, H-m), fill=255)
        md.ellipse((m, m, W-m, W-m), fill=255)
    else:
        md.ellipse((m, m, W-m, H-m), fill=255)
    outline = mask.filter(ImageFilter.MaxFilter(21))
    img = Image.new('RGBA', size, (0,0,0,0))
    img.paste((253,250,242,255), (0,0), outline)
    art = wash(size, tint, 10)
    img.paste(art, (0,0), mask)
    d = ImageDraw.Draw(img)
    d.line((m+20, H-m-6, W-m-20, H-m-6), fill=GOLD+(255,), width=5) if shape == 'arch' else None
    label(img, tag, sub, big)
    return img

for i in range(8):
    make_A(i)
    b = cutout((640, 900), 'arch', TINTS[i], f"{i+1}B", f"Figura media · 640×900", 190)
    b.save(f"{OUT}/{i+1}B.webp", quality=82)
    c = cutout((560, 560), 'oval', TINTS[(i+3) % 8], f"{i+1}C", f"Frontal · 560×560", 170)
    c.save(f"{OUT}/{i+1}C.webp", quality=82)

# QR de ejemplo (reemplazar por el real: img/qr.png)
qr = Image.new('RGBA', (600, 600), (255,255,255,255))
d = ImageDraw.Draw(qr)
d.rectangle((14,14,586,586), outline=(120,120,120,255), width=4)
cell = 24
for y in range(2, 24):
    for x in range(2, 24):
        if random.random() < 0.45:
            d.rectangle((x*cell, y*cell, x*cell+cell-3, y*cell+cell-3), fill=(205,205,205,255))
for (x, y) in [(2,2),(17,2),(2,17)]:
    d.rectangle((x*cell, y*cell, x*cell+6*cell, y*cell+6*cell), fill=(170,170,170,255))
    d.rectangle((x*cell+cell, y*cell+cell, x*cell+5*cell, y*cell+5*cell), fill=(255,255,255,255))
d.rectangle((150,235,450,365), fill=(255,255,255,255))
d.text((300,300), "TU QR AQUÍ", font=ImageFont.truetype(BOLD, 48), fill=(70,60,50,255), anchor='mm')
qr.save(f"{OUT}/qr.png", optimize=True)
print("ok")
