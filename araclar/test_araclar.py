"""araclar/ yardımcıları için birim testleri:  python -m pytest araclar -q"""
import numpy as np

from altyazi import chunk_words, word_color, BRASS, CRIMSON, WHITE
from hizala import align, normalize, script_words, snap_to_silences


def _w(text, start, end=None):
    return {"text": text, "start": start, "end": end if end is not None else start + 0.3}


def _texts(chunks):
    return [" ".join(w["text"] for w in c["words"]) for c in chunks]


def test_normalize_handles_turkish_casing_and_punctuation():
    assert normalize("İstanbul,") == "istanbul"
    assert normalize("Ezel'i") == "ezeli"
    assert normalize("ÂŞIK") == "aşık"


def test_script_words_drops_audio_tags():
    assert script_words("[sad] Bu adam… [pause] öldü.") == ["Bu", "adam…", "öldü."]


def test_align_copies_matched_times_and_interpolates_gaps():
    script = ["Ömer", "Uçar,", "tamirhanede", "çalışıyor."]
    whisper = [_w("Ömer", 1.0, 1.2), _w("Uçar", 1.2, 1.5), _w("çalışıyor", 2.4, 2.9)]
    out = align(script, whisper)
    assert out[0]["start"] == 1.0 and out[1]["end"] == 1.5
    assert 1.5 <= out[2]["start"] < out[2]["end"] <= 2.4
    assert out[3]["start"] == 2.4


def test_snap_moves_word_start_out_of_silence():
    words = [_w("Gel,", 13.6, 14.3)]
    out = snap_to_silences(words, [(12.5, 14.2)])
    assert out[0]["start"] == 14.2 and out[0]["end"] == 14.3


def test_chunks_break_before_overflow_and_on_punctuation():
    words = [_w(t, i * 0.4) for i, t in enumerate("Onu mahvedenlerden hesap sormak için.".split())]
    assert _texts(chunk_words(words)) == ["Onu mahvedenlerden", "hesap sormak için."]


def test_chunks_never_end_with_conjunction():
    words = [_w(t, i * 0.4) for i, t in enumerate("En yakın iki arkadaşı ve evlenmek istediği kız.".split())]
    texts = _texts(chunk_words(words, max_chars=18))
    assert all(not t.endswith(" ve") for t in texts)
    assert " ".join(texts) == "En yakın iki arkadaşı ve evlenmek istediği kız."


def test_chunk_windows_do_not_overlap():
    words = [_w(t, i * 0.3) for i, t in enumerate("Bu adam öldü. Ama ölmedi. Geri döndü.".split())]
    chunks = chunk_words(words)
    for a, b in zip(chunks, chunks[1:]):
        assert a["end"] <= b["start"]


def test_word_colors():
    assert word_color("Ezel'i") == BRASS
    assert word_color("öldüğünü") == CRIMSON
    assert word_color("masa") == WHITE


def test_caption_sprites_share_height_and_baseline():
    from altyazi import CaptionRenderer
    r = CaptionRenderer("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 88)
    heights = {r.sprite(t).shape[0] for t in ("Ezel'i", "yüzünü", "değiştirip", "İstanbul.", "ya", "o,")}
    assert len(heights) == 1
