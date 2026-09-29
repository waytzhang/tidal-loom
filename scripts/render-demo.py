"""Edit actual canvas recordings into a short, silent demo.

Usage: python scripts/render-demo.py RAW_DIRECTORY OUTPUT_MP4
Requires the official PyPI imageio-ffmpeg package. No generated gameplay.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg

raw = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
font = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
if not font.exists():
    raise SystemExit('Set the script font to an available licensed font on this system.')

segments = [
    ('desktop-three-islands.webm', 0, 8, None,
     'Tidal Loom', 'A small water garden, turned by hand. Desktop preview.'),
    ('iwer-first-play.webm', 19, 15, 'crop=440:310:420:230',
     'IWER hand simulator - actual gameplay, cropped', 'Pinch a channel, twist, then release. The gardens follow the water.'),
    ('iwer-first-play.webm', 76, 18, 'crop=520:350:380:210',
     'IWER hand simulator - actual gameplay, cropped', 'Undo and Next are on the board. No controller menu is needed.'),
    ('desktop-three-islands.webm', 46, 30, None,
     'Three islands. Branching water. No timer.', 'Desktop preview of the second and third puzzles.'),
    ('desktop-three-islands.webm', 80, 8, None,
     'Play for free in your browser', 'waytzhang.github.io/tidal-loom - physical headset performance unverified'),
]

def escaped(value):
    return value.replace('\\', '\\\\').replace("'", "\\'").replace(':', '\\:')

def run(args):
    completed = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', *args], capture_output=True, text=True)
    if completed.returncode:
        raise SystemExit(completed.stderr)

with tempfile.TemporaryDirectory(prefix='tidal-demo-') as temporary:
    directory = Path(temporary)
    files = []
    for index, (name, start, duration, crop, title, caption) in enumerate(segments):
        filters = ([crop] if crop else []) + [
            'scale=1280:720:force_original_aspect_ratio=decrease',
            'pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xeef3f2',
            'fps=30', 'setsar=1',
            'drawbox=x=0:y=0:w=iw:h=66:color=0x213a38@0.94:t=fill',
            f"drawtext=fontfile='{font}':text='{escaped(title)}':fontsize=28:fontcolor=0xf8fbfa:x=30:y=20",
            'drawbox=x=0:y=650:w=iw:h=70:color=0x213a38@0.94:t=fill',
            f"drawtext=fontfile='{font}':text='{escaped(caption)}':fontsize=22:fontcolor=0xf8fbfa:x=30:y=674",
        ]
        part = directory / f'{index:02d}.mp4'
        run(['-y', '-ss', str(start), '-t', str(duration), '-i', str(raw / name), '-an', '-vf', ','.join(filters),
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(part)])
        files.append(part)
    concat = directory / 'concat.txt'
    concat.write_text('\n'.join(f"file '{path}'" for path in files))
    run(['-y', '-f', 'concat', '-safe', '0', '-i', str(concat), '-c', 'copy', '-movflags', '+faststart', str(output)])
    run(['-i', str(output), '-f', 'null', '-'])

probe = subprocess.run([ffmpeg, '-hide_banner', '-i', str(output)], capture_output=True, text=True)
match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', probe.stderr)
duration = sum(float(value)*scale for value, scale in zip(match.groups(), [3600, 60, 1])) if match else None
receipt = {'durationSeconds': duration, 'plannedDurationSeconds': sum(segment[2] for segment in segments), 'resolution': [1280, 720],
           'fps': 30, 'audio': False, 'source': 'actual game canvas MediaRecorder captures',
           'physicalHeadsetFootage': False, 'edits': 'trimmed segments, labeled crops, captions; original speed',
           'segments': [{'file': s[0], 'start': s[1], 'duration': s[2], 'crop': s[3]} for s in segments],
           'bytes': output.stat().st_size, 'fullDecodePassed': True}
output.with_suffix('.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt))
