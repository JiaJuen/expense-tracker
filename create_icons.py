from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new('RGBA', (size, size), color=(255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    margin = int(size * 0.04)
    r = int(size * 0.22)
    # Background
    draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=r, fill=(79, 70, 229, 255))
    
    # Wallet card body
    w_left = int(size * 0.22)
    w_top = int(size * 0.30)
    w_right = int(size * 0.78)
    w_bottom = int(size * 0.70)
    draw.rounded_rectangle([w_left, w_top, w_right, w_bottom], radius=int(size*0.06), fill=(255, 255, 255, 255))
    
    # Wallet flap
    f_left = int(size * 0.55)
    f_top = int(size * 0.42)
    f_right = int(size * 0.82)
    f_bottom = int(size * 0.58)
    draw.rounded_rectangle([f_left, f_top, f_right, f_bottom], radius=int(size*0.04), fill=(129, 140, 248, 255))
    # Flap dot
    draw.ellipse([int(size * 0.62), int(size * 0.47), int(size * 0.68), int(size * 0.53)], fill=(255, 255, 255, 255))

    img.save(path, 'PNG')
    print(f"Created {path} ({size}x{size})")

make_icon(180, 'static/apple-touch-icon.png')
make_icon(192, 'static/icon-192.png')
make_icon(512, 'static/icon-512.png')
