"""Make the small video test files in tests/videos/ (needs ffmpeg with libx265).

Usage: python3 scripts/make_video_samples.py [out_dir]

Videos in formats many browsers can't play (T61), each about 2 seconds of moving test
pattern with noise (so it's over the 20 KB "too small to be a real video" line):

  old-phone.3gp     H.263 176x144 in 3GP: early-2000s phones ('s263')
  hevc.mp4          H.265/HEVC 320x240 in MP4, tagged hvc1 like iPhone videos
  hevc.mov          H.265/HEVC 320x240 in QuickTime MOV, tagged hvc1
  mpeg4-part2.mp4   MPEG-4 Part 2 (DivX/Xvid-style) 160x120 in MP4 ('mp4v')
  camera-mjpeg.mov  Motion JPEG 160x120 in MOV: older digital cameras ('jpeg')
  camera.avi        MPEG-4 Part 2 in AVI: older digital cameras and webcams

Made by ffmpeg, not by the devices named: same codecs and containers, not real camera files.
"""
import os
import subprocess
import sys

out = sys.argv[1] if len(sys.argv) > 1 else "tests/videos"
os.makedirs(out, exist_ok=True)


def make(name, size, args):
    src = f"testsrc2=size={size}:rate=15:duration=2,noise=alls=12:allf=t"
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", src, "-an", *args,
           "-metadata", "creation_time=2009-08-15T10:20:30Z", "-map_metadata", "-1",
           os.path.join(out, name)]
    subprocess.run(cmd, check=True)
    print(name, os.path.getsize(os.path.join(out, name)))


make("old-phone.3gp", "176x144", ["-c:v", "h263", "-q:v", "12", "-f", "3gp"])
make("hevc.mp4", "320x240", ["-c:v", "libx265", "-x265-params", "log-level=error", "-b:v", "120k", "-tag:v", "hvc1", "-pix_fmt", "yuv420p"])
make("hevc.mov", "320x240", ["-c:v", "libx265", "-x265-params", "log-level=error", "-b:v", "120k", "-tag:v", "hvc1", "-pix_fmt", "yuv420p"])
make("mpeg4-part2.mp4", "160x120", ["-c:v", "mpeg4", "-q:v", "10"])
make("camera-mjpeg.mov", "160x120", ["-c:v", "mjpeg", "-q:v", "24", "-r", "8"])
make("camera.avi", "160x120", ["-c:v", "mpeg4", "-q:v", "20"])
