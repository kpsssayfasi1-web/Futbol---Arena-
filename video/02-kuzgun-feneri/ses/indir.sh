#!/bin/bash
# Kullanım: ./indir.sh <satır-no> <session-id> <url>
set -e
cd "$(dirname "$0")"
curl -sS -o "ham/$1.mp3" "$3"
python3 -c "
import json,sys;d=json.load(open('durum.json'));d['indirilen'][sys.argv[1]]=sys.argv[2];json.dump(d,open('durum.json','w'),indent=1);print('tamam:',len(d['indirilen']))" "$1" "$2"
ffprobe -v error -show_entries format=duration -of csv=p=0 "ham/$1.mp3"
