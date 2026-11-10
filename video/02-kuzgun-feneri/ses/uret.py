"""Kalan replikleri ElevenLabs TTS API'si ile sırayla üretir (yalnızca konuşma sesi).
Kullanım: python3 uret.py [satır-no ...]   (boşsa eksik olanların hepsi)"""
import json, sys, time, urllib.request, urllib.error, os

VOICES = {"ANLATICI": "AMjkpTkYyZF0aFQa3oLV", "HASAN": "mF7tIc9VLrznhGooGjaT",
          "DENİZ": "bGrRgpWYCRJBpH5MVsfQ", "ENES": "cnssGWqE7kJax1MvsjA8",
          "NUR": "Xen0soH4tcGo78ododZU", "KÜÇÜK NUR": "2w5twzryiFg9VNnXphRP"}
MODEL = os.environ.get("TTS_MODEL", "eleven_v4")
here = os.path.dirname(os.path.abspath(__file__))
lines = json.load(open(os.path.join(here, "..", "replikler.json")))
state_path = os.path.join(here, "durum.json")

def tts(line):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICES[line['speaker']]}?output_format=mp3_44100_128"
    body = json.dumps({"text": line["text"], "model_id": MODEL}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", "xi-api-key": "proxy-injected"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()

wanted = sys.argv[1:]
for line in lines:
    state = json.load(open(state_path))
    if wanted and line["id"] not in wanted:
        continue
    if not wanted and line["id"] in state["indirilen"]:
        continue
    for attempt in range(4):
        try:
            data = tts(line)
            break
        except urllib.error.HTTPError as e:
            msg = e.read()[:300]
            print(f"{line['id']} HATA {e.code}: {msg}", flush=True)
            if e.code in (401, 403, 422) or b"quota" in msg:
                sys.exit(1)
            time.sleep(5 * (attempt + 1))
    else:
        sys.exit(f"{line['id']} üretilemedi")
    open(os.path.join(here, "ham", f"{line['id']}.mp3"), "wb").write(data)
    state["indirilen"][line["id"]] = f"api:{MODEL}"
    json.dump(state, open(state_path, "w"), indent=1)
    print(f"{line['id']} {line['speaker']} tamam ({len(data)//1024} KB)", flush=True)
