"""Make the small test files in tests/looks/ for the review filters (T50 screenshots, T59 chat apps).

Usage: python3 scripts/make_look_samples.py [out_dir]

Made with Pillow, not by real phones or apps: they copy the details each kind of file carries.

  ios-screenshot.png      1170x2532, Exif UserComment "Screenshot" and the same in XMP (iOS)
  android-screenshot.png  1080x2400, no details at all (most Android phones)
  mac-screenshot.png      2880x1800, XMP UserComment "Screenshot" only (macOS)
  gnome-screenshot.png    1366x768, PNG text Software "gnome-screenshot"
  graphic.png             1000x1000, no details: a PNG that isn't a screen size
  camera-screen.png       1080x1920 with camera Make/Model: not a screenshot
  tagged-screenshot.jpg   1080x2340 JPEG, Exif Software "Screenshot" (some Android phones)
  whatsapp.jpg            1600x1200, JFIF and no Exif (WhatsApp)
  messenger.jpg           960x720, JFIF and no Exif (Messenger, older size)
  telegram-exif.jpg       1280x960, a bare Exif block (orientation only), no JFIF: chat size
  camera-1600.jpg         1600x1200 with camera Make/Model, exposure and date: a camera photo
  exposure-only.jpg       1280x960, no Make/Model but exposure details: a camera photo
  edited.jpg              1500x1000, Exif with Software "GIMP" only, no JFIF: no hint
"""
import io
import os
import sys

from PIL import Image, PngImagePlugin

out = sys.argv[1] if len(sys.argv) > 1 else "tests/looks"
os.makedirs(out, exist_ok=True)

XMP = (
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    '<rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/"><exif:UserComment><rdf:Alt>'
    '<rdf:li xml:lang="x-default">Screenshot</rdf:li></rdf:Alt></exif:UserComment></rdf:Description></rdf:RDF></x:xmpmeta>'
)


def flat(w, h, c=(230, 232, 236)):
    return Image.new("RGB", (w, h), c)


def save(name, data):
    with open(os.path.join(out, name), "wb") as f:
        f.write(data)


def png(img, exif=None, text=None, itxt=None):
    info = PngImagePlugin.PngInfo()
    for k, v in (text or {}).items():
        info.add_text(k, v)
    for k, v in (itxt or {}).items():
        info.add_itxt(k, v)
    b = io.BytesIO()
    extra = {"exif": exif.tobytes()} if exif is not None else {}
    img.save(b, "PNG", pnginfo=info, optimize=True, **extra)
    return b.getvalue()


def jpeg(img, exif=None, jfif=True):
    b = io.BytesIO()
    extra = {"exif": exif.tobytes()} if exif is not None else {}
    img.save(b, "JPEG", quality=20, **extra)
    data = b.getvalue()
    if not jfif and data[2:4] == b"\xff\xe0":  # drop the APP0 JFIF segment
        n = int.from_bytes(data[4:6], "big")
        data = data[:2] + data[4 + n:]
    return data


ios = Image.Exif()
ios.get_ifd(0x8769)[0x9286] = b"ASCII\0\0\0Screenshot"
ios.get_ifd(0x8769)[0x9003] = "2023:05:06 07:08:09"
save("ios-screenshot.png", png(flat(1170, 2532), exif=ios, itxt={"XML:com.adobe.xmp": XMP}))
save("android-screenshot.png", png(flat(1080, 2400)))
save("mac-screenshot.png", png(flat(2880, 1800), itxt={"XML:com.adobe.xmp": XMP}))
save("gnome-screenshot.png", png(flat(1366, 768), text={"Software": "gnome-screenshot"}))
save("graphic.png", png(flat(1000, 1000)))
cam = Image.Exif()
cam[0x010F], cam[0x0110] = "samsung", "SM-A525F"
save("camera-screen.png", png(flat(1080, 1920), exif=cam))

tag = Image.Exif()
tag[0x0131] = "Screenshot"
save("tagged-screenshot.jpg", jpeg(flat(1080, 2340), exif=tag))
save("whatsapp.jpg", jpeg(flat(1600, 1200, (120, 160, 200))))
save("messenger.jpg", jpeg(flat(960, 720, (120, 160, 200))))
orient = Image.Exif()
orient[0x0112] = 1
save("telegram-exif.jpg", jpeg(flat(1280, 960, (120, 160, 200)), exif=orient, jfif=False))
camera = Image.Exif()
camera[0x010F], camera[0x0110] = "samsung", "SM-A525F"
camera[0x0132] = "2022:08:09 10:11:12"
sub = camera.get_ifd(0x8769)
sub[0x9003] = "2022:08:09 10:11:12"
sub[0x829A] = (1, 120)
sub[0x829D] = (18, 10)
save("camera-1600.jpg", jpeg(flat(1600, 1200, (120, 160, 200)), exif=camera))
expo = Image.Exif()
expo.get_ifd(0x8769)[0x829A] = (1, 60)
expo.get_ifd(0x8769)[0x8827] = 100
save("exposure-only.jpg", jpeg(flat(1280, 960, (120, 160, 200)), exif=expo, jfif=False))
gimp = Image.Exif()
gimp[0x0131] = "GIMP 2.10.34"
save("edited.jpg", jpeg(flat(1500, 1000, (120, 160, 200)), exif=gimp, jfif=False))
print("wrote", sorted(os.listdir(out)))
